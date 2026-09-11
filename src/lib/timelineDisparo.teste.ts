/**
 * Testes do agrupamento da timeline. O FrontEND não tem runner configurado:
 *   npx tsx src/lib/timelineDisparo.teste.ts
 */
import { agruparPostagens } from "./timelineDisparo"
import type { DisparoLog } from "./api"

let falhas = 0
function ok(nome: string, condicao: boolean, extra?: unknown) {
  console.log(`${condicao ? "ok    " : "FALHOU"} ${nome}`)
  if (!condicao) { console.log("       ", JSON.stringify(extra)); falhas++ }
}

/** Uma linha de log: grupo G no instante `min` minutos depois da base. */
const base = new Date("2026-09-11T08:00:00-03:00").getTime()
let seq = 0
const log = (grupo: string, min: number, status: "ok" | "erro" = "ok"): DisparoLog => ({
  id: ++seq,
  disparoId: 1,
  grupoJid: `${grupo}@g.us`,
  grupoNome: grupo,
  status,
  erro: status === "erro" ? "falha simulada" : null,
  enviadoEm: new Date(base + min * 60_000).toISOString(),
})

const nomes = (p: DisparoLog[][]) => p.map((post) => post.map((l) => l.grupoNome))

// A API devolve do mais recente para o mais antigo — é assim que chega aqui.
{
  const p = agruparPostagens([log("g2", 0), log("g1", -0.05)])
  ok("dois grupos com segundos de diferença = UMA postagem",
     p.length === 1 && p[0].length === 2, nomes(p))
}

{
  // Antiban: 1,5s por mensagem estica uma postagem grande por minutos
  const p = agruparPostagens([log("g3", 0), log("g2", -3), log("g1", -6)])
  ok("postagem lenta (6 min de ponta a ponta) NÃO vira três postagens",
     p.length === 1 && p[0].length === 3, nomes(p))
}

{
  // Horários pré-definidos ficam a pelo menos 1h um do outro
  const p = agruparPostagens([log("g1", 0), log("g2", 0), log("g1", -600), log("g2", -600)])
  ok("dois horários do dia = DUAS postagens, 2 grupos cada",
     p.length === 2 && p[0].length === 2 && p[1].length === 2, nomes(p))
}

{
  const p = agruparPostagens([])
  ok("sem log nenhum devolve lista vazia", p.length === 0, p)
}

{
  const p = agruparPostagens([log("g1", 0, "erro")])
  ok("postagem só com falha continua sendo uma postagem",
     p.length === 1 && p[0][0].status === "erro", nomes(p))
}

{
  // Registro antigo, antes de enviado_em ter valor
  const semData: DisparoLog = { ...log("g2", 0), enviadoEm: null }
  const p = agruparPostagens([log("g1", 0), semData])
  ok("linha sem horário entra na postagem corrente, não vira postagem fantasma",
     p.length === 1 && p[0].length === 2, nomes(p))
}

{
  // A ordem dentro da postagem e entre elas tem que ser preservada
  const p = agruparPostagens([log("hoje", 0), log("ontem", -1440)])
  ok("mais recente primeiro, como a timeline é lida",
     p[0][0].grupoNome === "hoje" && p[1][0].grupoNome === "ontem", nomes(p))
}

console.log(falhas === 0 ? "\nTodos passaram." : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)
