/**
 * Testes de dia útil. O FrontEND não tem runner configurado:
 *   npx tsx src/lib/diaUtil.teste.ts
 */
import { ehFimDeSemana, nomeDoDia } from "./diaUtil"

let falhas = 0
const ok = (nome: string, cond: boolean, extra?: unknown) => {
  console.log(`${cond ? "ok    " : "FALHOU"} ${nome}`)
  if (!cond) { console.log("       ", extra); falhas++ }
}

// 11/09/2026 = sexta · 12 = sábado · 13 = domingo · 14 = segunda
ok("sexta não é fim de semana", ehFimDeSemana("2026-09-11") === false)
ok("sábado é", ehFimDeSemana("2026-09-12") === true)
ok("domingo é", ehFimDeSemana("2026-09-13") === true)
ok("segunda não é", ehFimDeSemana("2026-09-14") === false)

// A ARMADILHA: new Date("2026-09-12") é meia-noite UTC = sexta 21:00 no Brasil.
// Se o parse fosse por Date(texto), o sábado passaria batido.
ok("sábado continua sábado (não escorrega para sexta pelo fuso)",
   ehFimDeSemana("2026-09-12") === true && new Date("2026-09-12").getUTCDay() === 6)

// datetime-local (o campo do envio único manda data+hora)
ok("datetime-local de sábado é detectado", ehFimDeSemana("2026-09-12T08:00") === true)
ok("datetime-local de segunda passa", ehFimDeSemana("2026-09-14T08:00") === false)

// entrada vazia/inválida não pode travar a tela
ok("texto vazio não vira fim de semana", ehFimDeSemana("") === false)
ok("texto quebrado não vira fim de semana", ehFimDeSemana("abc") === false)

ok("nome do dia sai em português", nomeDoDia("2026-09-12").startsWith("s"), nomeDoDia("2026-09-12"))

console.log(falhas === 0 ? "\nTodos passaram." : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)
