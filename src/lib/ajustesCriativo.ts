/**
 * Ajuste fino do criativo: quanto cada peça do desenho foi empurrada e
 * redimensionada pelo gestor na tela de edição.
 *
 * Vive fora do CriativoCard porque é o vocabulário comum de três lados — o
 * card, que desenha; a tela de edição, que mexe; e a tela de disparo, que
 * guarda por produto — e porque constante exportada de um arquivo de
 * componente derruba o fast refresh do Vite.
 *
 * `x`/`y` são deslocamentos em % da LARGURA do criativo (a mesma régua em que
 * o card inteiro é desenhado), e `escala` é multiplicador: 1 é o tamanho que o
 * modelo já tinha. Por serem proporções, e não px, o que o gestor vê na tela
 * grande sai igual na miniatura da prévia e no PNG de 1080px.
 */

export type AlvoCriativo = "foto" | "titulo" | "subtitulo" | "preco" | "rodape";

export interface AjusteElemento {
  x: number;
  y: number;
  escala: number;
}

export type AjustesCriativo = Partial<Record<AlvoCriativo, AjusteElemento>>;

export const AJUSTE_ZERO: AjusteElemento = { x: 0, y: 0, escala: 1 };

/** Peça no lugar padrão do modelo — nada a aplicar, nada a marcar na prévia. */
export function ajusteNeutro(a: AjusteElemento): boolean {
  return a.x === 0 && a.y === 0 && a.escala === 1;
}

/** Quantas peças o gestor mexeu num criativo. 0 = arte no padrão. */
export function pecasAjustadas(ajustes: AjustesCriativo | undefined): number {
  return Object.values(ajustes ?? {}).filter((a) => a && !ajusteNeutro(a)).length;
}

export const prender = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Uma casa decimal: 0,1% da largura é ~1px no PNG de 1080 — precisão de sobra. */
export const arredondar = (v: number) => Math.round(v * 10) / 10;
