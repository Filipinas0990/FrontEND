/**
 * Dia útil x fim de semana, para os campos de data do agendamento.
 *
 * Regra do dono (11/09/2026): disparo não sai em sábado nem domingo. O backend
 * também recusa, mas avisar na tela evita o gestor montar a campanha inteira
 * para levar erro no último clique.
 */

/**
 * Aceita "YYYY-MM-DD" (input date) ou "YYYY-MM-DDTHH:MM" (datetime-local).
 *
 * NÃO usa `new Date(texto)` com a data pura: "2026-09-12" é interpretado como
 * meia-noite UTC, o que no Brasil cai no dia ANTERIOR — um sábado passaria por
 * sexta e o aviso nunca apareceria. Por isso os números são lidos à mão e a
 * data é montada no fuso local do navegador, que é o fuso do gestor.
 */
export function ehFimDeSemana(texto: string): boolean {
  const [data] = texto.split("T")
  const [ano, mes, dia] = data.split("-").map(Number)
  if (!ano || !mes || !dia) return false

  const d = new Date(ano, mes - 1, dia)
  return d.getDay() === 0 || d.getDay() === 6
}

/** "sábado" / "domingo" — para a mensagem dizer qual dia foi escolhido. */
export function nomeDoDia(texto: string): string {
  const [data] = texto.split("T")
  const [ano, mes, dia] = data.split("-").map(Number)
  if (!ano || !mes || !dia) return ""
  return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR", { weekday: "long" })
}
