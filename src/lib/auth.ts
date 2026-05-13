export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("token")
}

export function getUser(): { id: number; nome: string; is_admin: boolean } | null {
  if (typeof window === "undefined") return null
  const token = localStorage.getItem("token")
  if (!token) return null
  return {
    id: Number(localStorage.getItem("id")),
    nome: localStorage.getItem("nome") ?? "",
    is_admin: localStorage.getItem("is_admin") === "true",
  }
}

export function isAdmin(): boolean {
  return getUser()?.is_admin === true
}

export function saveAuth(data: {
  access_token: string
  nome: string
  id: number
  is_admin: boolean
}) {
  localStorage.setItem("token", data.access_token)
  localStorage.setItem("nome", data.nome)
  localStorage.setItem("id", String(data.id))
  localStorage.setItem("is_admin", String(data.is_admin))
}

export function clearAuth() {
  ;["token", "nome", "id", "is_admin", "pf_auth"].forEach((k) =>
    localStorage.removeItem(k)
  )
}
