// O token de sessão vive num cookie httpOnly que o backend grava no login:
// o JavaScript da página não o enxerga, e o navegador o envia sozinho em todo
// pedido para /api (fetch, <img src>, EventSource). Aqui fica só o que a
// interface precisa mostrar — nome, id e se é admin. Isso NÃO é credencial:
// quem decide o acesso é o backend, que confere a sessão em cada pedido.

const CHAVE_USUARIO = "pf_usuario"

export interface UsuarioLogado {
  id: number
  nome: string
  is_admin: boolean
}

export function getUser(): UsuarioLogado | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(CHAVE_USUARIO)
    return raw ? (JSON.parse(raw) as UsuarioLogado) : null
  } catch {
    return null
  }
}

/** Há uma sessão aberta neste navegador? Se o cookie expirou, o primeiro 401 limpa tudo. */
export function estaLogado(): boolean {
  return getUser() !== null
}

export function isAdmin(): boolean {
  return getUser()?.is_admin === true
}

export function saveAuth(data: UsuarioLogado) {
  localStorage.setItem(
    CHAVE_USUARIO,
    JSON.stringify({ id: data.id, nome: data.nome, is_admin: data.is_admin }),
  )
}

export function clearAuth() {
  // "token", "nome", "id", "is_admin" e "pf_auth" são do formato antigo — saem também
  ;[CHAVE_USUARIO, "token", "nome", "id", "is_admin", "pf_auth"].forEach((k) =>
    localStorage.removeItem(k)
  )
}
