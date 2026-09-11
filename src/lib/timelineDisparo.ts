import type { DisparoLog } from "@/lib/api"

/**
 * Reconstrói as POSTAGENS de um disparo a partir do log por grupo.
 *
 * `disparos_grupo_log` grava uma linha por grupo a cada envio, e **não existe
 * id de envio** na tabela — então a postagem é reconstruída pelo horário:
 * linhas próximas no tempo saíram na mesma leva.
 *
 * A janela é de 10 minutos por causa das duas pontas:
 * • para baixo, o envio é serial com 1,5s entre cada mensagem (antiban), então
 *   uma postagem com vários grupos e criativos se estica por minutos e não pode
 *   ser quebrada em várias;
 * • para cima, não há risco de colar postagens distintas — os horários
 *   pré-definidos ficam a pelo menos uma hora um do outro.
 *
 * Recebe e devolve do mais recente para o mais antigo, que é a ordem em que a
 * API entrega e a ordem em que a timeline é lida.
 */
export const JANELA_POSTAGEM_MS = 10 * 60 * 1000

export function agruparPostagens(logs: DisparoLog[]): DisparoLog[][] {
  const postagens: DisparoLog[][] = []

  for (const log of logs) {
    const atual = postagens[postagens.length - 1]
    const t = log.enviadoEm ? new Date(log.enviadoEm).getTime() : null
    const ultimo = atual?.[atual.length - 1]?.enviadoEm
    const tUltimo = ultimo ? new Date(ultimo).getTime() : null

    // Linha sem horário (registro antigo) não tem como ser encaixada por tempo:
    // entra na postagem corrente em vez de virar uma postagem fantasma sozinha.
    const mesmaLeva = atual !== undefined
      && (t === null || tUltimo === null || Math.abs(tUltimo - t) <= JANELA_POSTAGEM_MS)

    if (mesmaLeva) atual.push(log)
    else postagens.push([log])
  }

  return postagens
}
