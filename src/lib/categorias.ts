/**
 * Categorias do banco de imagens.
 *
 * ESPELHO de Automa-o-Relatorio/pharmaflow-node/src/catalogo/categorias.ts.
 * Os dois projetos são pacotes separados e não compartilham import, então a
 * lista vive duplicada de propósito. Mexeu aqui, mexa lá — o backend valida o
 * slug e devolve 400 para o que não conhece.
 *
 * O banco guarda o slug; o rótulo é só apresentação.
 */

export const CATEGORIAS = [
  "higiene-beleza",
  "dermocosmeticos",
  "medicamentos",
  "mamae-bebe",
  "vitaminas",
  "cuidado-pessoal",
  "sazonais",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export const ROTULOS: Record<Categoria, string> = {
  "higiene-beleza": "Higiene e Beleza",
  "dermocosmeticos": "Dermocosméticos",
  "medicamentos": "Medicamentos (MIP)",
  "mamae-bebe": "Mamãe e Bebê",
  "vitaminas": "Vitaminas e Suplementos",
  "cuidado-pessoal": "Cuidado Pessoal",
  "sazonais": "Sazonais / Datas",
};

/** Rótulo de um slug vindo do banco, tolerante a valor desconhecido/NULL. */
export function rotuloCategoria(slug: string | null | undefined): string {
  if (!slug) return "Sem categoria";
  return ROTULOS[slug as Categoria] ?? slug;
}

/**
 * Valor usado nos filtros para "produtos que ninguém classificou ainda".
 * Não é uma categoria de verdade — no banco esses produtos são NULL.
 */
export const SEM_CATEGORIA = "__sem__";
