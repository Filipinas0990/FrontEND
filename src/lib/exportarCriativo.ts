import { createRoot } from "react-dom/client";
import { createElement } from "react";
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

export async function exportarCriativoPng(dados: CriativoDados): Promise<string> {
  const dim = DIMENSOES[dados.enquadramento] ?? DIMENSOES["4:5"];
  const largura = dim.w;
  const altura = dim.h;

  // Container escondido, no tamanho final do criativo
  const host = document.createElement("div");
  host.style.cssText =
    `position:fixed;left:-10000px;top:0;width:${largura}px;height:${altura}px;pointer-events:none;z-index:-1;`;
  document.body.appendChild(host);

  const root = createRoot(host);

  try {
    // Renderiza o card e espera imagens/layout assentarem
    await new Promise<void>((resolve) => {
      root.render(createElement(CriativoCard, dados));
      setTimeout(resolve, 350);
    });

    const alvo = host.firstElementChild as HTMLElement;
    return await toPng(alvo, { width: largura, height: altura, pixelRatio: 1, cacheBust: true });
  } finally {
    root.unmount();
    host.remove();
  }
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
