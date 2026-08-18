import { createRoot } from "react-dom/client";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { toPng } from "html-to-image";
import { CriativoCard, type CriativoDados } from "@/components/CriativoCard";

/**
 * Renderiza um CriativoCard em alta resolução (fora da tela) e captura em PNG.
 * Modelo 1 = 1080×1350 (retrato 4:5) · Modelo 2 = 1080×1080 (quadrado).
 * Retorna um data URI (data:image/png;base64,...).
 */
const DIMENSOES: Record<string, { w: number; h: number }> = {
  "4:5":  { w: 1080, h: 1350 },
  "1:1":  { w: 1080, h: 1080 },
  "9:16": { w: 1080, h: 1920 },
};

/** Pesos da Inter que o criativo usa. Fonte não carregada = métrica errada no PNG. */
const PESOS_FONTE = ["400", "700", "800", "900"];

const proximoFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

async function esperarFontes(): Promise<void> {
  try {
    await Promise.all(PESOS_FONTE.map((peso) => document.fonts.load(`${peso} 1em Inter`)));
    await document.fonts.ready;
  } catch {
    // Sem a fonte o texto ainda sai, só com o fallback — não vale abortar o PNG.
  }
}

/** Espera toda <img> dentro da raiz decodificar. Imagem pendente = buraco no PNG. */
async function esperarImagens(raiz: HTMLElement, timeoutMs = 8000): Promise<void> {
  const pendentes = Array.from(raiz.querySelectorAll("img"))
    .filter((img) => !(img.complete && img.naturalWidth > 0))
    .map(
      (img) =>
        new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    );
  if (!pendentes.length) return;
  await Promise.race([
    Promise.all(pendentes).then(() => undefined),
    new Promise<void>((r) => setTimeout(r, timeoutMs)),
  ]);
}

/**
 * Baixa a imagem do produto e devolve como data URI.
 *
 * O html-to-image monta um SVG e precisa embutir a imagem nele. Se a imagem vier
 * de outra origem — e vem, o banco de imagens é servido pela API — e o fetch
 * interno dele falhar, ele desiste em silêncio: o criativo sai com o quadro
 * vazio, sem erro nenhum. Buscando aqui, a imagem chega garantida ao PNG.
 */
async function embutirImagem(src?: string | null): Promise<string | null | undefined> {
  if (!src || src.startsWith("data:")) return src;
  try {
    const res = await fetch(src, { mode: "cors", credentials: "omit" });
    if (!res.ok) return src;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => reject(new Error("falha ao ler a imagem"));
      fr.readAsDataURL(blob);
    });
  } catch (err) {
    // Falhar em silêncio aqui é justamente o que fazia o criativo sair sem a
    // foto do produto — se acontecer, o motivo tem que aparecer no console.
    console.warn("Não consegui embutir a imagem do produto no criativo:", src, err);
    return src; // deixa o html-to-image tentar do jeito dele
  }
}

export async function exportarCriativoPng(dados: CriativoDados): Promise<string> {
  const dim = DIMENSOES[dados.enquadramento] ?? DIMENSOES["4:5"];
  const largura = dim.w;
  const altura = dim.h;

  const imagem = await embutirImagem(dados.imagem);

  // Container escondido, no tamanho final do criativo
  const host = document.createElement("div");
  host.style.cssText =
    `position:fixed;left:-10000px;top:0;width:${largura}px;height:${altura}px;pointer-events:none;z-index:-1;`;
  document.body.appendChild(host);

  const root = createRoot(host);

  try {
    // flushSync garante que o card já está no DOM quando lemos firstElementChild
    flushSync(() => root.render(createElement(CriativoCard, { ...dados, imagem })));

    const alvo = host.firstElementChild as HTMLElement | null;
    if (!alvo) throw new Error("Criativo não renderizou");

    // Canto arredondado vira canto transparente no PNG — o criativo final é reto.
    alvo.style.borderRadius = "0";

    await esperarFontes();
    await esperarImagens(host);
    await proximoFrame();
    await proximoFrame();

    return await toPng(alvo, {
      width: largura,
      height: altura,
      pixelRatio: 1,
      backgroundColor: "#ffffff",
    });
  } finally {
    root.unmount();
    host.remove();
  }
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Comprime um criativo (data URL) para caber abaixo de `maxBytes`, re-encodando
 * em JPEG com qualidade — e, se preciso, resolução — decrescentes.
 *
 * Necessário porque a Evolution API fica atrás de um nginx com
 * `client_max_body_size` de 1 MB: um PNG de 1080px estoura fácil e a imagem é
 * rejeitada (413) antes de chegar no WhatsApp. Devolve base64 PURO (sem o
 * prefixo data:) + o mime resultante.
 */
export async function comprimirParaEnvio(
  dataUrl: string,
  maxBytes = 800 * 1024,
): Promise<{ b64: string; mime: string }> {
  const img = await carregarImagem(dataUrl);
  const qualidades = [0.82, 0.7, 0.6, 0.5, 0.4];

  const desenhar = (escala: number, q: number): string => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * escala));
    const ctx = canvas.getContext("2d")!;
    // JPEG não tem transparência — fundo branco evita artefatos pretos.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", q);
  };

  let escala = 1;
  let ultimo = "";
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    for (const q of qualidades) {
      const jpeg = desenhar(escala, q);
      const b64 = jpeg.replace(/^data:[^;]+;base64,/, "");
      ultimo = b64;
      if (b64.length <= maxBytes) return { b64, mime: "image/jpeg" };
    }
    escala *= 0.8; // ainda grande: reduz a resolução e tenta de novo
  }

  // Não conseguiu bater a meta — devolve a menor versão gerada mesmo assim.
  return { b64: ultimo, mime: "image/jpeg" };
}

/** Dispara o download de um data URI no navegador. Mantém a extensão se já houver; senão usa .png */
export function baixarPng(dataUrl: string, nomeArquivo: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = /\.[a-z0-9]{3,4}$/i.test(nomeArquivo) ? nomeArquivo : `${nomeArquivo}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
