/**
 * Rodízio de produtos no disparo repetido.
 *
 * Um disparo que se repete NÃO manda a lista inteira em cada postagem: leva um
 * lote de PRODUTOS_POR_ENVIO produtos, e o envio seguinte continua de onde
 * parou, dando a volta quando a lista acaba. Quem executa isso é o backend
 * (`fatiarRodizio`, em `src/disparos/service.ts`) — aqui é só para a tela
 * conseguir explicar ao gestor o que vai acontecer.
 *
 * O número é regra do sistema e de propósito não tem campo na tela (decisão do
 * dono, 09/09/2026). Se um dia virar configurável, ele passa a vir do disparo e
 * esta constante morre — mas tem que mudar nos DOIS repos junto.
 */
export const PRODUTOS_POR_ENVIO = 3;

/**
 * Frase que descreve a distribuição dos produtos na revisão do disparo.
 *
 * Envio único manda tudo de uma vez (fatiar deixaria produto sem sair nunca), e
 * lista curta cabe inteira numa postagem — nos dois casos não há rodízio a
 * explicar e a frase sai só com a contagem.
 */
export function descreverRodizio(totalProdutos: number, repete: boolean): string {
  const contagem = `${totalProdutos} produto(s)`;
  if (!repete || totalProdutos <= PRODUTOS_POR_ENVIO) return contagem;

  const postagens = Math.ceil(totalProdutos / PRODUTOS_POR_ENVIO);
  return `${contagem} — ${PRODUTOS_POR_ENVIO} por postagem, em rodízio (a lista fecha a volta em ${postagens} postagens e recomeça)`;
}
