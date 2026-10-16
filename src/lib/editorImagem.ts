/**
 * Motor do editor de imagens do Banco de Imagens: girar, espelhar, recortar e
 * ajustar brilho/contraste/saturação, tudo em <canvas> no navegador.
 *
 * Os ajustes de cor são aplicados pixel a pixel na exportação, e não com
 * `ctx.filter`: o Safari antigo ignora `ctx.filter` em silêncio e a imagem
 * salva sairia sem o ajuste que o gestor viu na tela. A prévia usa o `filter`
 * do CSS (que funciona em todo navegador) e a conta abaixo reproduz a mesma
 * fórmula da especificação de filtros do CSS.
 */

export type Rotacao = 0 | 90 | 180 | 270;

/** Recorte em frações (0–1) da imagem JÁ girada/espelhada. */
export interface Recorte {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Edicao {
  rotacao: Rotacao;
  espelharH: boolean;
  espelharV: boolean;
  recorte: Recorte | null;
  /** 100 = sem alteração. */
  brilho: number;
  contraste: number;
  saturacao: number;
}

export const EDICAO_INICIAL: Edicao = {
  rotacao: 0,
  espelharH: false,
  espelharV: false,
  recorte: null,
  brilho: 100,
  contraste: 100,
  saturacao: 100,
};

export function edicaoAlterada(e: Edicao): boolean {
  return (
    e.rotacao !== 0 ||
    e.espelharH ||
    e.espelharV ||
    e.recorte !== null ||
    e.brilho !== 100 ||
    e.contraste !== 100 ||
    e.saturacao !== 100
  );
}

/** O mesmo ajuste, como `filter` do CSS — para a prévia. */
export function filtroCss(e: Edicao): string {
  return `brightness(${e.brilho}%) contrast(${e.contraste}%) saturate(${e.saturacao}%)`;
}

/** Dimensões da imagem depois de girar. */
export function dimensoesGiradas(img: HTMLImageElement, rotacao: Rotacao): { w: number; h: number } {
  const deitada = rotacao === 90 || rotacao === 270;
  return deitada
    ? { w: img.naturalHeight, h: img.naturalWidth }
    : { w: img.naturalWidth, h: img.naturalHeight };
}

/** Desenha a imagem girada/espelhada (sem recorte nem cor) num canvas na escala pedida. */
export function desenharOrientada(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  e: Pick<Edicao, "rotacao" | "espelharH" | "espelharV">,
  escala = 1,
): void {
  const { w, h } = dimensoesGiradas(img, e.rotacao);
  canvas.width = Math.max(1, Math.round(w * escala));
  canvas.height = Math.max(1, Math.round(h * escala));
  const ctx = canvas.getContext("2d")!;
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((e.rotacao * Math.PI) / 180);
  ctx.scale(e.espelharH ? -1 : 1, e.espelharV ? -1 : 1);
  const dw = img.naturalWidth * escala;
  const dh = img.naturalHeight * escala;
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

/** brightness → contrast → saturate, na ordem do `filtroCss`. */
function aplicarCor(ctx: CanvasRenderingContext2D, w: number, h: number, e: Edicao): void {
  if (e.brilho === 100 && e.contraste === 100 && e.saturacao === 100) return;
  const dados = ctx.getImageData(0, 0, w, h);
  const px = dados.data;
  const b = e.brilho / 100;
  const c = e.contraste / 100;
  const s = e.saturacao / 100;
  // Matriz de saturate() da especificação (Filter Effects Module).
  const m = [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
  ];
  const lim = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
  for (let i = 0; i < px.length; i += 4) {
    let r = lim(px[i] * b);
    let g = lim(px[i + 1] * b);
    let bl = lim(px[i + 2] * b);
    r = lim((r - 127.5) * c + 127.5);
    g = lim((g - 127.5) * c + 127.5);
    bl = lim((bl - 127.5) * c + 127.5);
    px[i] = lim(m[0] * r + m[1] * g + m[2] * bl);
    px[i + 1] = lim(m[3] * r + m[4] * g + m[5] * bl);
    px[i + 2] = lim(m[6] * r + m[7] * g + m[8] * bl);
  }
  ctx.putImageData(dados, 0, 0);
}

/** Lado maior da imagem salva. Foto de celular de 4000 px não precisa ir inteira para o criativo. */
const LADO_MAXIMO = 2048;
/**
 * Teto do arquivo em base64. O proxy da Vercel recusa corpo acima de ~4,2 MB
 * (413); com folga para o JSON em volta.
 */
const TETO_B64 = 3_800_000;

export type MimeSaida = "image/png" | "image/jpeg" | "image/webp";

/**
 * Gera a imagem final (data URI). Mantém o formato original quando dá; se o
 * PNG ficar grande demais para o proxy, cai para JPEG e vai baixando a
 * qualidade até caber.
 */
export function exportar(
  img: HTMLImageElement,
  e: Edicao,
  mimeOriginal: string | null,
): { dataUrl: string; mime: MimeSaida } {
  const orientada = document.createElement("canvas");
  desenharOrientada(orientada, img, e);

  const r = e.recorte ?? { x: 0, y: 0, w: 1, h: 1 };
  const sx = Math.round(r.x * orientada.width);
  const sy = Math.round(r.y * orientada.height);
  const sw = Math.max(1, Math.round(r.w * orientada.width));
  const sh = Math.max(1, Math.round(r.h * orientada.height));
  const fator = Math.min(1, LADO_MAXIMO / Math.max(sw, sh));

  const saida = document.createElement("canvas");
  saida.width = Math.max(1, Math.round(sw * fator));
  saida.height = Math.max(1, Math.round(sh * fator));
  const ctx = saida.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(orientada, sx, sy, sw, sh, 0, 0, saida.width, saida.height);
  aplicarCor(ctx, saida.width, saida.height, e);

  let mime: MimeSaida =
    mimeOriginal === "image/png" || mimeOriginal === "image/webp" ? mimeOriginal : "image/jpeg";
  let dataUrl = saida.toDataURL(mime, 0.92);
  // toDataURL devolve PNG quando o navegador não sabe gerar o formato pedido.
  if (!dataUrl.startsWith(`data:${mime}`)) mime = "image/png";

  for (const q of [0.92, 0.85, 0.75, 0.6]) {
    if (dataUrl.length <= TETO_B64) break;
    mime = "image/jpeg";
    dataUrl = saida.toDataURL(mime, q);
  }
  if (dataUrl.length > TETO_B64) {
    throw new Error("A imagem ficou grande demais para salvar. Recorte uma área menor.");
  }
  return { dataUrl, mime };
}

/** Prende o recorte dentro da imagem e com tamanho mínimo. */
export function limitarRecorte(r: Recorte): Recorte {
  const w = Math.min(1, Math.max(0.02, r.w));
  const h = Math.min(1, Math.max(0.02, r.h));
  return {
    w,
    h,
    x: Math.min(1 - w, Math.max(0, r.x)),
    y: Math.min(1 - h, Math.max(0, r.y)),
  };
}

/**
 * Maior recorte centralizado com a proporção pedida (largura/altura em PIXELS),
 * para quando o gestor escolhe 1:1 ou 4:5 sem ter desenhado nada.
 */
export function recorteCentral(proporcao: number, larguraPx: number, alturaPx: number): Recorte {
  let wPx = larguraPx;
  let hPx = wPx / proporcao;
  if (hPx > alturaPx) {
    hPx = alturaPx;
    wPx = hPx * proporcao;
  }
  const w = wPx / larguraPx;
  const h = hPx / alturaPx;
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}
