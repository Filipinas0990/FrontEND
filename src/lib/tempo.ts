/**
 * Idade de um dado servido de cache, em português.
 *
 * Nasceu na tela de grupos e passou a ser usada também pelas contas de anúncio:
 * as duas listas vêm do cache do servidor e precisam dizer, no mesmo tom, de
 * quando é a lista que está na tela.
 *
 * "agora há pouco", "há 12 min", "há 3 h", "há 2 d".
 */
export function desde(iso: string | null): string | null {
  if (!iso) return null;
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1)  return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}
