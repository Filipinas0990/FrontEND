import { clearAuth, getToken } from "./auth"

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) ?? "http://localhost:8000"

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }
  if (token) headers["Authorization"] = `Bearer ${token}`
  if (!headers["Content-Type"] && options.method !== "GET" && options.method !== undefined) {
    headers["Content-Type"] = "application/json"
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    clearAuth()
    if (typeof window !== "undefined") window.location.href = "/login"
    throw new ApiError(401, "Não autorizado")
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body.detail ?? "Erro no servidor")
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface LoginResponse {
  access_token: string
  token_type: string
  id: number
  nome: string
  email: string
  is_admin: boolean
}

export interface AuthUser {
  id: number
  nome: string
  email: string
  is_admin: boolean
}

export interface CanalData {
  nome: string
  atendimentos: number
  vendas?: number
  receita_vendas?: number
}

export interface PainelData {
  receita_total: number
  total_atendimentos: number
  vendas_realizadas: number
  farmacias_ativas: number
  farmacias_alerta: number
  farmacias_atencao: number
  taxa_conversao_media: number
  ultima_atualizacao: string
}

export interface Farmacia {
  id: number
  nome: string
  status: string
  nivel_alerta: "verde" | "amarelo" | "vermelho"
  gestor_id: number | null
  receita_total: number
  total_atendimentos: number
  atendimentos_finalizados: number
  vendas_realizadas: number
  taxa_conversao: number
  variacao_receita: number
  variacao_atendimentos: number
  variacao_vendas: number
  score_criticidade: number
  posicao_ranking: number
  periodo_inicio: string
  periodo_fim: string
  data_coleta: string
  canais?: CanalData[]
  meta_vendas: number | null
  meta_receita: number | null
  meta_leads_google: number | null
  meta_leads_meta: number | null
  atingiu_meta: boolean | null
  percentual_meta_receita: number | null
  percentual_meta_vendas: number | null
}

export interface RankingGestor {
  posicao: number
  gestor_id: number
  gestor_nome: string
  total_farmacias: number
  farmacias_com_meta: number
  farmacias_meta_ok: number
  pontos: number
  taxa_acerto: number
  percentual_medio_meta: number
  tem_meta: boolean
  receita_total: number
  vendas_total: number
  meta_receita_total: number | null
  meta_vendas_total: number | null
}

/** Snapshot de uma farmácia para um período específico (retornado por /api/farmacias?dias=X) */
export type FarmaciaSnapshot = Farmacia & { periodo_dias?: 7 | 15 | 30 }

export interface FarmaciaEvolucao {
  semana_numero: number
  farmacia_id: number
  receita_total: number
  total_atendimentos: number
  atendimentos_finalizados: number
  vendas_realizadas: number
  score_criticidade: number
  nivel_alerta: string
  variacao_receita: number
  variacao_vendas: number
}

export interface Gestor {
  id: number
  nome: string
  email: string
  is_admin: boolean
  criado_em: string
  farmacias: number
}

export interface Relatorio {
  id: number
  label: string
  periodo_inicio: string
  periodo_fim: string
  data_geracao: string
  farmacias: string
  status: "Concluido" | "Parcial" | "Erro"
}

export interface PipelineStatus {
  pipeline_rodando: boolean
  timestamp: string
}

// ── Auth ───────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<LoginResponse> {
  const body = new URLSearchParams({ username: email, password })
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })
  if (res.status === 401) throw new ApiError(401, "Email ou senha incorretos")
  if (res.status === 403) throw new ApiError(403, "Usuário inativo")
  if (!res.ok) {
    const b = await res.json().catch(() => ({}))
    throw new ApiError(res.status, b.detail ?? "Erro ao fazer login")
  }
  return res.json()
}

export function getMe(): Promise<AuthUser> {
  return req("/api/auth/me")
}

