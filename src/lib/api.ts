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

export interface AcaoAtiva {
  id: number
  nome: string
  tipo: string
  status: string
  cor: string | null
}

export interface Farmacia {
  id: number
  /** Razão social — nome jurídico, uso interno. */
  nome: string
  /** Nome de fachada — o que o cliente final vê. Null nos cadastros antigos. */
  nome_fachada: string | null
  fase: "entrada" | "ativo"
  telefone: string | null
  responsavel: string | null
  cidade: string | null
  status: string
  nivel_alerta: "verde" | "amarelo" | "vermelho"
  gestor_id: number | null
  tem_chatbot: boolean
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
  acoes_ativas?: AcaoAtiva[]
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

/**
 * Nome que pode aparecer para o cliente final da farmácia: o de fachada,
 * caindo na razão social enquanto o cadastro antigo não for completado.
 * Use em criativo, mensagem de grupo e link público — nunca a razão social.
 */
export function nomeVisivel(f: { nome: string; nome_fachada?: string | null }): string {
  return f.nome_fachada?.trim() || f.nome
}

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

export interface FarmaciaErro {
  nome:    string
  periodo: 7 | 15 | 30
  erro:    string
}

export interface UltimoResultado {
  executado_em:      string
  farmaciasTotais:   number
  totalSucessos:     number
  totalErros:        number
  farmaciasComErro:  FarmaciaErro[]
}

export interface PipelineStatus {
  pipeline_rodando:  boolean
  timestamp:         string
  ultimo_resultado:  UltimoResultado | null
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
  fase?: "entrada" | "ativo"
}): Promise<Farmacia[]> {
  const q = new URLSearchParams()
  if (params?.gestor_id) q.set("gestor_id", String(params.gestor_id))
  if (params?.status)    q.set("status", params.status)
  if (params?.busca)     q.set("busca", params.busca)
  if (params?.dias)      q.set("dias", String(params.dias))
  if (params?.fase)      q.set("fase", params.fase)
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
  nome_fachada: string
  fase?: "entrada" | "ativo"
  telefone?: string
  responsavel?: string
  cidade?: string
  tem_chatbot?: boolean
  url_base?: string
  email?: string
  senha?: string
  gestor_id?: number
}): Promise<{ id: number; nome: string; fase: string; gestor_id: number | null }> {
  return req("/api/farmacias", { method: "POST", body: JSON.stringify(data) })
}

export function updateFarmacia(
  id: number,
  data: Partial<{
    nome: string
    nome_fachada: string
    fase: "entrada" | "ativo"
    telefone: string | null
    responsavel: string | null
    cidade: string | null
    gestor_id: number | null
    ativa: boolean
    url_base: string
    email: string
    senha: string
  }>,
): Promise<{ id: number; nome: string; ativa: boolean }> {
  return req(`/api/farmacias/${id}`, { method: "PUT", body: JSON.stringify(data) })
}

