import { clearAuth } from "./auth"

/**
 * Vazio de propósito: todo request sai relativo, na mesma origem do front, e é
 * o proxy quem repassa para a API (api/[...path].ts na Vercel, server.proxy no
 * `vite dev`). Assim o endereço real do backend não entra no bundle nem aparece
 * no DevTools. Não volte a ler VITE_API_BASE_URL aqui — variável VITE_* é
 * embutida no JS público e desfaz exatamente isso.
 */
const BASE_URL = ""

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /**
     * A resposta se perdeu no caminho (tempo limite do proxy da Vercel, rede
     * caindo) — o servidor pode ter feito o trabalho mesmo assim. Erro que o
     * backend respondeu de verdade fica `false`.
     */
    public conexaoPerdida = false,
  ) {
    super(message)
  }
}

/** Tempo limite do proxy edge da Vercel (~25 s): volta 504 em texto, sem JSON. */
const MSG_TEMPO_LIMITE = "O servidor demorou demais para responder (tempo limite excedido)."

// Sem header Authorization: a sessão vai no cookie httpOnly, que o navegador
// manda sozinho porque o pedido é para a mesma origem (ver @/lib/auth).
async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }
  if (!headers["Content-Type"] && options.method !== "GET" && options.method !== undefined) {
    headers["Content-Type"] = "application/json"
  }

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  } catch {
    // Rede caiu no meio: o pedido pode ou não ter chegado.
    throw new ApiError(0, "Sem conexão com o servidor.", true)
  }

  if (res.status === 401) {
    clearAuth()
    if (typeof window !== "undefined") window.location.href = "/login"
    throw new ApiError(401, "Não autorizado")
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    // Sem JSON = não foi o backend que respondeu, foi a plataforma no meio.
    if (body === null && res.status === 504) {
      throw new ApiError(504, MSG_TEMPO_LIMITE, true)
    }
    // 413 não vem do backend: é o proxy edge da Vercel recusando um corpo acima
    // de ~4,2 MB, em texto puro. Sem este caso o gestor via "Erro no servidor"
    // e não tinha como saber que o problema era o tamanho do envio.
    if (res.status === 413) {
      throw new ApiError(413, "Envio grande demais para a plataforma. Reduza a quantidade de imagens deste disparo.")
    }
    throw new ApiError(res.status, body?.detail ?? "Erro no servidor", body === null && res.status >= 500)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface LoginResponse {
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

export interface Farmacia {
  id: number
  /** Razão social — nome jurídico, uso interno. */
  nome: string
  /** Nome de fachada — o que o cliente final vê. Null nos cadastros antigos. */
  nome_fachada: string | null
  /** Conta de anúncios do Meta ("act_123"). Uma por cliente; null = fora do painel de custo. */
  meta_ad_account_id: string | null
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
  if (res.status === 429) {
    const b = await res.json().catch(() => ({}))
    throw new ApiError(429, b.detail ?? "Muitas tentativas erradas. Tente de novo mais tarde.")
  }
  if (!res.ok) {
    const b = await res.json().catch(() => ({}))
    throw new ApiError(res.status, b.detail ?? "Erro ao fazer login")
  }
  return res.json()
}

/** Pede ao backend para apagar o cookie de sessão (httpOnly: o JS não consegue). */
export async function logout(): Promise<void> {
  await fetch(`${BASE_URL}/api/auth/logout`, { method: "POST" }).catch(() => undefined)
}

export function getMe(): Promise<AuthUser> {
  return req("/api/auth/me")
}

// ── Painel ─────────────────────────────────────────────────────────────────

// ── Custo por resultado do Meta (campanhas de WhatsApp) ──────────────────

export interface CustoJanela {
  periodo_inicio: string | null
  periodo_fim: string | null
  gasto: number
  resultados: number
  /** gasto ÷ resultados; null quando não houve nenhuma conversa */
  custo_por_resultado: number | null
  tipo_resultado: string | null
  cliques: number
  impressoes: number
}

export interface CustoResultadoFarmacia {
  farmacia_id: number
  farmacia: string
  gestor_id: number | null
  janela_7d: CustoJanela | null
  janela_15d: CustoJanela | null
  janela_30d: CustoJanela | null
  /** falha na última leitura; os números são os da última leitura boa */
  erro: string | null
  sincronizado_em: string | null
}

export interface CustoResultado {
  ultima_execucao: string | null
  farmacias: CustoResultadoFarmacia[]
}

export function getCustoResultado(gestorId?: number): Promise<CustoResultado> {
  const qs = gestorId ? `?gestor_id=${gestorId}` : ""
  return req(`/api/custo-resultado${qs}`)
}

// ── Farmácias ──────────────────────────────────────────────────────────────

export function getFarmacias(params?: {
  gestor_id?: number
  status?: string
  busca?: string
  dias?: 7 | 15 | 30
  /** Período livre (mês fechado, de/até) — no lugar de `dias`. */
  inicio?: string
  fim?: string
  fase?: "entrada" | "ativo"
}): Promise<Farmacia[]> {
  const q = new URLSearchParams()
  if (params?.gestor_id) q.set("gestor_id", String(params.gestor_id))
  if (params?.status)    q.set("status", params.status)
  if (params?.busca)     q.set("busca", params.busca)
  if (params?.dias)      q.set("dias", String(params.dias))
  if (params?.inicio)    q.set("inicio", params.inicio)
  if (params?.fim)       q.set("fim", params.fim)
  if (params?.fase)      q.set("fase", params.fase)
  const qs = q.toString()
  return req(`/api/farmacias${qs ? `?${qs}` : ""}`)
}

/** Primeiro e último dia com coleta gravada — limites do seletor de período. */
export function getPeriodoDisponivel(): Promise<{ primeiro_dia: string | null; ultimo_dia: string | null }> {
  return req("/api/farmacias/periodo-disponivel")
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
  gestor_id?: number
  meta_ad_account_id?: string | null
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
    meta_ad_account_id: string | null
  }>,
): Promise<{ id: number; nome: string; ativa: boolean }> {
  return req(`/api/farmacias/${id}`, { method: "PUT", body: JSON.stringify(data) })
}

export function ativarFarmacia(
  id: number,
  data: { gestor_id?: number },
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

// ── Facebook (Meta Ads) do gestor ────────────────────────────────────────────
// Conectado, o gestor publica e lista contas com o próprio Facebook; sem
// conexão (ou vencida), o servidor usa o acesso geral da agência.

export interface MetaStatus {
  configurado: boolean
  conectado: boolean
  expirado: boolean
  nome: string | null
  expira_em: string | null
  dias_restantes: number | null
}

export function getMetaStatus(): Promise<MetaStatus> {
  return req("/api/auth/meta/status")
}

export async function iniciarOAuthMeta(): Promise<void> {
  const res = await req<{ url: string }>("/api/auth/meta/url")
  if (!res?.url) throw new Error("URL de autenticação não retornada pelo servidor.")
  window.location.href = res.url
}

/** Alternativa ao botão: salva um token que o gestor gerou no Facebook (validado no servidor). */
/** `aviso`: token curto que não deu para estender — vai cair em breve. */
export function salvarTokenMeta(token: string): Promise<{ nome: string; expira_em: string | null; aviso: string | null }> {
  return req("/api/auth/meta/token", { method: "POST", body: JSON.stringify({ token }) })
}

export function desconectarMeta(): Promise<{ mensagem: string }> {
  return req("/api/auth/meta", { method: "DELETE" })
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
  /** Quantas conexões existem ao todo (a tela Conexões lista todas). */
  total?: number
}

/** Uma das várias conexões de WhatsApp do sistema. */
export interface ConexaoWhatsApp {
  id: number
  instancia: string
  nome: string
  status: "open" | "connecting" | "close"
  numero: string | null
  conectado: boolean
}

export interface ListagemConexoes {
  conexoes: ConexaoWhatsApp[]
  /** false = servidor sem Evolution API configurada. */
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

/** Todas as conexões, com o status conferido ao vivo na Evolution. */
export function getWhatsAppConexoes(): Promise<ListagemConexoes> {
  return req("/api/whatsapp/conexoes")
}

/**
 * Cria uma conexão nova ou reconecta uma existente — o que manda é o
 * `instance_name`: repetir um já cadastrado reconecta aquele, um nome inédito
 * abre mais uma conexão em paralelo.
 */
export function connectWhatsApp(
  instance_name: string,
  nome?: string,
): Promise<WhatsAppConnectResponse> {
  return req("/api/whatsapp/connect", {
    method: "POST",
    body: JSON.stringify({ instance_name, nome }),
  })
}

/** Sem `instance` responde pela conexão default (comportamento antigo). */
export function getWhatsAppQrCode(instance?: string): Promise<WhatsAppQrResponse> {
  const q = instance ? `?instance=${encodeURIComponent(instance)}` : ""
  return req(`/api/whatsapp/qrcode${q}`)
}

export function disconnectWhatsApp(instance?: string): Promise<{ mensagem: string }> {
  const q = instance ? `?instance=${encodeURIComponent(instance)}` : ""
  return req(`/api/whatsapp/disconnect${q}`, { method: "DELETE" })
}

export function deleteWhatsAppInstance(instance?: string): Promise<{ mensagem: string }> {
  const q = instance ? `?instance=${encodeURIComponent(instance)}` : ""
  return req(`/api/whatsapp/instance${q}`, { method: "DELETE" })
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

export interface ListagemContas {
  contas: ContaAnuncio[]
  /** ISO — quando o servidor sincronizou com a Meta (null = respondeu ao vivo). */
  atualizadoEm: string | null
  /** true = tem refresh rodando no servidor; a lista pode mudar em instantes. */
  sincronizando: boolean
  /** Erro do último sync, com o cache antigo ainda sendo exibido. */
  aviso: string | null
}

/**
 * Lista TODAS as contas de anúncios acessíveis pelo token Meta do servidor.
 *
 * O servidor responde do cache dele: a consulta na Meta leva segundos e não
 * pode ficar no caminho da tela. `refresh` é o botão "Atualizar" — ignora o
 * cache e espera a Meta.
 */
export function getContasAnuncio(refresh = false): Promise<ListagemContas> {
  return req(`/api/ads/contas${refresh ? "?refresh=1" : ""}`)
}

/** Conta de anúncios para o cadastro da farmácia, com o cliente que já a usa. */
export interface ContaMetaCadastro {
  id: string                    // "act_123456789"
  nome: string
  farmacia_id: number | null    // null = livre
  farmacia_nome: string | null
}

/**
 * Contas que os gestores conectados enxergam, para o campo "Conta de anúncios
 * Meta" do cadastro (só admin). Com `farmaciaId`, vem também a sugerida pelo
 * nome (a CA01 do cliente). Consulta o Meta na hora: leva alguns segundos.
 */
export function getContasMetaCadastro(farmaciaId?: number): Promise<{ contas: ContaMetaCadastro[]; sugerida: string | null }> {
  return req(`/api/custo-resultado/contas${farmaciaId ? `?farmacia_id=${farmaciaId}` : ""}`)
}

// ── Localização (segmentação geográfica) ────────────────────────────────────────

export interface LocalizacaoMeta {
  key: string     // chave interna do Meta — exigida pelo geo_locations
  nome: string    // ex: "São Paulo"
  regiao: string  // ex: "São Paulo" (estado)
}

/** Autocomplete de cidades (Brasil) para a Etapa Público do wizard. */
export function buscarLocalizacoes(q: string): Promise<{ resultados: LocalizacaoMeta[] }> {
  return req(`/api/ads/geo-busca?q=${encodeURIComponent(q)}`)
}

export interface PaginaMeta {
  id: string
  nome: string
  /** Conta do Instagram vinculada. null = anúncio não roda no Instagram. */
  instagramId: string | null
  instagramNome: string | null
}

/**
 * Páginas do Facebook que a conta de anúncios pode usar no criativo.
 * O gestor escolhe uma na etapa 1 — antes o sistema pegava a primeira do
 * Business Manager e o Meta recusava com "As Páginas não correspondem".
 */
export function listarPaginasDaConta(contaId: string): Promise<{ paginas: PaginaMeta[] }> {
  return req(`/api/campanhas/paginas?conta=${encodeURIComponent(contaId)}`)
}

export interface Coordenada {
  lat: number
  lon: number
}

/**
 * Centro da cidade, só para desenhar o mapa do raio no wizard.
 * `coordenada: null` = não encontrada (o mapa some, a etapa continua válida).
 */
export function buscarCoordenadas(nome: string, regiao = ''): Promise<{ coordenada: Coordenada | null }> {
  return req(`/api/ads/geo-coordenadas?nome=${encodeURIComponent(nome)}&regiao=${encodeURIComponent(regiao)}`)
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

/**
 * Sobe UMA imagem de criativo e devolve o hash dela no Meta.
 *
 * As imagens vão uma por requisição porque o proxy recusa corpo acima de
 * ~4,2 MB: mandar os PNGs todos juntos estourava a partir de uns três
 * criativos. A publicação em si leva só os hashes, e fica minúscula.
 */
export function subirImagemCriativo(
  contaId: string, nome: string, pngBase64: string,
): Promise<{ hash: string }> {
  return req("/api/campanhas/midias", {
    method: "POST",
    body: JSON.stringify({ conta: { id: contaId }, nome, pngBase64 }),
  })
}

/**
 * Publica no Meta SEM segurar uma requisição longa.
 *
 * O proxy edge da Vercel derruba a requisição se a resposta não começar em
 * ~25 s, e publicar 4 anúncios já leva isso: o Meta concluía, o gestor via
 * "Erro no servidor" e publicava de novo, duplicando. Agora o backend responde
 * na hora com um id (`?assincrono=1`) e aqui consultamos até terminar.
 */
const AVISO_CONFERIR =
  "Não consegui confirmar o resultado da publicação. Ela pode ter sido concluída — confira no Gerenciador de Anúncios antes de publicar de novo, para não duplicar."

/** O que toda publicação devolve, mais a marca de que a conexão caiu no meio. */
export interface ComTempoExcedido {
  /** A resposta do POST se perdeu (tempo limite), mas a publicação foi concluída. */
  tempoExcedido?: boolean
}

async function publicarEAcompanhar<T extends { avisos?: string[] }>(path: string, payload: unknown): Promise<T & ComTempoExcedido> {
  // O id nasce AQUI: se a resposta do POST se perder no proxy, ainda sabemos
  // o que perguntar ao servidor. E o servidor não publica duas vezes o mesmo id.
  const publicacaoId = crypto.randomUUID()
  let tempoExcedido = false
  try {
    await req(`${path}?assincrono=1&publicacao=${publicacaoId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
  } catch (err) {
    // Erro que o backend respondeu (validação, orçamento...) é definitivo.
    if (!(err instanceof ApiError && err.conexaoPerdida)) throw err
    tempoExcedido = true
  }

  const inicio = Date.now()
  let falhasSeguidas = 0
  while (Date.now() - inicio < 10 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 2000))
    let andamento: { status: "rodando" | "concluida"; codigo?: number; corpo?: unknown }
    try {
      andamento = await req(`/api/campanhas/publicacoes/${encodeURIComponent(publicacaoId)}`)
      falhasSeguidas = 0
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // Com o POST perdido, 404 quer dizer que o pedido nem chegou: nada foi feito.
        throw new ApiError(404, tempoExcedido
          ? "A conexão caiu antes de o pedido chegar ao servidor. Nada foi publicado — pode tentar de novo."
          : AVISO_CONFERIR)
      }
      // Oscilação de rede numa consulta não muda nada no Meta: tenta de novo.
      if (++falhasSeguidas >= 5) throw new ApiError(0, AVISO_CONFERIR)
      continue
    }
    if (andamento.status === "rodando") continue
    const codigo = andamento.codigo ?? 500
    if (codigo >= 400) {
      const detalhe = (andamento.corpo as { detail?: string } | undefined)?.detail ?? "Erro no servidor"
      throw new ApiError(codigo, tempoExcedido ? `Excedeu o tempo limite e a publicação falhou: ${detalhe}` : detalhe)
    }
    const corpo = andamento.corpo as T
    if (!tempoExcedido) return corpo
    return {
      ...corpo,
      tempoExcedido: true,
      avisos: ["A conexão excedeu o tempo limite, mas a publicação foi concluída normalmente no Meta.", ...(corpo.avisos ?? [])],
    }
  }
  throw new ApiError(0, AVISO_CONFERIR)
}

/** Envia o JSON do wizard (com os hashes das imagens) para criar a campanha ativa no Meta. */
export function publicarCampanha(payload: unknown): Promise<PublicarCampanhaResultado & ComTempoExcedido> {
  return publicarEAcompanhar("/api/campanhas/criar", payload)
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
  orcamentoDiario: number   // em reais (0 quando a campanha é CBO)
  /** Orçamento é da CAMPANHA (CBO): o conjunto não tem orçamento próprio. */
  cbo: boolean
  /** Orçamento diário da campanha em reais (CBO; 0 se for vitalício). */
  orcamentoCampanha: number
  /** Orçamento total da campanha em reais (CBO vitalício). */
  orcamentoCampanhaTotal: number
  otimizacao: string
  idadeMin: number | null
  idadeMax: number | null
  genero: "todos" | "homens" | "mulheres"
  generos: string           // rótulo legível do campo acima
  destinoWhatsapp: boolean
  dataInicio: string        // YYYY-MM-DD ("" se não houver)
  dataFim: string           // YYYY-MM-DD ("" = sem término)
  /** Onde o conjunto entrega — no "Novo conjunto" a cópia herda isto. */
  localizacao?: { resumo: string; lat?: number; lng?: number; raioKm?: number }
  /** Público Advantage+: mudar idade/gênero desliga o Advantage+ na cópia. */
  advantageAudience?: boolean
}

export interface NovosAnunciosResultado {
  conjuntoId: string
  /** true = o Meta recusou duplicar e o conjunto foi criado do zero, com a mesma config. */
  conjuntoRecriado?: boolean
  anuncioIds: string[]
  linkGerenciador: string
  copyUsada: { textoPrincipal: string; titulo: string; descricao: string }
  avisos: string[]
}

/** Cria uma cópia do conjunto com as configs revisadas e os criativos novos. */
export function publicarNovosAnuncios(
  conjuntoId: string,
  payload: unknown,
): Promise<NovosAnunciosResultado & ComTempoExcedido> {
  return publicarEAcompanhar(`/api/campanhas/conjuntos/${encodeURIComponent(conjuntoId)}/novos-anuncios`, payload)
}

/** Sobe os criativos novos DENTRO do conjunto, sem cópia (nascem ativos). */
export function publicarAnunciosNoConjunto(
  conjuntoId: string,
  payload: unknown,
): Promise<NovosAnunciosResultado & ComTempoExcedido> {
  return publicarEAcompanhar(`/api/campanhas/conjuntos/${encodeURIComponent(conjuntoId)}/anuncios`, payload)
}

/** Próximo número "ADnn" livre no conjunto (o maior que existe + 1). */
export function getProximoNumeroAnuncio(conjuntoId: string, contaId: string): Promise<{ numero: number }> {
  return req(`/api/campanhas/conjuntos/${encodeURIComponent(conjuntoId)}/proximo-anuncio?conta=${encodeURIComponent(contaId)}`)
}

/** Todos os conjuntos (ad sets) da conta, direto do Meta — lista plana. */
export function getConjuntosDaConta(contaId: string): Promise<{ conjuntos: ConjuntoMeta[] }> {
  return req(`/api/campanhas/conjuntos?conta=${encodeURIComponent(contaId)}`)
}

// ── Catálogo de produtos (fluxo Criativos e Campanhas) ─────────────────────────

export interface ProdutoEntrada {
  nome: string
  preco?: string
  /** Escolhido na grade do catálogo: casa pelo id, sem depender do nome. */
  catalogoId?: number | null
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
  /** Muda quando a imagem é editada — vai na URL da imagem para furar o cache. */
  atualizadoEm?: string | null
}

/** Lista os produtos do catálogo (sem imagem). */
export function listarCatalogoProdutos(): Promise<{ produtos: CatalogoProdutoItem[] }> {
  return req("/api/catalogo/produtos")
}

/**
 * Monta a URL da imagem de um produto para <img src> — o cookie de sessão vai
 * junto sozinho. `versao` (o atualizadoEm do produto) muda a URL quando a
 * imagem é editada: a resposta fica 1 h em cache e, sem isso, a foto antiga
 * continuaria aparecendo depois de salvar no editor.
 */
export function catalogoImagemUrl(id: number, versao?: string | null): string {
  const base = `${BASE_URL}/api/catalogo/produtos/${id}/imagem`
  return versao ? `${base}?v=${encodeURIComponent(versao)}` : base
}

const EXT_POR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
}

/** Nome do produto virando nome de arquivo: sem acento, sem barra, sem espaço. */
function nomeDeArquivo(nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
  return limpo || "imagem"
}

/**
 * Senha do Banco de Imagens no cabeçalho que o backend confere. Codificada
 * porque cabeçalho HTTP não aceita acento — `fetch` estoura com "ç" cru.
 */
function headerSenhaBanco(senha: string): Record<string, string> {
  return { "X-Senha-Banco": encodeURIComponent(senha) }
}

/**
 * Baixa a imagem de um produto (só admin, com a senha do banco).
 *
 * Busca o blob com fetch e dispara o download a partir dele: <a download>
 * direto na URL não mandaria o cabeçalho da senha.
 */
export async function baixarCatalogoImagem(id: number, nome: string, senha: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/catalogo/produtos/${id}/download`, {
    headers: headerSenhaBanco(senha),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body?.detail ?? "Não foi possível baixar a imagem")
  }

  const blob = await res.blob()
  const ext = EXT_POR_MIME[blob.type] ?? "jpg"
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `${nomeDeArquivo(nome)}.${ext}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(a.href)
}

/** Cadastra/atualiza um produto do catálogo com sua imagem (base64 data URI ou puro). */
export function cadastrarCatalogoProduto(data: {
  nome: string
  imagem_b64: string
  mime?: string
  /** Categoria (texto livre). Omitir preserva a de um produto já existente. */
  categoria?: string | null
}, senha: string): Promise<{ ok: boolean }> {
  return req("/api/catalogo/produtos", {
    method: "POST",
    headers: headerSenhaBanco(senha),
    body: JSON.stringify(data),
  })
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
  senha: string,
): Promise<{ ok: boolean; total: number }> {
  return req("/api/catalogo/produtos/categoria", {
    method: "PATCH",
    headers: headerSenhaBanco(senha),
    body: JSON.stringify({ ids, categoria }),
  })
}

/** Liga/desliga um produto do catálogo (desligado não entra nos criativos). */
export function setCatalogoProdutoAtivo(
  id: number,
  ativo: boolean,
  senha: string,
): Promise<{ ok: boolean; ativo: boolean }> {
  return editarCatalogoProduto(id, { ativo }, senha) as Promise<{ ok: boolean; ativo: boolean }>
}

/** Edita nome, categoria e/ou status de um produto. Campo omitido fica como está. */
export function editarCatalogoProduto(
  id: number,
  campos: { nome?: string; categoria?: string | null; ativo?: boolean },
  senha: string,
): Promise<{ ok: boolean }> {
  return req(`/api/catalogo/produtos/${id}`, {
    method: "PATCH",
    headers: headerSenhaBanco(senha),
    body: JSON.stringify(campos),
  })
}

/** Substitui a imagem de um produto (saída do editor de imagem). */
export function trocarImagemCatalogoProduto(
  id: number,
  imagem_b64: string,
  mime: "image/png" | "image/jpeg" | "image/webp",
  senha: string,
): Promise<{ ok: boolean }> {
  return req(`/api/catalogo/produtos/${id}/imagem`, {
    method: "PUT",
    headers: headerSenhaBanco(senha),
    body: JSON.stringify({ imagem_b64, mime }),
  })
}

/** Remove um produto do catálogo. */
export function deletarCatalogoProduto(id: number, senha: string): Promise<{ ok: boolean }> {
  return req(`/api/catalogo/produtos/${id}`, { method: "DELETE", headers: headerSenhaBanco(senha) })
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
  /**
   * true = quando a lista de produtos acaba, ela recomeça do início, e a data
   * de término passa a ser a ÚNICA coisa que encerra a campanha (por isso ela
   * vira obrigatória — a API recusa com 400 sem ela).
   */
  repetir_produtos?: boolean
  /**
   * true = o gestor liberou sábado e domingo para ESTA campanha. Ausente/false
   * (padrão) mantém a regra do dono: nada sai no fim de semana, e a API recusa
   * com 400 um primeiro envio nesses dias.
   */
  permitir_fim_de_semana?: boolean
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
  /** true = a lista de produtos dá a volta; só a data de término encerra. */
  repetir_produtos?: boolean
  /** true = esta campanha foi criada com o fim de semana liberado. */
  permitir_fim_de_semana?: boolean
}

/**
 * Uma postagem registrada: um grupo, num envio. O backend grava uma linha
 * destas por grupo A CADA envio, então um disparo que repete acumula várias —
 * é o que permite montar a linha do tempo do que realmente saiu.
 */
export interface DisparoLog {
  id: number
  disparoId: number
  grupoJid: string
  grupoNome: string | null
  /** ok | erro */
  status: string
  erro: string | null
  enviadoEm: string | null
}

/** O que de fato foi postado neste disparo, do mais recente para o mais antigo. */
export function getDisparoLogs(id: number): Promise<DisparoLog[]> {
  return req(`/api/disparos/${id}/logs`)
}

/**
 * Detalhe de um disparo para acompanhamento. NÃO traz as imagens (o base64 de
 * um disparo com dezenas de produtos pesa MB) — só o rótulo de cada criativo.
 */
export interface DisparoDetalhe {
  id: number
  titulo: string
  mensagem: string
  farmacia_id: number | null
  quando: string
  status: string
  repetir: RepetirDisparo
  repetir_ate: string | null
  repetir_produtos: boolean
  /** true = esta campanha foi criada com o fim de semana liberado. */
  permitir_fim_de_semana: boolean
  agendado_para: string | null
  proximo_envio: string | null
  ultimo_envio: string | null
  criado_em: string
  /** ["08:00","18:00"] quando o disparo sai em vários horários do dia. */
  horarios: string[]
  grupos: { jid: string; nome?: string }[]
  /** Índice do PRÓXIMO produto a sair — o que vem antes já foi postado. */
  cursor_midia: number
  /** Rótulo de cada criativo, na ordem do rodízio. null = arte pronta. */
  produtos: (string | null)[]
}

export function getDisparo(id: number): Promise<DisparoDetalhe> {
  return req(`/api/disparos/${id}`)
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

/** Farmácia com campanha ainda rodando num grupo — o "dono" daquele grupo agora. */
export interface DonoDeGrupo {
  jid: string
  farmacia_id: number
  /** Nome visível (fachada, ou razão social quando não há fachada). */
  farmacia: string
}

/**
 * Quem está com campanha rodando em cada grupo (agendada ou enviando, término
 * não vencido). Campanha encerrada libera o grupo.
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
   * Preço antigo da oferta "de/por" — sai riscado na arte, acima do `preco`.
   * Null (ou ausente, nos pedidos antigos) = oferta com um preço só.
   */
  preco_de?: string | null
  /**
   * 'cliente' = foto do espaço do próprio cliente; nesse caso `id` é NEGATIVO
   * (-id do produto dele). Ver `imagemDoProdutoOferta`.
   */
  origem?: "cliente"
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
  /**
   * Espaço de produtos que o próprio cliente manda (foto + nome), até `limite`.
   * Null nos links antigos, que não têm farmácia fixa.
   */
  meus_produtos: { limite: number; itens: MeuProduto[] } | null
}

/** Produto que o cliente mandou pelo link (foto + nome). */
export interface MeuProduto {
  id: number
  nome: string
}

export interface EnviarOfertaPayload {
  /** Ignorado nos links de cliente: lá a farmácia vem do próprio token. */
  farmacia_id: number
  /**
   * O dono manda o preço junto; `preco` null = ele não informou.
   * `preco_de` só vai preenchido nos produtos em que ele ligou o "de/por".
   */
  produtos: { id: number; preco?: string | null; preco_de?: string | null }[]
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

/**
 * Manda um produto do cliente para o espaço da farmácia. `imagem` é base64
 * (ou data URL) já comprimido — o servidor recusa acima de ~900 KB.
 * 409 = o espaço já está cheio.
 */
export function enviarMeuProduto(
  token: string,
  payload: { nome: string; imagem: string },
): Promise<MeuProduto> {
  return req(`/api/publico/ofertas/${token}/meus-produtos`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

/** Exclui um produto que o cliente mandou — libera a vaga. */
export function excluirMeuProduto(token: string, id: number): Promise<{ ok: boolean }> {
  return req(`/api/publico/ofertas/${token}/meus-produtos/${id}`, { method: "DELETE" })
}

/** Foto de um produto que o cliente mandou, na página pública. */
export function meuProdutoImagemUrl(token: string, id: number): string {
  return `${BASE_URL}/api/publico/ofertas/${token}/meus-produtos/${id}/imagem`
}

// -- Do gestor --

/** Os produtos que o cliente mandou pelo link dele, e o tamanho do espaço. */
export function getProdutosDoCliente(
  farmaciaId: number,
): Promise<{ limite: number; itens: (MeuProduto & { criado_em: string | null })[] }> {
  return req(`/api/ofertas/clientes/${farmaciaId}/produtos`)
}

/** Produto que um cliente mandou pelo link, com quem mandou. */
export interface ProdutoEnviadoPeloCliente {
  id: number
  nome: string
  criado_em: string | null
  farmacia_id: number
  /** Razão social — identifica o cliente internamente. */
  farmacia: string
  /** Fachada com queda para a razão social. */
  farmacia_visivel: string
  cidade: string | null
}

/**
 * Tudo o que os clientes da carteira mandaram pelo link (o admin vê todos),
 * dos mais recentes para os mais antigos. `limite` = tamanho do espaço de cada um.
 */
export function getProdutosEnviadosPelosClientes(): Promise<{ limite: number; itens: ProdutoEnviadoPeloCliente[] }> {
  return req("/api/ofertas/produtos-clientes")
}

/** Foto de um produto que o cliente mandou (rota do gestor, com sessão). */
export function produtoDoClienteImagemUrl(farmaciaId: number, id: number): string {
  return `${BASE_URL}/api/ofertas/clientes/${farmaciaId}/produtos/${id}/imagem`
}

/** O gestor exclui um produto que o cliente mandou — libera a vaga dele. */
export function excluirProdutoDoCliente(farmaciaId: number, id: number): Promise<{ ok: boolean }> {
  return req(`/api/ofertas/clientes/${farmaciaId}/produtos/${id}`, { method: "DELETE" })
}

/**
 * Foto de um item da lista que o cliente enviou. Id NEGATIVO = produto que o
 * próprio cliente mandou pelo link (o backend grava -id de produtos_cliente);
 * positivo = banco de imagens.
 */
export function imagemDoProdutoOferta(farmaciaId: number, id: number): string {
  return id < 0 ? produtoDoClienteImagemUrl(farmaciaId, -id) : catalogoImagemUrl(id)
}

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
  /**
   * A última lista deste cliente em QUALQUER status. Depois que o pedido vira
   * campanha ele sai de `solicitacao` (e de `respondeu`), mas continua aqui —
   * é o que a linha mostra no lugar do "aguardando".
   */
  ultima_solicitacao: {
    id: number
    produtos: ProdutoOferta[]
    enviado_por: string
    status: StatusSolicitacao
    criado_em: string
    /** Quando o gestor montou a campanha em cima desta lista. */
    atendida_em: string | null
  } | null
  /** Campanha mais recente deste cliente. Cancelada não conta. */
  campanha: {
    id: number
    status: string
    agendado_para: string | null
    /** Próxima ocorrência de uma campanha que repete. */
    proximo_envio: string | null
    ultimo_envio: string | null
    criado_em: string | null
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
