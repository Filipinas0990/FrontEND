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
 * Quantas postagens a lista rende. É o que decide quando a campanha se encerra
 * sozinha — a lista NÃO recomeça (regra do dono, 10/09/2026).
 */
export function postagensDaLista(totalProdutos: number): number {
  return Math.ceil(totalProdutos / PRODUTOS_POR_ENVIO);
}

/**
 * Frase que descreve a distribuição dos produtos na revisão do disparo.
 *
 * Envio único manda tudo de uma vez (fatiar deixaria produto sem sair nunca), e
 * lista curta cabe inteira numa postagem — nos dois casos não há rodízio a
 * explicar e a frase sai só com a contagem.
 *
 * `horariosPorDia` faz a conta virar dias, que é como o gestor pensa. Sem ele
 * (chamador que não sabe quantos horários estão marcados), a frase fica em
 * postagens.
 */
export function descreverRodizio(
  totalProdutos: number,
  repete: boolean,
  horariosPorDia?: number,
): string {
  const contagem = `${totalProdutos} produto(s)`;
  if (!repete || totalProdutos <= PRODUTOS_POR_ENVIO) return contagem;

  const postagens = postagensDaLista(totalProdutos);
  const duracao = horariosPorDia && horariosPorDia > 0
    ? `${postagens} postagens, cerca de ${Math.ceil(postagens / horariosPorDia)} dia(s)`
    : `${postagens} postagens`;

  return `${contagem} — ${PRODUTOS_POR_ENVIO} por postagem. A lista rende ${duracao} e a campanha encerra quando ela acabar (ou na data de término, o que vier primeiro)`;
}