export function ativarFarmacia(
  id: number,
  data: { url_base?: string; email?: string; senha?: string; gestor_id?: number },
): Promise<{ id: number; nome: string; fase: "ativo"; gestor_id: number | null; mensagem: string }> {
  return req(`/api/farmacias/${id}/ativar`, { method: "PATCH", body: JSON.stringify(data) })
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

export interface PipelinePreview {
  farmaciasTotais: number
  nomes: string[]
  periodos: number[]
  estimativa_segundos?: number
}

export function getStatus(): Promise<PipelineStatus> {
  return fetch(`${BASE_URL}/api/status`).then((r) => r.json())
}

export function getPreviewPipeline(
  periodos?: number[],
  gestor_id?: number,
): Promise<PipelinePreview> {
  const params = new URLSearchParams()
  if (periodos?.length) params.set("periodos", periodos.join(","))
  if (gestor_id != null) params.set("gestor_id", String(gestor_id))
  const qs = params.toString()
  return req(`/api/rodar-agora/preview${qs ? `?${qs}` : ""}`)
}

export function rodarAgora(opts?: {
  periodos?: number[]
  gestor_id?: number
}): Promise<{ status: string; mensagem: string }> {
  return req("/api/rodar-agora", {
    method: "POST",
    ...(opts ? { body: JSON.stringify(opts) } : {}),
  })
}

// ── Agenda / Conflitos ─────────────────────────────────────────────────────

export interface ResultadoConflito {
  conflito: boolean
  tipo?: "sobreposicao" | "bloqueio"
  detalhe?: string
  reuniao_conflitante?: {
    id: number
    titulo: string
    data_reuniao: string
    duracao_minutos: number
  }
}

export interface SlotDisponivel {
  hora: string
  disponivel: boolean
}

export interface BloqueioAgenda {
  id: number
  data: string
  dia_inteiro: boolean
  hora_inicio: string | null
  hora_fim: string | null
  motivo: string | null
}

export interface DisponibilidadeResponse {
  data: string
  disponivel: boolean
  conflito: ResultadoConflito
  dia_bloqueado: boolean
  reunioes_dia: Array<Pick<ReuniaoAPI, "id" | "titulo" | "data_reuniao" | "duracao_minutos" | "status" | "farmacia_nome">>
  bloqueios: BloqueioAgenda[]
  slots: SlotDisponivel[]
}

export interface CalendarioDia {
  data: string
  reunioes: { total: number; realizadas: number; confirmadas: number; agendadas: number }
  bloqueado: boolean
  bloqueio: { motivo: string | null; hora_inicio: string | null; hora_fim: string | null } | null
}

export interface CalendarioResponse {
  mes: string
  dias: CalendarioDia[]
}

export function verificarConflitoAgenda(
  dataISO: string,
  duracao: number,
  reuniaoId?: number,
): Promise<ResultadoConflito> {
  const q = new URLSearchParams({ data: dataISO, duracao: String(duracao) })
  if (reuniaoId) q.set("reuniao_id", String(reuniaoId))
  return req(`/api/agenda/verificar?${q}`)
}

export function getDisponibilidade(
  data: string,
  params?: { hora?: string; duracao?: number },
): Promise<DisponibilidadeResponse> {
  const q = new URLSearchParams({ data })
  if (params?.hora)    q.set("hora", params.hora)
  if (params?.duracao) q.set("duracao", String(params.duracao))
  return req(`/api/agenda/disponibilidade?${q}`)
}

export function getCalendario(mes: string): Promise<CalendarioResponse> {
  return req(`/api/agenda/calendario?mes=${mes}`)
}

export function criarBloqueio(data: {
  data: string
  dia_inteiro: boolean
  hora_inicio?: string
  hora_fim?: string
  motivo?: string
}): Promise<BloqueioAgenda & { mensagem: string }> {
  return req("/api/agenda/bloqueios", { method: "POST", body: JSON.stringify(data) })
}

export function listarBloqueios(mes?: string): Promise<BloqueioAgenda[]> {
  const q = mes ? `?mes=${mes}` : ""
  return req(`/api/agenda/bloqueios${q}`)
}

export function removerBloqueio(id: number): Promise<{ mensagem: string }> {
  return req(`/api/agenda/bloqueios/${id}`, { method: "DELETE" })
}

// ── Ações de Marketing ─────────────────────────────────────────────────────

export type AcaoStatus = "planejada" | "em_andamento" | "concluida" | "cancelada"

export interface AcaoMarketing {
  id: number
  nome: string
  tipo: string
  descricao: string | null
  mes_referencia: string
  status: AcaoStatus
  cor: string | null
  criado_por_id: number | null
  criado_por_nome: string | null
  criado_em: string
  atualizado_em: string
  total_farmacias: number
}

export interface ParticipacaoFarmacia {
  participacao_id: number
  farmacia_id: number
  farmacia_nome: string
  cidade: string | null
  responsavel: string | null
  telefone: string | null
  gestor_id: number | null
  gestor_nome: string | null
  nivel_alerta: string
  observacoes: string | null
  adicionado_em: string
}

export interface AcaoDetalhe extends AcaoMarketing {
  farmacias: ParticipacaoFarmacia[]
}

export interface AcaoResumo {
  mes: string
  total_acoes: number
  farmacias_com_acao: number
  por_status: {
    planejadas: number
    em_andamento: number
    concluidas: number
    canceladas: number
  }
  por_tipo: { tipo: string; quantidade: number }[]
  acoes: {
    id: number
    nome: string
    tipo: string
    status: AcaoStatus
    cor: string | null
    total_farmacias: number
  }[]
}

export interface AcaoFarmaciaEntry extends AcaoMarketing {
  observacoes: string | null
  adicionado_em: string
}

export function getAcoes(params?: { mes?: string; status?: string; tipo?: string }): Promise<AcaoMarketing[]> {
  const q = new URLSearchParams()
  if (params?.mes) q.set("mes", params.mes)
  if (params?.status) q.set("status", params.status)
  if (params?.tipo) q.set("tipo", params.tipo)
  const qs = q.toString()
  return req(`/api/acoes${qs ? `?${qs}` : ""}`)
}

export function getAcaoResumo(mes?: string): Promise<AcaoResumo> {
  const q = mes ? `?mes=${mes}` : ""
  return req(`/api/acoes/resumo${q}`)
}

export function criarAcao(data: {
  nome: string
  tipo: string
  descricao?: string
  mes_referencia: string
  status?: AcaoStatus
  cor?: string
}): Promise<AcaoMarketing> {
  return req("/api/acoes", { method: "POST", body: JSON.stringify(data) })
}

export function getAcao(id: number): Promise<AcaoDetalhe> {
  return req(`/api/acoes/${id}`)
}

export function editarAcao(
  id: number,
  data: Partial<{
    nome: string
    tipo: string
    descricao: string | null
    mes_referencia: string
    status: AcaoStatus
    cor: string | null
  }>,
): Promise<AcaoMarketing> {
  return req(`/api/acoes/${id}`, { method: "PUT", body: JSON.stringify(data) })
}

export function cancelarAcaoMarketing(id: number): Promise<{ mensagem: string; id: number }> {
  return req(`/api/acoes/${id}`, { method: "DELETE" })
}

export function adicionarFarmaciasAcao(
  id: number,
  data: { farmacia_ids: number[]; observacoes?: string },
): Promise<{ mensagem: string; adicionadas: number; total_farmacias: number }> {
  return req(`/api/acoes/${id}/farmacias`, { method: "POST", body: JSON.stringify(data) })
}

export function removerFarmaciaAcao(id: number, farmaciaId: number): Promise<{ mensagem: string }> {
  return req(`/api/acoes/${id}/farmacias/${farmaciaId}`, { method: "DELETE" })
}

export function atualizarObservacoesAcao(
  id: number,
  farmaciaId: number,
  observacoes: string | null,
): Promise<{ mensagem: string }> {
  return req(`/api/acoes/${id}/farmacias/${farmaciaId}`, {
    method: "PATCH",
    body: JSON.stringify({ observacoes }),
  })
}

export function getAcoesForFarmacia(farmaciaId: number, mes?: string): Promise<AcaoFarmaciaEntry[]> {
  const q = mes ? `?mes=${mes}` : ""
  return req(`/api/farmacias/${farmaciaId}/acoes${q}`)
}

// ── Gerenciador de Reuniões ────────────────────────────────────────────────

export interface GerenciadorReuniaoItem {
  id: number
  titulo: string
  data_reuniao: string
  duracao_minutos: number
  status: ReuniaoStatusAPI
  observacoes: string | null
  gestor_id: number | null
  gestor_nome: string | null
}

export interface GerenciadorFarmaciaCom {
  farmacia_id: number
  farmacia_nome: string
  cidade: string | null
  responsavel: string | null
  telefone: string | null
  gestor_id: number | null
  gestor_nome: string | null
  nivel_alerta: string
  total_reunioes: number
  realizadas: number
  confirmadas: number
  agendadas: number
  reunioes: GerenciadorReuniaoItem[]
}

export interface GerenciadorFarmaciaSem {
  farmacia_id: number
  farmacia_nome: string
  cidade: string | null
  responsavel: string | null
  telefone: string | null
  gestor_id: number | null
  gestor_nome: string | null
  nivel_alerta: string
}

export interface GerenciadorMensal {
  mes: string
  total_farmacias_ativas: number
  farmacias_com_reuniao: number
  farmacias_sem_reuniao: number
  taxa_cobertura: number
  com_reuniao: GerenciadorFarmaciaCom[]
  sem_reuniao: GerenciadorFarmaciaSem[]
}

export interface CoberturaHistoricoMes {
  mes: string
  total_farmacias: number
  farmacias_com_reuniao: number
  farmacias_sem_reuniao: number
  taxa_cobertura: number
  total_reunioes: number
  realizadas: number
  confirmadas: number
  agendadas: number
}

export interface CoberturaMensal {
  total_farmacias_ativas: number
  historico: CoberturaHistoricoMes[]
}

export function getGerenciadorMensal(mes?: string): Promise<GerenciadorMensal> {
  const q = mes ? `?mes=${mes}` : ""
  return req(`/api/reunioes/gerenciador-mensal${q}`)
}

export function getCoberturaMensal(meses = 6): Promise<CoberturaMensal> {
  return req(`/api/reunioes/cobertura-mensal?meses=${meses}`)
}

// ── WhatsApp ────────────────────────────────────────────────────────────────

export interface WhatsAppStatus {
  conectado: boolean
  status: "open" | "connecting" | "close"
  instancia: string | null
  numero: string | null
  configurado: boolean
}

export interface WhatsAppConnectResponse {
  instancia: string
  status: "connecting"
  qr_code: string | null
}

export interface WhatsAppQrResponse {
  status: "open" | "connecting" | "close"
  qr_code: string | null
  instancia: string
}

export function getWhatsAppStatus(): Promise<WhatsAppStatus> {
  return req("/api/whatsapp/status")
}

export function connectWhatsApp(instance_name: string): Promise<WhatsAppConnectResponse> {
  return req("/api/whatsapp/connect", {
    method: "POST",
    body: JSON.stringify({ instance_name }),
  })
}

export function getWhatsAppQrCode(): Promise<WhatsAppQrResponse> {
  return req("/api/whatsapp/qrcode")
}

export function disconnectWhatsApp(): Promise<{ mensagem: string }> {
  return req("/api/whatsapp/disconnect", { method: "DELETE" })
}

export function deleteWhatsAppInstance(): Promise<{ mensagem: string }> {
  return req("/api/whatsapp/instance", { method: "DELETE" })
}

// ── Automação de Anúncios (Meta Ads) ──────────────────────────────────────────

export type CampanhaStatus =
  | "aguardando_confirmacao"
  | "publicada"
  | "cancelada"
  | "erro"

export interface CampanhaMeta {
  id:              number
  farmaciaId:      number
  farmaciaInfo:    string
  status:          CampanhaStatus
  clienteNome:     string | null
  objetivo:        string | null
  orcamentoDiario: number | null  // centavos
  dataInicio:      string | null
  dataFim:         string | null
  metaCampanhaId:  string | null
  criadoEm:        string
}

export function enviarMensagemAds(
  texto: string,
  imagem_base64?: string,
): Promise<{ resposta: string }> {
  return req("/api/ads/chat", {
    method: "POST",
    body: JSON.stringify({ texto, imagem_base64 }),
  })
}

export function getCampanhasMeta(): Promise<CampanhaMeta[]> {
  return req("/api/ads/campanhas")
}

export function cadastrarTokenMeta(data: {
  farmacia_id:   number
  access_token:  string
  ad_account_id: string
  page_id:       string
}): Promise<{ ok: boolean }> {
  return req("/api/ads/tokens", { method: "POST", body: JSON.stringify(data) })
}

// ── Contas de anúncios (Meta) ──────────────────────────────────────────────────

export interface ContaAnuncio {
  id: string          // "act_123456789"
  accountId: string   // "123456789"
  nome: string        // nome da conta de anúncio
  cliente: string     // nome do Business Manager dono
  moeda: string       // "BRL"
  status: string      // rótulo legível (Ativa, Desativada...)
  ativa: boolean
  temPagamento: boolean    // tem forma de pagamento configurada
  formaPagamento: string   // ex: "Saldo disponível (R$816,04 BRL)"
}

/** Lista TODAS as contas de anúncios acessíveis pelo token Meta do servidor. */
export function getContasAnuncio(): Promise<{ contas: ContaAnuncio[] }> {
  return req("/api/ads/contas")
}

// ── Publicação de campanha ─────────────────────────────────────────────────────

export interface PublicarCampanhaResultado {
  campanhaId: string
  conjuntoId: string
  anuncioId: string      // 1º anúncio
  anuncioIds: string[]   // todos os anúncios criados (um por criativo)
  linkGerenciador: string
  copyUsada: { textoPrincipal: string; titulo: string; descricao: string }
  avisos: string[]
}

/** Envia o JSON do wizard (+ PNGs) para criar a campanha ativa no Meta. */
export function publicarCampanha(payload: unknown): Promise<PublicarCampanhaResultado> {
  return req("/api/campanhas/criar", { method: "POST", body: JSON.stringify(payload) })
}

// ── Gerenciador de campanhas (leitura ao vivo do Meta + duplicação) ────────────

/** Conjunto (ad set) lido AO VIVO da conta de anúncios no Meta. */
export interface ConjuntoMeta {
  id: string
  nome: string
  campanhaId: string
  campanhaNome: string
  status: string            // rótulo legível ("Ativa", "Pausada"...)
  ativa: boolean
  orcamentoDiario: number   // em reais
  otimizacao: string
  idadeMin: number | null
  idadeMax: number | null
  genero: "todos" | "homens" | "mulheres"
  generos: string           // rótulo legível do campo acima
  destinoWhatsapp: boolean
  dataInicio: string        // YYYY-MM-DD ("" se não houver)
  dataFim: string           // YYYY-MM-DD ("" = sem término)
}

export interface NovosAnunciosResultado {
  conjuntoId: string
  anuncioIds: string[]
  linkGerenciador: string
  copyUsada: { textoPrincipal: string; titulo: string; descricao: string }
  avisos: string[]
}

/** Cria uma cópia do conjunto com as configs revisadas e os criativos novos. */
export function publicarNovosAnuncios(
  conjuntoId: string,
  payload: unknown,
): Promise<NovosAnunciosResultado> {
  return req(`/api/campanhas/conjuntos/${encodeURIComponent(conjuntoId)}/novos-anuncios`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

/** Todos os conjuntos (ad sets) da conta, direto do Meta — lista plana. */
export function getConjuntosDaConta(contaId: string): Promise<{ conjuntos: ConjuntoMeta[] }> {
  return req(`/api/campanhas/conjuntos?conta=${encodeURIComponent(contaId)}`)
}

// ── Catálogo de produtos (fluxo Criativos e Campanhas) ─────────────────────────

export interface ProdutoEntrada {
  nome: string
  preco?: string
}

export interface ProdutoIdentificado {
  nome: string
  preco: string
  status: "encontrado" | "nao_encontrado"
  imagem: string | null      // data URI pronta para <img src>
  catalogoId: number | null
}

/** Envia a lista lida da planilha e recebe cada produto casado com a imagem do catálogo. */
export function identificarCatalogo(
  produtos: ProdutoEntrada[],
): Promise<{ produtos: ProdutoIdentificado[] }> {
  return req("/api/catalogo/identificar", {
    method: "POST",
    body: JSON.stringify({ produtos }),
  })
}

/** Total de produtos no catálogo. */
export function getCatalogoStatus(): Promise<{ total: number }> {
  return req("/api/catalogo/status")
}

export interface CatalogoProdutoItem {
  id: number
  nome: string
  ativo: boolean
  /** Categoria digitada pelo gestor. Null = ninguém classificou ainda. */
  categoria: string | null
  criadoEm: string | null
}

/** Lista os produtos do catálogo (sem imagem). */
export function listarCatalogoProdutos(): Promise<{ produtos: CatalogoProdutoItem[] }> {
  return req("/api/catalogo/produtos")
}

/** Monta a URL da imagem de um produto (com token na query para usar em <img src>). */
export function catalogoImagemUrl(id: number): string {
  const token = getToken()
  return `${BASE_URL}/api/catalogo/produtos/${id}/imagem${token ? `?token=${token}` : ""}`
}

/** Cadastra/atualiza um produto do catálogo com sua imagem (base64 data URI ou puro). */
export function cadastrarCatalogoProduto(data: {
  nome: string
  imagem_b64: string
  mime?: string
  /** Categoria (texto livre). Omitir preserva a de um produto já existente. */
  categoria?: string | null
}): Promise<{ ok: boolean }> {
  return req("/api/catalogo/produtos", { method: "POST", body: JSON.stringify(data) })
}

export interface CategoriaCadastrada {
  id: number
  nome: string
  /** Produtos classificados nela agora. Zero = criada e ainda sem imagem. */
  total: number
  criadoEm: string | null
}

export interface CategoriasCatalogo {
  /** O cadastro completo, com a contagem de produtos de cada categoria. */
  categorias: CategoriaCadastrada[]
  /** Os mesmos nomes, em lista simples. Mantido por compatibilidade. */
  sugestoes: string[]
}

/**
 * Cadastro de categorias — alimenta a tela de Categorias e as sugestões dos
 * campos de classificação.
 *
 * Para CHIPS DE FILTRO não use esta lista: uma categoria recém-criada vem aqui
 * com total 0, e chip que não filtra nada é armadilha. Os chips saem do acervo
 * (`categoriasDe` em lib/categorias.ts).
 */
export function getCategoriasCatalogo(): Promise<CategoriasCatalogo> {
  return req("/api/catalogo/categorias")
}

/** Cria uma categoria vazia, antes de existir imagem nela. */
export function criarCategoria(nome: string): Promise<{ ok: true; categoria: CategoriaCadastrada }> {
  return req("/api/catalogo/categorias", { method: "POST", body: JSON.stringify({ nome }) })
}

/**
 * Renomeia a categoria e reclassifica os produtos que estavam nela.
 * `produtos` é quantos foram reescritos.
 */
export function renomearCategoria(
  id: number,
  nome: string,
): Promise<{ ok: true; categoria: CategoriaCadastrada; produtos: number }> {
  return req(`/api/catalogo/categorias/${id}`, { method: "PATCH", body: JSON.stringify({ nome }) })
}

/**
 * Exclui a categoria. Nenhuma imagem é apagada: os produtos dela ficam sem
 * categoria, e `produtos` diz quantos.
 */
export function excluirCategoria(id: number): Promise<{ ok: true; produtos: number }> {
  return req(`/api/catalogo/categorias/${id}`, { method: "DELETE" })
}

/**
 * Classifica vários produtos de uma vez (`categoria: null` limpa).
 * É o que torna viável organizar o acervo antigo, cadastrado sem categoria.
 */
export function setCatalogoProdutosCategoria(
  ids: number[],
  categoria: string | null,
): Promise<{ ok: boolean; total: number }> {
  return req("/api/catalogo/produtos/categoria", {
    method: "PATCH",
    body: JSON.stringify({ ids, categoria }),
  })
}

/** Liga/desliga um produto do catálogo (desligado não entra nos criativos). */
export function setCatalogoProdutoAtivo(id: number, ativo: boolean): Promise<{ ok: boolean; ativo: boolean }> {
  return req(`/api/catalogo/produtos/${id}`, { method: "PATCH", body: JSON.stringify({ ativo }) })
}

/** Remove um produto do catálogo. */
export function deletarCatalogoProduto(id: number): Promise<{ ok: boolean }> {
  return req(`/api/catalogo/produtos/${id}`, { method: "DELETE" })
}

// ── Disparo em Grupos de Ofertas (WhatsApp via Evolution) ─────────────────────
// Multi-tenant por GESTOR: cada gestor tem UMA conexão de WhatsApp e enxerga
// somente os grupos dela (os grupos de oferta dos clientes dele).

export type InstanciaStatus = "open" | "connecting" | "close"

export interface GrupoWhatsApp {
  jid: string
  nome: string
  participantes: number | null
}

/** Listagem de grupos + estado do cache que a serviu. */
export interface ListagemGrupos {
  grupos: GrupoWhatsApp[]
  /** ISO — quando o servidor sincronizou com a Evolution (null = sem conexão). */
  atualizadoEm: string | null
  /** true = tem refresh rodando no servidor; a lista pode mudar em instantes. */
  sincronizando: boolean
  /** Erro do último sync, com cache antigo ainda sendo exibido. */
  aviso: string | null
}

export interface StatusInstancia {
  instancia: string | null
  status: InstanciaStatus
  qr_code: string | null
  numero: string | null
  conectado: boolean
  configurado: boolean
}

/** Conexão que o gestor pode usar no disparo: a dele ou uma global. */
export interface ConexaoDisparo {
  instanceName: string
  nome: string
  tipo: "gestor" | "global"
  status: InstanciaStatus
  numero: string | null
}

export interface GrupoSelecionado {
  jid: string
  nome: string
}

export type RepetirDisparo = "nunca" | "diario" | "semanal" | "mensal"

/** Um criativo do disparo — um pedido de oferta gera vários. */
export interface MidiaDisparo {
  b64: string
  mime: string
  rotulo?: string
}

export interface CriarDisparoPayload {
  titulo: string
  mensagem: string
  midias?: MidiaDisparo[]
  /**
   * Produtos do catálogo que geraram os criativos. É só isso que permite
   * reconstruir depois o que foi anunciado — as mídias são PNG rasterizado e
   * não guardam o id do produto. Alimenta o filtro "Recentes" do passo 3.
   */
  produtos?: { id: number; nome: string }[]
  grupos: GrupoSelecionado[]
  quando: "agora" | "agendado"
  agendado_para?: string | null
  repetir?: RepetirDisparo
  /** Horários fixos do dia ("HH:MM"). Com 2 ou mais, o disparo sai em todos. */
  horarios?: string[]
  /** ISO — fim da repetição. Null = repete até o gestor cancelar. */
  repetir_ate?: string | null
  timezone?: string
  farmacia_id?: number | null
  solicitacao_id?: number | null
  instance?: string | null
  /** Ciência de que um grupo é de outro cliente. Sem isto a API recusa (409). */
  confirmar_grupo_de_outro_cliente?: boolean
}

export interface DisparoCriado {
  id: number
  status: string
  enviados?: number
  falhas?: number
  agendado_para?: string | null
  repetir?: RepetirDisparo
}

export interface DisparoResumo {
  id: number
  titulo: string
  mensagem: string
  total_midias: number
  farmacia_id: number | null
  total_grupos: number
  quando: string
  repetir: RepetirDisparo
  status: string
  agendado_para: string | null
  proximo_envio: string | null
  ultimo_envio: string | null
  criado_em: string
}

/** Cria/reconecta a instância Evolution do gestor logado e retorna o QR code. */
export function conectarMeuWhatsapp(): Promise<StatusInstancia> {
  return req("/api/disparos/whatsapp/conectar", { method: "POST" })
}

/** Status ao vivo da minha conexão (usado em polling durante o QR). */
export function getMeuWhatsappStatus(): Promise<StatusInstancia> {
  return req("/api/disparos/whatsapp/status")
}

/** Desconecta meu WhatsApp (logout na Evolution). */
export function desconectarMeuWhatsapp(): Promise<void> {
  return req("/api/disparos/whatsapp", { method: "DELETE" })
}

/** Conexões que posso usar no disparo (a minha + as globais). */
export function getConexoesDisparo(): Promise<ConexaoDisparo[]> {
  return req("/api/disparos/conexoes")
}

/**
 * Grupos da conexão escolhida (ou a minha, se `instance` vazio).
 * Vem do cache do servidor — instantâneo. `refresh` força buscar na Evolution
 * e aí sim espera (é o que o botão "Atualizar" usa).
 */
export function getMeusGrupos(instance?: string, refresh = false): Promise<ListagemGrupos> {
  const p = new URLSearchParams()
  if (instance) p.set("instance", instance)
  if (refresh) p.set("refresh", "1")
  const q = p.toString()
  return req(`/api/disparos/grupos${q ? `?${q}` : ""}`)
}

/** Farmácia que já recebeu disparo num grupo — o "dono" daquele grupo. */
export interface DonoDeGrupo {
  jid: string
  farmacia_id: number
  /** Nome visível (fachada, ou razão social quando não há fachada). */
  farmacia: string
}

/**
 * A quem cada grupo já pertenceu, pelo histórico de disparos do gestor.
 *
 * Existe por causa do incidente de 29/08: farmácia sem nome de fachada não
 * casa por nome com o grupo dela, a lista abre inteira e dá para marcar o
 * grupo do cliente errado. Nome falha; histórico não.
 */
export function getDonosDeGrupos(jids: string[]): Promise<DonoDeGrupo[]> {
  if (jids.length === 0) return Promise.resolve([])
  return req(`/api/disparos/donos-grupos?jids=${encodeURIComponent(jids.join(","))}`)
}

/** Horário pré-definido de disparo (Configurações → Horários de Disparo). */
export interface HorarioDisparo {
  id: number
  /** "HH:MM" */
  horario: string
  rotulo: string | null
}

/** Meus horários de agendamento (a 1ª chamada já cria os padrões). */
export function getHorariosDisparo(): Promise<HorarioDisparo[]> {
  return req("/api/disparos/horarios")
}

/** Adiciona um horário e devolve a lista já atualizada. */
export function criarHorarioDisparo(
  horario: string,
  rotulo?: string | null,
): Promise<HorarioDisparo[]> {
  return req("/api/disparos/horarios", {
    method: "POST",
    body: JSON.stringify({ horario, rotulo: rotulo ?? null }),
  })
}

export function removerHorarioDisparo(id: number): Promise<void> {
  return req(`/api/disparos/horarios/${id}`, { method: "DELETE" })
}

/** Cria o disparo (imediato ou agendado). */
export function criarDisparo(payload: CriarDisparoPayload): Promise<DisparoCriado> {
  return req("/api/disparos", { method: "POST", body: JSON.stringify(payload) })
}

/** Histórico de disparos das farmácias do gestor. */
export function getDisparos(): Promise<DisparoResumo[]> {
  return req("/api/disparos")
}

/** Cancela um disparo agendado. */
export function cancelarDisparo(id: number): Promise<void> {
  return req(`/api/disparos/${id}`, { method: "DELETE" })
}

export interface UltimosProdutosDisparados {
  produtos: { id: number; nome: string }[]
  /** ISO do disparo de onde saíram. Null = nunca houve disparo com o dado. */
  disparado_em: string | null
}

/**
 * Produtos anunciados na última campanha DESTE cliente.
 * Volta vazio para quem ainda não foi disparado depois da migration 0029 —
 * o dado não existia antes e não dá para reconstruir.
 */
export function getUltimosProdutosDisparados(farmaciaId: number): Promise<UltimosProdutosDisparados> {
  return req(`/api/disparos/ultimos-produtos/${farmaciaId}`)
}

// ── Ofertas enviadas pelo dono da farmácia ────────────────────────────────────
// O gestor manda um link com token; o dono abre SEM login e escolhe os produtos.

export interface ProdutoOferta {
  id: number
  nome: string
  /** Preço que o dono informou no link ("9,90"). Null = deixou para o gestor. */
  preco?: string | null
  /**
   * Categoria — só vem na vitrine do link público, para os chips de filtro.
   * As listas de pedido já enviado gravam {id, nome} e não têm o campo.
   */
  categoria?: string | null
}

export interface OfertaPublica {
  gestor: { nome: string }
  /** Farmácia dona do link — o dono já cai direto nos produtos dela. */
  farmacia: { id: number; nome: string; cidade: string | null } | null
  /** Só vem preenchido nos links antigos, em que o dono escolhia a farmácia. */
  farmacias: { id: number; nome: string; cidade: string | null }[]
  produtos: ProdutoOferta[]
}

export interface EnviarOfertaPayload {
  /** Ignorado nos links de cliente: lá a farmácia vem do próprio token. */
  farmacia_id: number
  /** O dono manda o preço junto; `preco` null = ele não informou. */
  produtos: { id: number; preco?: string | null }[]
  /** Obrigatório: sem nome o envio é recusado. */
  enviado_por: string
}

export type StatusSolicitacao = "pendente" | "atendida" | "descartada"

export interface SolicitacaoOferta {
  id: number
  farmacia_id: number
  farmacia: string
  produtos: ProdutoOferta[]
  enviado_por: string
  status: StatusSolicitacao
  criado_em: string
  atendida_em: string | null
}

export interface LinkOfertas {
  token: string
  url: string
}

// -- Públicas (sem token de login; o token do link é a credencial) --

/** Abre o link: gestor, farmácias daquele gestor e o catálogo. */
export function getOfertaPublica(token: string): Promise<OfertaPublica> {
  return req(`/api/publico/ofertas/${token}`)
}

/** Envia a seleção do dono da farmácia. */
export function enviarOfertaPublica(
  token: string,
  payload: EnviarOfertaPayload,
): Promise<{ ok: boolean; id: number }> {
  return req(`/api/publico/ofertas/${token}`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

/** URL da foto do produto na página pública (não exige login). */
export function ofertaImagemUrl(token: string, produtoId: number): string {
  return `${BASE_URL}/api/publico/ofertas/${token}/produto/${produtoId}/imagem`
}

// -- Do gestor --

/**
 * Gera um token novo para aquele cliente — o link antigo morre na hora.
 * O link de cada cliente já vem na carteira (`ClienteCarteira.link`); isto
 * aqui é só para quando ele precisa ser invalidado.
 */
export function regenerarLinkOfertas(farmaciaId: number): Promise<LinkOfertas> {
  return req(`/api/ofertas/link/${farmaciaId}/regenerar`, { method: "POST" })
}

/** O que os clientes enviaram. */
export function getSolicitacoes(): Promise<SolicitacaoOferta[]> {
  return req("/api/ofertas/solicitacoes")
}

/** A última lista que este cliente mandou pelo link dele. */
export interface UltimaEscolha {
  id: number
  produtos: ProdutoOferta[]
  enviado_por: string
  status: StatusSolicitacao
  criado_em: string
}

/**
 * O que o cliente escolheu da última vez — é o que o passo 3 do disparo
 * mostra, em vez do banco de imagens inteiro. `null` = nunca enviou nada.
 */
export function getUltimaEscolha(farmaciaId: number): Promise<UltimaEscolha | null> {
  return req(`/api/ofertas/ultima-escolha/${farmaciaId}`)
}

/** Um cliente da carteira e o estado de resposta dele. */
export interface ClienteCarteira {
  farmacia_id: number
  /** Razão social — uso interno, identifica o cliente. */
  farmacia: string
  /** Nome de fachada (null nos cadastros antigos). */
  nome_fachada: string | null
  /** Fachada com queda para a razão social — use no que sai para o grupo. */
  farmacia_visivel: string
  cidade: string | null
  telefone: string | null
  responsavel: string | null
  /** Link exclusivo deste cliente para ele escolher os produtos. */
  link: string | null
  /** true = tem pedido aguardando virar disparo */
  respondeu: boolean
  solicitacao: {
    id: number
    produtos: ProdutoOferta[]
    enviado_por: string
    criado_em: string
  } | null
  ultimo_envio_em: string | null
}

/** Carteira completa: TODAS as farmácias, com quem respondeu e quem não. */
export function getCarteiraOfertas(): Promise<ClienteCarteira[]> {
  return req("/api/ofertas/carteira")
}

/** Marca a solicitação como atendida/descartada. */
export function atualizarSolicitacao(
  id: number,
  status: StatusSolicitacao,
): Promise<{ ok: boolean }> {
  return req(`/api/ofertas/solicitacoes/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })
}

/** Total de solicitações pendentes (badge do menu). */
export function getOfertasPendentes(): Promise<{ total: number }> {
  return req("/api/ofertas/pendentes")
}
