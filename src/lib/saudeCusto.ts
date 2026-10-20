// Saúde do cliente pelo custo por conversa no WhatsApp (Meta Ads).
// Faixas definidas pelo dono em 20/10/2026:
//   até R$ 7,00          → Saudável (verde)
//   até R$ 10,00         → Atenção  (amarelo)
//   acima de R$ 10,00    → Crítico  (vermelho)
// Gastou e não teve nenhuma conversa também é Crítico.

export type NivelSaude = "saudavel" | "atencao" | "critico" | "sem_dados"

export const LIMITE_SAUDAVEL = 7
export const LIMITE_ATENCAO = 10

/** Custo que enche a barra inteira — acima disso ela fica cheia. */
const CUSTO_BARRA_CHEIA = 15

export function nivelSaude(j: { custo_por_resultado: number | null; gasto: number } | null | undefined): NivelSaude {
  if (!j) return "sem_dados"
  if (j.custo_por_resultado == null) return j.gasto > 0 ? "critico" : "sem_dados"
  if (j.custo_por_resultado <= LIMITE_SAUDAVEL) return "saudavel"
  if (j.custo_por_resultado <= LIMITE_ATENCAO) return "atencao"
  return "critico"
}

/** Quanto da barra pintar (0 a 1). Sem resultado com gasto = cheia. */
export function preenchimentoBarra(j: { custo_por_resultado: number | null; gasto: number } | null | undefined): number {
  if (!j) return 0
  if (j.custo_por_resultado == null) return j.gasto > 0 ? 1 : 0
  return Math.min(1, Math.max(0, j.custo_por_resultado / CUSTO_BARRA_CHEIA))
}

export const ESTILO_SAUDE: Record<NivelSaude, { rotulo: string; selo: string; barra: string; texto: string }> = {
  saudavel:  { rotulo: "Saudável",  selo: "bg-emerald-50 text-emerald-700 ring-emerald-600/15", barra: "bg-emerald-600", texto: "text-zinc-800" },
  atencao:   { rotulo: "Atenção",   selo: "bg-amber-50 text-amber-700 ring-amber-600/20",       barra: "bg-amber-500",   texto: "text-amber-700" },
  critico:   { rotulo: "Crítico",   selo: "bg-red-50 text-red-700 ring-red-600/15",             barra: "bg-red-600",     texto: "text-red-600" },
  sem_dados: { rotulo: "Sem dados", selo: "bg-zinc-50 text-zinc-400 ring-zinc-300/40",          barra: "bg-zinc-300",    texto: "text-zinc-400" },
}