export async function criarSuperAdmin(data: {
  nome: string
  email: string
  senha: string
  admin_secret: string
}): Promise<AuthUser> {
  const res = await fetch(`${BASE_URL}/api/auth/criar-super-admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const b = await res.json().catch(() => ({}))
    throw new ApiError(res.status, b.detail ?? "Erro ao criar admin")
  }
  return res.json()
}

// ── Painel ─────────────────────────────────────────────────────────────────

export function getPainel(gestorId?: number, dias?: 7 | 15 | 30): Promise<PainelData> {
  const q = new URLSearchParams()
  if (gestorId) q.set("gestor_id", String(gestorId))
  if (dias)     q.set("dias", String(dias))
  const qs = q.toString()
  return req(`/api/painel${qs ? `?${qs}` : ""}`)
}

// ── Farmácias ──────────────────────────────────────────────────────────────

export function getFarmacias(params?: {
  gestor_id?: number
  status?: string
  busca?: string
  dias?: 7 | 15 | 30
}): Promise<Farmacia[]> {
  const q = new URLSearchParams()
  if (params?.gestor_id) q.set("gestor_id", String(params.gestor_id))
  if (params?.status)    q.set("status", params.status)
  if (params?.busca)     q.set("busca", params.busca)
  if (params?.dias)      q.set("dias", String(params.dias))
  const qs = q.toString()
  return req(`/api/farmacias${qs ? `?${qs}` : ""}`)
}

export function getFarmaciaEvolucao(id: number): Promise<FarmaciaEvolucao[]> {
  return req(`/api/farmacias/${id}/evolucao`)
}

export function getFarmaciaEvolucaoPorPeriodo(id: number, dias: 7 | 15 | 30): Promise<FarmaciaEvolucao[]> {
  return req(`/api/farmacias/${id}/evolucao?dias=${dias}`)
}

export function createFarmacia(data: {
  nome: string
  url_base: string
  email: string
  senha: string
  gestor_id?: number
}): Promise<{ id: number; nome: string; gestor_id: number | null }> {
  return req("/api/farmacias", { method: "POST", body: JSON.stringify(data) })
}

export function updateFarmacia(
  id: number,
  data: Partial<{ nome: string; gestor_id: number | null; ativa: boolean; url_base: string; email: string; senha: string }>,
): Promise<{ id: number; nome: string; ativa: boolean }> {
  return req(`/api/farmacias/${id}`, { method: "PUT", body: JSON.stringify(data) })
}

export function deleteFarmacia(id: number): Promise<{ mensagem: string }> {
  return req(`/api/farmacias/${id}`, { method: "DELETE" })
}

export function setFarmaciaMeta(
  id: number,
  data: {
    meta_vendas?: number | null
    meta_receita?: number | null
    meta_leads_google?: number | null
    meta_leads_meta?: number | null
  },
): Promise<{ id: number; nome: string; meta_vendas: number | null; meta_receita: number | null; meta_leads_google: number | null; meta_leads_meta: number | null }> {
  return req(`/api/farmacias/${id}/meta`, { method: "PATCH", body: JSON.stringify(data) })
}

export function getRankingGestores(mes?: string): Promise<RankingGestor[]> {
  const q = mes ? `?mes=${mes}` : ""
  return req(`/api/ranking/gestores${q}`)
}

export interface RankingHistoricoEntry {
  mes: string
  gestor_id: number
  gestor_nome: string
  pontos: number
  taxa_acerto: number
  farmacias_meta_ok: number
  farmacias_com_meta: number
  percentual_medio_meta: number
}

export function getRankingHistorico(): Promise<RankingHistoricoEntry[]> {
  return req("/api/ranking/gestores/historico")
}

// ── Gestores ───────────────────────────────────────────────────────────────

export function getGestores(): Promise<Gestor[]> {
  return req("/api/gestores")
}

export function createGestor(data: {
  nome: string
  email: string
  senha: string
}): Promise<{ id: number; nome: string; email: string }> {
  return req("/api/gestores", { method: "POST", body: JSON.stringify(data) })
}

export function updateGestor(
  id: number,
  data: Partial<{ nome: string; email: string; senha: string }>,
): Promise<{ id: number; nome: string; email: string }> {
  return req(`/api/gestores/${id}`, { method: "PUT", body: JSON.stringify(data) })
}

export function deleteGestor(id: number): Promise<{ mensagem: string }> {
  return req(`/api/gestores/${id}`, { method: "DELETE" })
}

// ── Relatórios ─────────────────────────────────────────────────────────────

export function getRelatorios(): Promise<Relatorio[]> {
  return req("/api/relatorios")
}

async function _triggerDownload(url: string, filename: string): Promise<void> {
  const token = getToken()
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body.detail ?? "Erro ao baixar relatório")
  }
  const blob = await res.blob()
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(a.href)
}

export function downloadRelatorio(periodoInicio: string): Promise<void> {
  return _triggerDownload(
    `${BASE_URL}/api/relatorios/${periodoInicio}/xlsx`,
    `relatorio_${periodoInicio}.xlsx`,
  )
}

export function downloadRelatorioCSV(periodoInicio: string): Promise<void> {
  return _triggerDownload(
    `${BASE_URL}/api/relatorios/${periodoInicio}/csv`,
    `relatorio_${periodoInicio}.csv`,
  )
}

// ── Reuniões ───────────────────────────────────────────────────────────────

export type ReuniaoStatusAPI = "agendada" | "confirmada" | "realizada" | "cancelada"

export interface ReuniaoStats {
  reunioes_mes: number
  total_realizadas: number
  agendadas_futuras: number
  confirmadas_futuras: number
}

export interface ReuniaoAPI {
  id: number
  farmacia_id: number
  farmacia_nome: string
  gestor_nome: string
  titulo: string
  descricao: string | null
  data_reuniao: string          // ISO UTC
  duracao_minutos: number
  local: string
  link_meet: string | null
  status: ReuniaoStatusAPI
  google_event_id: string | null
  observacoes: string | null
  criado_em: string
  google_link: string           // link "TEMPLATE" do Google Calendar (sem OAuth)
}

export interface GoogleStatus {
  conectado: boolean
  google_configurado: boolean
}

export function getReuniaoStats(): Promise<ReuniaoStats> {
  return req("/api/reunioes/stats")
}

export function getReunioes(params?: {
  farmacia_id?: number
  status?: ReuniaoStatusAPI
  mes?: string              // "YYYY-MM"
}): Promise<ReuniaoAPI[]> {
  const q = new URLSearchParams()
  if (params?.farmacia_id) q.set("farmacia_id", String(params.farmacia_id))
  if (params?.status)      q.set("status", params.status)
  if (params?.mes)         q.set("mes", params.mes)
  const qs = q.toString()
  return req(`/api/reunioes${qs ? `?${qs}` : ""}`)
}

export function criarReuniaoAPI(data: {
  farmacia_id: number
  titulo: string
  descricao?: string
  data_reuniao: string    // ISO
  duracao_minutos?: number
  local?: string
  link_meet?: string
  gestor_id?: number
}): Promise<{ id: number; status: string; google_link: string; google_event_sincronizado: boolean }> {
  return req("/api/reunioes", { method: "POST", body: JSON.stringify(data) })
}

export function atualizarReuniaoAPI(
  id: number,
  data: Partial<{
    titulo: string
    descricao: string
    data_reuniao: string
    duracao_minutos: number
    local: string
    link_meet: string
  }>,
): Promise<ReuniaoAPI> {
  return req(`/api/reunioes/${id}`, { method: "PUT", body: JSON.stringify(data) })
}

export function confirmarReuniao(id: number): Promise<ReuniaoAPI> {
  return req(`/api/reunioes/${id}/confirmar`, { method: "PATCH" })
}

export function realizarReuniao(id: number, observacoes?: string): Promise<ReuniaoAPI> {
  return req(`/api/reunioes/${id}/realizar`, {
    method: "PATCH",
    body: JSON.stringify({ observacoes: observacoes ?? null }),
  })
}

export function cancelarReuniao(id: number): Promise<ReuniaoAPI> {
  return req(`/api/reunioes/${id}/cancelar`, { method: "PATCH" })
}

export function getGoogleLinkReuniao(id: number): Promise<{ link: string }> {
  return req(`/api/reunioes/${id}/google-link`)
}

export function syncGoogleCalendar(id: number): Promise<{ google_event_id: string; mensagem: string }> {
  return req(`/api/reunioes/${id}/sync-google`, { method: "POST" })
}

export function getGoogleStatus(): Promise<GoogleStatus> {
  return req("/api/auth/google/status")
}

export async function iniciarOAuthGoogle(): Promise<void> {
  // Busca a URL de autorização via fetch (token não aparece na barra do browser)
  const res = await req<{ url: string }>("/api/auth/google/url")
  if (!res?.url) throw new Error("URL de autenticação não retornada pelo servidor.")
  window.location.href = res.url
}

export function desconectarGoogleCalendar(): Promise<{ mensagem: string }> {
  return req("/api/auth/google", { method: "DELETE" })
}

// ── Pipeline ───────────────────────────────────────────────────────────────

export function getStatus(): Promise<PipelineStatus> {
  return fetch(`${BASE_URL}/api/status`).then((r) => r.json())
}

export function rodarAgora(): Promise<{ status: string; mensagem: string }> {
  return req("/api/rodar-agora", { method: "POST" })
}
