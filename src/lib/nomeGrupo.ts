/**
 * Casamento entre nome de grupo de WhatsApp e nome de farmácia.
 *
 * INCIDENTE 2026-08-21: a regra antiga marcava o grupo quando **um** token
 * batia. "DROGARIA SANTA CURA" tem o token "santa", então Santa Rita, Santa
 * Mônica e Santa Cruz — grupos de OUTRAS farmácias — vinham pré-marcados, e a
 * oferta de um cliente foi postada nos grupos dos outros.
 *
 * Regra nova: o grupo só é marcado quando carrega **todos** os tokens
 * distintivos do nome da farmácia. Na dúvida não marca nada — deixar o gestor
 * escolher na mão custa dez segundos; postar no grupo do cliente errado custa
 * o cliente.
 */

/** Palavras que não distinguem uma farmácia da outra. */
const PALAVRAS_GENERICAS = new Set([
  "farmacia", "farmacias", "drogaria", "drogarias", "grupo", "grupos",
  "oferta", "ofertas", "promocao", "promocoes", "whatsapp", "zap", "clientes",
  // formas jurídicas — aparecem na razão social e não identificam ninguém
  "ltda", "limitada", "eireli", "epp", "cia", "comercio", "medicamentos",
  "manipulacao", "filial", "matriz",
]);

/** Tokens úteis de um nome: sem acento, sem pontuação, sem palavra genérica. */
export function tokens(texto: string): string[] {
  return texto
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    .split(" ")
    .filter((t) => t.length >= 3 && !PALAVRAS_GENERICAS.has(t))
}

/**
 * true = o grupo é claramente daquela farmácia: TODOS os tokens distintivos do
 * nome dela aparecem no nome do grupo.
 */
export function combina(nomeGrupo: string, nomeFarmacia: string): boolean {
  const daFarmacia = tokens(nomeFarmacia)
  if (daFarmacia.length === 0) return false
  const doGrupo = new Set(tokens(nomeGrupo))
  return daFarmacia.every((t) => doGrupo.has(t))
}

/**
 * Casa pelo nome de fachada — é ele que dá nome ao grupo. A razão social só é
 * tentada quando não há fachada cadastrada, e como ela costuma ter vários
 * tokens ("BARROS E SILVA COMERCIO..."), o normal é não casar com nada, que é
 * o resultado seguro.
 */
export function combinaComFarmacia(
  nomeGrupo: string,
  f: { nome: string; nome_fachada?: string | null },
): boolean {
  const fachada = f.nome_fachada?.trim()
  return fachada ? combina(nomeGrupo, fachada) : combina(nomeGrupo, f.nome)
}
