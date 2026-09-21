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
 * Quanto cada criativo pode pesar (em caracteres de base64) para o disparo
 * INTEIRO caber num POST.
 *
 * O front fala com a API por um proxy edge na Vercel, e a plataforma recusa
 * qualquer requisição acima de ~4,2 MB com `FUNCTION_PAYLOAD_TOO_LARGE` — medido
 * no deploy em 10/09/2026: 4,0 MB passa, 4,4 MB volta 413. O 413 não vem em
 * JSON, então o front nem acha a mensagem e mostra "Erro no servidor".
 * O `bodyLimit: 80MB` do Fastify não adianta: o pedido morre antes de chegar lá.
 *
 * Enquanto o disparo levava 3 a 6 imagens, o teto fixo de 800 KB cabia. Com o
 * rodízio, um disparo carrega a lista inteira do cliente (43 produtos num caso
 * real) e estourava sempre. Então o teto passa a ser por ENVIO, dividido entre
 * os criativos: com poucos produtos nada muda, e com muitos a arte encolhe o
 * necessário para o disparo existir.
 */
const ORCAMENTO_ENVIO = 3.4 * 1024 * 1024;   // sobra para mensagem, grupos e rótulos
const TETO_POR_CRIATIVO = 800 * 1024;
const PISO_POR_CRIATIVO = 40 * 1024;         // abaixo disso a peça fica ilegível

