import { nivelSaude, preenchimentoBarra, type NivelSaude } from "./saudeCusto"

const j = (custo: number | null, gasto = 100) => ({ custo_por_resultado: custo, gasto })

const casos: [string, ReturnType<typeof j> | null, NivelSaude][] = [
  ["R$ 4,78",                        j(4.78),        "saudavel"],
  ["exatamente R$ 7,00",             j(7),           "saudavel"],
  ["R$ 7,01",                        j(7.01),        "atencao"],
  ["R$ 9,43",                        j(9.43),        "atencao"],
  ["exatamente R$ 10,00 (o máximo)", j(10),          "atencao"],
  ["R$ 10,01",                       j(10.01),       "critico"],
  ["R$ 27,60",                       j(27.6),        "critico"],
  ["gastou sem nenhuma conversa",    j(null, 145.81), "critico"],
  ["não gastou nada",                j(null, 0),     "sem_dados"],
  ["sem leitura do Meta",            null,           "sem_dados"],
]

let falhas = 0
for (const [porque, janela, esperado] of casos) {
  const obtido = nivelSaude(janela)
  const ok = obtido === esperado
  if (!ok) falhas++
  console.log(`${ok ? "ok    " : "FALHOU"} ${porque} → ${obtido}${ok ? "" : ` (esperado ${esperado})`}`)
}

const barras: [string, number, number][] = [
  ["R$ 7,50 enche metade",          preenchimentoBarra(j(7.5)),        0.5],
  ["acima de R$ 15 fica cheia",     preenchimentoBarra(j(40)),         1],
  ["gastou sem conversa fica cheia", preenchimentoBarra(j(null, 50)),  1],
  ["sem dados fica vazia",          preenchimentoBarra(null),          0],
]
for (const [porque, obtido, esperado] of barras) {
  const ok = Math.abs(obtido - esperado) < 1e-9
  if (!ok) falhas++
  console.log(`${ok ? "ok    " : "FALHOU"} barra: ${porque} → ${obtido}`)
}

console.log(falhas === 0 ? "Todos passaram." : `${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)
