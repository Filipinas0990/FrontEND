/**
 * Categorias do banco de imagens — TEXTO LIVRE, digitado pelo gestor.
 *
 * Era lista fechada e virou campo aberto (migration 0030). Não existe mais
 * lista de slugs aqui: as categorias que aparecem nas telas são as que estão
 * de fato aplicadas a algum produto, vindas de `getCategoriasCatalogo()`.
 *
 * Quem impede "Higiene" e "higiene" de virarem dois chips é o backend, que ao
 * salvar reaproveita a grafia já cadastrada. Aqui só cuidamos de exibição.
 */

/**
 * Valor usado nos filtros para "produtos que ninguém classificou ainda".
 * Não é uma categoria — no banco esses produtos são NULL.
 */
export const SEM_CATEGORIA = "__sem__";

/** Como a categoria aparece na tela. Null/vazio vira o rótulo de ausência. */
export function rotuloCategoria(cat: string | null | undefined): string {
  return cat?.trim() ? cat : "Sem categoria";
}

/** Mesma chave de comparação do backend — sem acento, minúscula, sem espaço duplo. */
export function normalizarCategoria(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Categorias presentes numa lista de produtos, em ordem alfabética.
 *
 * Alfabética e não por quantidade: a barra de chips fica no mesmo lugar toda
 * vez que a tela abre. Ordenar por volume faria o chip pular de posição a cada
 * produto cadastrado, e o gestor perde a memória muscular.
 */
export function categoriasDe(
  produtos: Array<{ categoria?: string | null }>,
): { nomes: string[]; temSemCategoria: boolean } {
  const vistas = new Map<string, string>();
  let temSemCategoria = false;

  for (const p of produtos) {
    const cat = p.categoria?.trim();
    if (!cat) { temSemCategoria = true; continue; }
    const chave = normalizarCategoria(cat);
    if (!vistas.has(chave)) vistas.set(chave, cat);
  }

  return {
    nomes: [...vistas.values()].sort((a, b) => a.localeCompare(b, "pt-BR")),
    temSemCategoria,
  };
}