export function orcamentoPorCriativo(quantidade: number): number {
  if (quantidade <= 0) return TETO_POR_CRIATIVO;
  const fatia = Math.floor(ORCAMENTO_ENVIO / quantidade);
  return Math.min(TETO_POR_CRIATIVO, Math.max(PISO_POR_CRIATIVO, fatia));
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
  maxBytes = TETO_POR_CRIATIVO,
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

// ── Formato obrigatório do anúncio ───────────────────────────────────────────

/**
 * Todo anúncio sobe ao Meta em 1080×1350 (retrato 4:5).
 *
 * Os criativos GERADOS já nascem assim (ver DIMENSOES). O problema eram as
 * artes prontas e os uploads do wizard: iam para a Graph API na dimensão do
 * arquivo do designer — quadrado, paisagem, 2000px — e o Meta reenquadrava por
 * conta própria, cortando preço e logo no feed.
 */
export const FORMATO_ANUNCIO = { w: 1080, h: 1350 } as const;

/**
 * Teto por arte de anúncio. Cada imagem viaja no corpo do POST da campanha, e o
 * proxy da Vercel recusa acima de ~4,2 MB. 1,5 MB preserva bem mais qualidade
 * que o teto do disparo por WhatsApp — e um 1080×1350 em JPEG fica bem abaixo
 * disso na prática.
 */
export const TETO_POR_ARTE_ANUNCIO = 1.5 * 1024 * 1024;

/**
 * Desfoque do fundo, em px na escala 1080×1350.
 *
 * O que sobra ao redor da arte é a própria imagem ampliada e borrada, não uma
 * faixa branca: no feed a barra branca denuncia o criativo mal formatado, e
 * cortar a arte para preencher perderia justamente as bordas onde o designer
 * põe preço e marca.
 */
const DESFOQUE_FUNDO = 40;

/**
 * Quanto o fundo é ampliado além do necessário para cobrir a tela.
 *
 * O blur do canvas puxa transparência de fora da imagem para dentro, deixando
 * uma moldura lavada nas beiradas. Ampliando o fundo, essa faixa cai fora do
 * enquadramento.
 */
const OVERSCAN_FUNDO = 1.15;

/** Tamanho real (em bytes do base64) de um data URI. */
function pesoBase64(dataUrl: string): number {
  return dataUrl.length - (dataUrl.indexOf(",") + 1);
}

/** Desenha a imagem em 1080×1350 (× escala): fundo borrado + arte inteira por cima. */
function enquadrarEm45(img: HTMLImageElement, escala: number): HTMLCanvasElement {
  const largura = Math.max(1, Math.round(FORMATO_ANUNCIO.w * escala));
  const altura = Math.max(1, Math.round(FORMATO_ANUNCIO.h * escala));

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d")!;

  // Base branca: se o navegador ignorar ctx.filter, o fundo ainda sai limpo.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, largura, altura);

  const nw = img.naturalWidth || largura;
  const nh = img.naturalHeight || altura;

  // Fundo: cobre a tela inteira (e sobra), borrado.
  const cobrir = Math.max(largura / nw, altura / nh) * OVERSCAN_FUNDO;
  const fw = nw * cobrir;
  const fh = nh * cobrir;
  ctx.filter = `blur(${Math.max(1, Math.round(DESFOQUE_FUNDO * escala))}px)`;
  ctx.drawImage(img, (largura - fw) / 2, (altura - fh) / 2, fw, fh);
  ctx.filter = "none";

  // Arte: cabe inteira, centralizada, sem corte nenhum.
  const caber = Math.min(largura / nw, altura / nh);
  const aw = nw * caber;
  const ah = nh * caber;
  ctx.drawImage(img, (largura - aw) / 2, (altura - ah) / 2, aw, ah);

  return canvas;
}

/**
 * Põe qualquer imagem no formato do anúncio (1080×1350) e dentro de `maxBytes`.
 *
 * A arte não é cortada: entra inteira, centralizada, com o vazio preenchido
 * pelo fundo borrado. Devolve data URI pronto para o campo `pngBase64` que o
 * backend manda para a Graph API.
 *
 * Arte que já está exatamente em 1080×1350 e dentro do teto passa intacta —
 * re-encodar à toa só perderia qualidade.
 */
export async function normalizarParaAnuncio(
  dataUrl: string,
  maxBytes = TETO_POR_ARTE_ANUNCIO,
): Promise<{ dataUrl: string; mime: string }> {
  const img = await carregarImagem(dataUrl);

  const jaNoFormato =
    img.naturalWidth === FORMATO_ANUNCIO.w && img.naturalHeight === FORMATO_ANUNCIO.h;
  const mimeOriginal = /^data:([^;]+)/.exec(dataUrl)?.[1] ?? "";
  const mimeAceito = mimeOriginal === "image/jpeg" || mimeOriginal === "image/png";
  if (jaNoFormato && mimeAceito && pesoBase64(dataUrl) <= maxBytes) {
    return { dataUrl, mime: mimeOriginal };
  }

  // Qualidade alta primeiro: a arte do designer é o anúncio, não uma prévia.
  const qualidades = [0.92, 0.85, 0.78, 0.7, 0.6, 0.5];

  let escala = 1;
  let ultimo = "";
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const canvas = enquadrarEm45(img, escala);
    for (const q of qualidades) {
      const jpeg = canvas.toDataURL("image/jpeg", q);
      ultimo = jpeg;
      if (pesoBase64(jpeg) <= maxBytes) return { dataUrl: jpeg, mime: "image/jpeg" };
    }
    // Ainda grande: encolhe a resolução MANTENDO o 4:5 — o formato é inegociável,
    // a contagem de pixels não. (Na prática não chega aqui: 1080×1350 em JPEG
    // 0,92 dá ~400 KB.)
    escala *= 0.8;
  }

  return { dataUrl: ultimo, mime: "image/jpeg" };
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

// ── Download dos criativos prontos ───────────────────────────────────────────

/** Nome de arquivo seguro a partir do nome do produto. */
function nomeArquivo(indice: number, nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60) || "criativo";
  // Prefixo numérico mantém a ordem da prévia dentro da pasta de downloads.
  return `${String(indice + 1).padStart(2, "0")}-${limpo}.png`;
}

/** Dispara o download de um data URI, sem passar por servidor. */
function baixarDataUri(dataUri: string, nome: string): void {
  const a = document.createElement("a");
  a.href = dataUri;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Rasteriza e baixa todos os criativos, um arquivo PNG por produto.
 *
 * Um a um e não um .zip: o projeto não tem lib de compactação, e o gestor quer
 * justamente os arquivos soltos para postar. Na primeira vez o navegador
 * pergunta se aceita baixar vários arquivos do site — é uma vez só.
 *
 * A pausa entre downloads não é estética: disparar vários `a.click()` no mesmo
 * tique faz o Chrome descartar os últimos silenciosamente.
 *
 * `onProgresso` é chamado a cada arquivo pronto, para a interface contar.
 */
export async function baixarCriativos(
  criativos: Array<{ dados: CriativoDados; nome: string }>,
  onProgresso?: (feitos: number, total: number) => void,
): Promise<void> {
  for (let i = 0; i < criativos.length; i++) {
    const { dados, nome } = criativos[i];
    const png = await exportarCriativoPng(dados);
    baixarDataUri(png, nomeArquivo(i, nome));
    onProgresso?.(i + 1, criativos.length);
    if (i < criativos.length - 1) {
      await new Promise((r) => setTimeout(r, 350));
    }
  }
}
