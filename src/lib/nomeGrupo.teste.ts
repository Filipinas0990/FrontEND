import { combinaComFarmacia, tokens } from "./nomeGrupo"

const SANTA_CURA = { nome: "DROGARIA SANTA CURA LIMITADA", nome_fachada: "Drogaria Santa Cura" }
const BARROS     = { nome: "BARROS E SILVA COMERCIO DE MEDICAMENTOS LTDA - DROGARIA BEM ESTAR", nome_fachada: null }

const casos: [string, { nome: string; nome_fachada?: string | null }, boolean, string][] = [
  // o incidente: grupos de OUTRAS farmácias que vinham marcados
  ["Santa Rita Ofertas",            SANTA_CURA, false, "outra farmácia (só 'santa' em comum)"],
  ["Grupo Santa Monica",            SANTA_CURA, false, "outra farmácia"],
  ["Farmacia Santa Cruz - Clientes",SANTA_CURA, false, "outra farmácia"],
  ["Drogaria Santa Isabel",         SANTA_CURA, false, "outra farmácia"],
  ["Ofertas Cura Farma",            SANTA_CURA, false, "só 'cura' em comum"],
  // os que TÊM de continuar marcando
  ["Ofertas Drogaria Santa Cura",   SANTA_CURA, true,  "o grupo do cliente"],
  ["SANTA CURA - CLIENTES",         SANTA_CURA, true,  "maiúsculas"],
  ["Grupo Santa Cura Promoções",    SANTA_CURA, true,  "com palavra genérica no meio"],
  ["santa cura",                    SANTA_CURA, true,  "minúsculas, sem enfeite"],
  // sem fachada cai na razão social: o seguro é não marcar
  ["Ofertas Drogaria Bem Estar",    BARROS,     false, "sem fachada, razão social não casa"],
  ["Barros e Silva Ofertas",        BARROS,     false, "faltam tokens da razão social"],
]

let falhas = 0
for (const [grupo, farmacia, esperado, porque] of casos) {
  const obtido = combinaComFarmacia(grupo, farmacia)
  const ok = obtido === esperado
  if (!ok) falhas++
  console.log(`${ok ? "ok    " : "FALHOU"} ${esperado ? "marca " : "ignora"} "${grupo}" — ${porque}`)
}

console.log(`\ntokens("DROGARIA SANTA CURA LIMITADA") = ${JSON.stringify(tokens("DROGARIA SANTA CURA LIMITADA"))}`)
console.log(falhas === 0 ? "Todos passaram." : `${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)
