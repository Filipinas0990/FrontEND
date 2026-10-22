import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import {
  Search, Plus, Pencil, Trash2, RefreshCw, Target, Megaphone, ArrowUpRight, ArrowDownRight, ExternalLink,
  TrendingUp, Store, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { FarmaciasTabs } from "@/components/FarmaciasTabs";
import { FarmaciasCabecalho, IndicadorTopo, CLASSE_ACAO_TOPO } from "@/components/FarmaciasCabecalho";
import { usePeriod, type Period } from "@/contexts/PeriodContext";
import {
  getFarmacias,
  getGestores,
  getCustoResultado,
  getFarmaciaEvolucaoPorPeriodo,
  createFarmacia,
  updateFarmacia,
  deleteFarmacia,
  setFarmaciaMeta,
  getContasMetaCadastro,
  nomeVisivel,
  type CustoJanela,
  type Farmacia,
  type Gestor,
} from "@/lib/api";
import { nivelSaude, ESTILO_SAUDE } from "@/lib/saudeCusto";
import { isAdmin } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/farmacias/")({
  component: FarmaciasPage,
  head: () => ({ meta: [{ title: "Farmácias — PharmaFlow" }] }),
});

type Nivel = Farmacia["nivel_alerta"];

/** Grupos da lista, na ordem de urgência. O nível vem pronto do backend. */
const GRUPOS: { nivel: Nivel; titulo: string; dica: string; rotulo: string; ponto: string; selo: string }[] = [
  { nivel: "vermelho", titulo: "Precisam de ação agora", dica: "em alerta",          rotulo: "Alerta",  ponto: "bg-red-500",     selo: "bg-red-50 text-red-700 ring-red-600/10" },
  { nivel: "amarelo",  titulo: "De olho",                dica: "abaixo do esperado", rotulo: "Atenção", ponto: "bg-amber-500",   selo: "bg-amber-50 text-amber-700 ring-amber-600/10" },
  { nivel: "verde",    titulo: "No caminho certo",       dica: "saudáveis",          rotulo: "Ativa",   ponto: "bg-emerald-500", selo: "bg-emerald-50 text-emerald-700 ring-emerald-600/10" },
];

const grupoDo = (nivel: Nivel) => GRUPOS.find((g) => g.nivel === nivel) ?? GRUPOS[2];

/** Ainda não tem coleta no período: fica fora dos grupos e da soma de receita. */
function semDados(p: Farmacia) {
  return p.posicao_ranking >= 9999 || (p.receita_total === 0 && p.total_atendimentos === 0 && p.vendas_realizadas === 0);
}

function Variacao({ value }: { value: number | null | undefined }) {
  if (value == null || value === 0) return <span className="text-zinc-400 text-[11px]">—</span>;
  const pos = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${pos ? "text-emerald-600" : "text-red-600"}`}>
      {pos ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtCompacto(v: number) {
  return v >= 1000
    ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`
    : `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

/** Cor do progresso da meta de receita: bateu, perto (≥ 70%) ou longe. */
function corMeta(pct: number) {
  if (pct >= 100) return { barra: "bg-emerald-500", traco: "stroke-emerald-500", texto: "text-emerald-600" };
  if (pct >= 70) return { barra: "bg-amber-500", traco: "stroke-amber-500", texto: "text-amber-600" };
  return { barra: "bg-red-500", traco: "stroke-red-500", texto: "text-red-600" };
}

// ── Form dialog ────────────────────────────────────────────────────────────

interface FarmaciaForm {
  fase: "entrada" | "ativo";
  /** Razão social — nome jurídico, uso interno. */
  nome: string;
  /** Nome de fachada — é o que o cliente final vê no criativo do grupo. */
  nome_fachada: string;
  /** Conta de anúncios do Meta ("act_123"). "" = sem conta (fora do painel de custo). */
  meta_ad_account_id: string;
  telefone: string;
  responsavel: string;
  cidade: string;
  tem_chatbot: boolean;
  gestor_id: string;
  meta_receita: string;
  meta_leads_google: string;
  meta_leads_meta: string;
}

function FarmaciaDialog({
  open,
  onOpenChange,
  editing,
  gestores,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Farmacia | null;
  gestores: Gestor[];
  onSave: (data: FarmaciaForm) => Promise<void>;
  saving: boolean;
}) {
  const emptyForm = (): FarmaciaForm => ({
    fase: editing?.fase ?? "ativo",
    nome: editing?.nome ?? "",
    nome_fachada: editing?.nome_fachada ?? "",
    meta_ad_account_id: editing?.meta_ad_account_id ?? "",
    telefone: editing?.telefone ?? "",
    responsavel: editing?.responsavel ?? "",
    cidade: editing?.cidade ?? "",
    tem_chatbot: editing?.tem_chatbot ?? true,
    gestor_id: editing?.gestor_id ? String(editing.gestor_id) : "",
    meta_receita: editing?.meta_receita != null ? String(editing.meta_receita) : "",
    meta_leads_google: editing?.meta_leads_google != null ? String(editing.meta_leads_google) : "",
    meta_leads_meta: editing?.meta_leads_meta != null ? String(editing.meta_leads_meta) : "",
  });
  const [form, setForm] = useState<FarmaciaForm>(emptyForm);
  const [confirmPending, setConfirmPending] = useState<FarmaciaForm | null>(null);
  useEffect(() => { setForm(emptyForm()); }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (f: keyof FarmaciaForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));

  const metaNum = form.meta_receita ? Number(form.meta_receita) : null;
  const metaFormatada = metaNum != null && !isNaN(metaNum)
    ? metaNum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : null;

  const gestorNome = form.gestor_id
    ? gestores.find((g) => String(g.id) === form.gestor_id)?.nome ?? "—"
    : "Sem gestor";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmPending(form);
  };

  const handleConfirm = async () => {
    if (!confirmPending) return;
    await onSave(confirmPending);
    setConfirmPending(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Farmácia" : "Nova Farmácia"}</DialogTitle>
          </DialogHeader>
          <form id="farmacia-form" onSubmit={handleSubmit} className="space-y-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
            {/* Toggle Entrada / Ativo */}
            {!editing && (
              <div className="flex gap-2 p-1 bg-zinc-100 rounded-xl">
                {(["entrada", "ativo"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, fase: f }))}
                    className={[
                      "flex-1 py-2 text-sm font-semibold rounded-lg transition-all",
                      form.fase === f
                        ? f === "entrada"
                          ? "bg-amber-500 text-white shadow-sm"
                          : "bg-brand text-white shadow-sm"
                        : "text-zinc-500 hover:text-zinc-800",
                    ].join(" ")}
                  >
                    {f === "entrada" ? "📋 Cliente de Entrada" : "✅ Cliente Ativo"}
                  </button>
                ))}
              </div>
            )}
            {form.fase === "entrada" && !editing && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 ring-1 ring-amber-200">
                Cliente ainda em implantação. Ative quando começar a ser acompanhado no painel.
              </p>
            )}

            {/* Dados básicos */}
            <FormField label="Razão social *">
              <input
                required
                value={form.nome}
                onChange={set("nome")}
                className="form-input"
                placeholder="BARROS E SILVA COMERCIO DE MEDICAMENTOS LTDA"
              />
              <p className="text-[11px] text-zinc-400 mt-1">
                Nome jurídico. Só aparece aqui dentro, para você identificar o cliente.
              </p>
            </FormField>
            <FormField label="Nome de fachada *">
              <input
                required
                value={form.nome_fachada}
                onChange={set("nome_fachada")}
                className="form-input"
                placeholder="Drogaria Bem Estar"
              />
              <p className="text-[11px] text-zinc-400 mt-1">
                Como o cliente da farmácia a conhece — é este que vai no criativo do grupo de ofertas.
              </p>
            </FormField>
            <ContaMetaCampo
              aberto={open}
              farmaciaId={editing?.id ?? null}
              valor={form.meta_ad_account_id}
              onChange={(v) => setForm((p) => ({ ...p, meta_ad_account_id: v }))}
            />
            {form.fase === "entrada" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Responsável">
                    <input value={form.responsavel} onChange={set("responsavel")} className="form-input" placeholder="João Silva" />
                  </FormField>
                  <FormField label="Telefone">
                    <input value={form.telefone} onChange={set("telefone")} className="form-input" placeholder="(11) 99999-1234" />
                  </FormField>
                </div>
                <FormField label="Cidade">
                  <input value={form.cidade} onChange={set("cidade")} className="form-input" placeholder="São Paulo" />
                </FormField>
              </>
            )}

            {/* Tem chatbot — sempre visível */}
            <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl ring-1 ring-zinc-100">
              <input
                type="checkbox"
                id="tem_chatbot"
                checked={form.tem_chatbot}
                onChange={(e) => setForm((p) => ({ ...p, tem_chatbot: e.target.checked }))}
                className="size-4 accent-brand"
              />
              <label htmlFor="tem_chatbot" className="text-sm font-medium text-zinc-700 cursor-pointer">
                Tem PharmaChatBot
              </label>
            </div>

            {/* Metas — só para clientes ativos */}
            {form.fase === "ativo" && (
              <>
                <FormField label="Meta de Receita R$ (opcional)">
                  <input type="number" min="0" step="0.01" value={form.meta_receita} onChange={set("meta_receita")} className="form-input" placeholder="Ex: 45000" />
                  {metaFormatada && <p className="mt-1 text-xs font-semibold text-emerald-600">{metaFormatada}</p>}
                </FormField>
                <div className="pt-2 border-t border-zinc-100">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">Metas de Leads por Canal</p>
                  <div className="space-y-3">
                    <FormField label="Meta Leads Google (semanal)">
                      <div className="flex items-center gap-2">
                        <input type="number" min="1" step="1" value={form.meta_leads_google} onChange={set("meta_leads_google")} className="form-input flex-1" placeholder="Ex: 300" />
                        <span className="text-xs text-zinc-400 shrink-0">leads/sem.</span>
                      </div>
                    </FormField>
                    <FormField label="Meta Leads Meta/Facebook (semanal)">
                      <div className="flex items-center gap-2">
                        <input type="number" min="1" step="1" value={form.meta_leads_meta} onChange={set("meta_leads_meta")} className="form-input flex-1" placeholder="Ex: 200" />
                        <span className="text-xs text-zinc-400 shrink-0">leads/sem.</span>
                      </div>
                    </FormField>
                  </div>
                </div>
              </>
            )}

            <FormField label="Gestor (opcional)">
              <select value={form.gestor_id} onChange={set("gestor_id")} className="form-input">
                <option value="">Sem gestor</option>
                {gestores.filter((g) => !g.is_admin).map((g) => (
                  <option key={g.id} value={g.id}>{g.nome}</option>
                ))}
              </select>
            </FormField>
          </form>
          <DialogFooter>
            <button type="button" onClick={() => onOpenChange(false)} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">
              Cancelar
            </button>
            <button type="submit" form="farmacia-form" disabled={saving} className="px-4 py-2 text-sm font-medium bg-brand text-white rounded-md hover:opacity-90 disabled:opacity-60">
              {saving ? "Salvando..." : "Revisar e Salvar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação */}
      <AlertDialog open={!!confirmPending} onOpenChange={(o) => { if (!o) setConfirmPending(null); }}>
        <AlertDialogContent className="sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alterações</AlertDialogTitle>
            <AlertDialogDescription>
              Revise os dados abaixo antes de salvar.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 divide-y divide-zinc-200 text-sm overflow-hidden my-1">
            <Row label="Razão social" value={confirmPending?.nome ?? "—"} />
            <Row label="Nome de fachada" value={confirmPending?.nome_fachada ?? "—"} />
            <Row
              label="Conta Meta"
              value={confirmPending?.meta_ad_account_id || "Sem conta (fora do painel de custo)"}
              mono={!!confirmPending?.meta_ad_account_id}
            />
            <Row label="Gestor" value={gestorNome} />
            <Row
              label="Meta de Receita"
              value={
                confirmPending?.meta_receita
                  ? Number(confirmPending.meta_receita).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                  : "Sem meta"
              }
              highlight={!!confirmPending?.meta_receita}
            />
            <Row
              label="Meta Leads Google"
              value={confirmPending?.meta_leads_google ? `${Number(confirmPending.meta_leads_google)} leads/semana` : "Sem meta"}
              highlight={!!confirmPending?.meta_leads_google}
            />
            <Row
              label="Meta Leads Meta"
              value={confirmPending?.meta_leads_meta ? `${Number(confirmPending.meta_leads_meta)} leads/semana` : "Sem meta"}
              highlight={!!confirmPending?.meta_leads_meta}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Voltar e editar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={saving}
              className="bg-brand hover:opacity-90"
            >
              {saving ? "Salvando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Conta de anúncios do Meta do cliente — UMA por farmácia. O custo por
 * resultado lê só esta conta; sem conta, a farmácia fica fora do painel.
 * A lista vem do Meta na hora (contas que os gestores conectados enxergam);
 * conta que já é de outro cliente aparece bloqueada.
 */
function ContaMetaCampo({
  aberto, farmaciaId, valor, onChange,
}: {
  aberto: boolean;
  farmaciaId: number | null;
  valor: string;
  onChange: (v: string) => void;
}) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["contas-meta-cadastro", farmaciaId],
    queryFn: () => getContasMetaCadastro(farmaciaId ?? undefined),
    enabled: aberto,
    staleTime: 5 * 60_000,
  });

  const contas = data?.contas ?? [];
  const sugerida = data?.sugerida ? contas.find((c) => c.id === data.sugerida) : undefined;
  // Conta gravada que nenhum token conectado enxerga: continua visível para não sumir do select.
  const foraDaLista = valor && !contas.some((c) => c.id === valor);

  return (
    <FormField label="Conta de anúncios Meta">
      <div className="flex gap-2">
        <select
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          disabled={isLoading}
          className="form-input flex-1 min-w-0"
        >
          <option value="">{isLoading ? "Carregando contas do Meta..." : "Sem conta (fora do painel de custo)"}</option>
          {foraDaLista && <option value={valor}>{valor} (não aparece nos Facebooks conectados)</option>}
          {contas.map((c) => {
            const deOutra = c.farmacia_id !== null && c.farmacia_id !== farmaciaId;
            return (
              <option key={c.id} value={c.id} disabled={deOutra}>
                {c.nome} · {c.id}{deOutra ? ` — já é de ${c.farmacia_nome}` : ""}
              </option>
            );
          })}
        </select>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          title="Buscar de novo no Meta"
          className="shrink-0 px-2 rounded-md ring-1 ring-zinc-200 text-zinc-500 hover:text-zinc-800 disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>
      {isError && (
        <p className="text-[11px] text-red-600 mt-1">Não deu para buscar as contas no Meta. Tente de novo.</p>
      )}
      {sugerida && valor !== sugerida.id && (
        <button
          type="button"
          onClick={() => onChange(sugerida.id)}
          className="mt-1 text-[11px] font-medium text-brand hover:underline text-left"
        >
          Sugestão pelo nome: {sugerida.nome} — usar esta
        </button>
      )}
      <p className="text-[11px] text-zinc-400 mt-1">
        Uma conta por cliente. É a única que entra no custo por resultado do painel.
      </p>
    </FormField>
  );
}

function Row({ label, value, highlight, mono }: { label: string; value: string; highlight?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
      <span className="text-xs text-zinc-500 shrink-0">{label}</span>
      <span className={`text-xs text-right break-all ${mono ? "font-mono" : "font-medium"} ${highlight ? "text-emerald-600 font-semibold" : "text-zinc-800"}`}>
        {value}
      </span>
    </div>
  );
}

// ── Leads helpers ──────────────────────────────────────────────────────────

function leadsStatus(pct: number): "verde" | "amarelo" | "vermelho" {
  if (pct >= 100) return "verde";
  if (pct >= 70) return "amarelo";
  return "vermelho";
}

const LEADS_STATUS_STYLE = {
  verde:    { emoji: "🟢", bar: "bg-emerald-500", text: "text-emerald-600" },
  amarelo:  { emoji: "🟡", bar: "bg-amber-500",   text: "text-amber-600"   },
  vermelho: { emoji: "🔴", bar: "bg-red-500",      text: "text-red-600"    },
};

function LeadsChannelRow({ canalNome, atual, meta }: { canalNome: string; atual: number; meta: number }) {
  const pct = meta > 0 ? (atual / meta) * 100 : 0;
  const s = LEADS_STATUS_STYLE[leadsStatus(pct)];
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-zinc-600">{s.emoji} {canalNome}</span>
        <span className={`font-semibold ${s.text}`}>{Math.round(Math.min(pct, 100))}%</span>
      </div>
      <div className="h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <div className="text-[10px] text-zinc-400">{atual} / {meta} leads</div>
    </div>
  );
}

// ── Próximo passo ──────────────────────────────────────────────────────────

/**
 * Sugestão do que o gestor faz agora com a farmácia. A ordem é a prioridade:
 * a primeira regra que bate é a que aparece.
 */
function proximoPasso(p: Farmacia, custo: CustoJanela | null): { titulo: string; texto: string; tom: Nivel } {
  if (p.nivel_alerta === "vermelho") {
    return {
      titulo: "Revisar campanhas hoje",
      texto: p.variacao_receita < 0
        ? `Receita caiu ${Math.abs(p.variacao_receita).toFixed(0)}% no período. Veja se os anúncios estão rodando e se o saldo do Meta acabou.`
        : "Farmácia em alerta no período. Veja se os anúncios estão rodando e se o saldo do Meta acabou.",
      tom: "vermelho",
    };
  }
  if (nivelSaude(custo) === "critico") {
    return {
      titulo: "Custo por conversa alto",
      texto: custo?.custo_por_resultado != null
        ? `Cada conversa está saindo a ${custo.custo_por_resultado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. Revise público e criativos.`
        : "Gastou no Meta e não gerou nenhuma conversa. Revise a campanha.",
      tom: "vermelho",
    };
  }
  if (!p.nome_fachada) {
    return { titulo: "Completar o nome de fachada", texto: "O criativo do grupo está saindo com a razão social.", tom: "amarelo" };
  }
  if (p.meta_receita == null) {
    return { titulo: "Definir meta de receita", texto: "Sem meta, não dá para saber se o resultado é bom. Combine um valor com o cliente.", tom: "amarelo" };
  }
  if (!p.meta_ad_account_id) {
    return { titulo: "Vincular a conta de anúncios", texto: "Sem conta Meta no cadastro, a farmácia fica fora do custo por resultado.", tom: "amarelo" };
  }
  if (p.nivel_alerta === "amarelo") {
    return { titulo: "Ajustar público e criativos", texto: "Resultado abaixo do esperado. Teste novos criativos ou redistribua o investimento.", tom: "amarelo" };
  }
  if (p.atingiu_meta) {
    return { titulo: "Meta batida — hora de escalar", texto: "Bom momento para aumentar o investimento e mostrar o resultado ao cliente.", tom: "verde" };
  }
  return { titulo: "Manter acompanhamento", texto: "Tudo dentro do esperado. Siga de olho no custo por conversa.", tom: "verde" };
}

// ── Main page ──────────────────────────────────────────────────────────────

type FiltroAcao = "todos" | "com_acao" | "sem_acao" | "abre_mes" | "fecha_mes";

const FILTROS_ACAO: { value: FiltroAcao; label: string }[] = [
  { value: "todos",     label: "Todas as ações" },
  { value: "com_acao",  label: "Com ação" },
  { value: "sem_acao",  label: "Sem ação" },
  { value: "abre_mes",  label: "Abre mês" },
  { value: "fecha_mes", label: "Fecha mês" },
];

function FarmaciasPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const admin = isAdmin();
  const { period } = usePeriod();

  const [query, setQuery] = useState("");
  /** Filtro pelos indicadores do topo: "ativas" = verde, "atencao" = amarelo + vermelho. */
  const [nivelFiltro, setNivelFiltro] = useState<"ativas" | "atencao" | null>(null);
  const [acaoFilter, setAcaoFilter] = useState<FiltroAcao>("todos");
  const [selId, setSelId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Farmacia | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Farmacia | null>(null);

  const { data: farmacias = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["farmacias", period],
    queryFn: () => getFarmacias({ dias: period, fase: "ativo" }),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: gestores = [] } = useQuery({
    queryKey: ["gestores"],
    queryFn: getGestores,
    enabled: admin,
  });

  const { data: custo } = useQuery({
    queryKey: ["custo-resultado", undefined],
    queryFn: () => getCustoResultado(),
  });

  /** Custo por resultado do Meta na janela do período selecionado. */
  function custoDe(farmaciaId: number): CustoJanela | null {
    const f = custo?.farmacias.find((x) => x.farmacia_id === farmaciaId);
    if (!f) return null;
    return period === 7 ? f.janela_7d : period === 15 ? f.janela_15d : f.janela_30d;
  }

  const gestorNome = (id: number | null) => (id ? gestores.find((g) => g.id === id)?.nome ?? null : null);

  const createMut = useMutation({
    mutationFn: createFarmacia,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateFarmacia>[1] }) =>
      updateFarmacia(id, data),
  });

  const deleteMut = useMutation({
    mutationFn: deleteFarmacia,
    onSuccess: () => {
      toast.success("Farmácia desativada.");
      qc.invalidateQueries({ queryKey: ["farmacias"] });
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSave = async (form: FarmaciaForm) => {
    const gestorId = form.gestor_id ? Number(form.gestor_id) : undefined;
    const hasMeta = form.meta_receita !== "" || form.meta_leads_google !== "" || form.meta_leads_meta !== "";
    try {
      let targetId: number;
      if (editTarget) {
        const patch: Parameters<typeof updateFarmacia>[1] = {
          nome: form.nome,
          nome_fachada: form.nome_fachada,
          meta_ad_account_id: form.meta_ad_account_id || null,
          telefone: form.telefone || null,
          responsavel: form.responsavel || null,
          cidade: form.cidade || null,
        };
        if (form.gestor_id !== undefined) patch.gestor_id = gestorId ?? null;
        await updateMut.mutateAsync({ id: editTarget.id, data: patch });
        targetId = editTarget.id;
      } else {
        const result = await createMut.mutateAsync({
          nome: form.nome,
          nome_fachada: form.nome_fachada,
          meta_ad_account_id: form.meta_ad_account_id || null,
          fase: form.fase,
          telefone: form.telefone || undefined,
          responsavel: form.responsavel || undefined,
          cidade: form.cidade || undefined,
          tem_chatbot: form.tem_chatbot,
          gestor_id: gestorId,
        });
        targetId = result.id;
      }
      const fase = editTarget ? editTarget.fase : form.fase;
      if (fase !== "entrada" && (editTarget || hasMeta)) {
        await setFarmaciaMeta(targetId, {
          meta_vendas: null,
          meta_receita: form.meta_receita ? Number(form.meta_receita) : null,
          meta_leads_google: form.meta_leads_google ? Number(form.meta_leads_google) : null,
          meta_leads_meta: form.meta_leads_meta ? Number(form.meta_leads_meta) : null,
        });
      }
      toast.success(editTarget ? "Farmácia atualizada!" : "Farmácia criada com sucesso!");
      qc.invalidateQueries({ queryKey: ["farmacias"] });
      setDialogOpen(false);
      setEditTarget(null);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const saving = createMut.isPending || updateMut.isPending;

  // Saúde da carteira: sempre sobre a carteira inteira, sem os filtros da lista
  const comDados = farmacias.filter((p) => !semDados(p));
  const receitaCarteira = comDados.reduce((s, p) => s + p.receita_total, 0);
  const vendasCarteira = comDados.reduce((s, p) => s + p.vendas_realizadas, 0);
  const contagem: Record<Nivel, number> = { vermelho: 0, amarelo: 0, verde: 0 };
  comDados.forEach((p) => { contagem[p.nivel_alerta]++; });
  const totalSemDados = farmacias.length - comDados.length;

  const filtradas = useMemo(() => {
    const termo = query.trim().toLowerCase();
    return farmacias.filter((p) => {
      if (termo) {
        const alvo = [p.nome, p.nome_fachada, p.cidade, gestorNome(p.gestor_id)].filter(Boolean).join(" ").toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      if (nivelFiltro && (semDados(p) || (nivelFiltro === "ativas") !== (p.nivel_alerta === "verde"))) return false;
      if (acaoFilter === "com_acao")  return (p.acoes_ativas?.length ?? 0) > 0;
      if (acaoFilter === "sem_acao")  return (p.acoes_ativas?.length ?? 0) === 0;
      if (acaoFilter === "abre_mes")  return p.acoes_ativas?.some((a) => a.tipo === "abre_mes") ?? false;
      if (acaoFilter === "fecha_mes") return p.acoes_ativas?.some((a) => a.tipo === "fecha_mes") ?? false;
      return true;
    });
  }, [farmacias, query, nivelFiltro, acaoFilter, gestores]); // eslint-disable-line react-hooks/exhaustive-deps

  const grupos = GRUPOS.map((g) => ({
    ...g,
    itens: filtradas
      .filter((p) => !semDados(p) && p.nivel_alerta === g.nivel)
      .sort((a, b) => b.score_criticidade - a.score_criticidade),
  }));
  const aguardando = filtradas.filter(semDados);
  const ordenadas = [...grupos.flatMap((g) => g.itens), ...aguardando];
  const atual = ordenadas.find((p) => p.id === selId) ?? ordenadas[0] ?? null;

  // Abaixo de xl não há painel lateral: o clique vai direto para a página da farmácia
  function abrir(p: Farmacia) {
    if (window.matchMedia("(min-width: 1280px)").matches) setSelId(p.id);
    else navigate({ to: "/farmacias/$id", params: { id: String(p.id) } });
  }

  function editar(p: Farmacia) {
    setEditTarget(p);
    setDialogOpen(true);
  }

  const linha = (p: Farmacia) => (
    <LinhaFarmacia
      key={p.id}
      p={p}
      gestor={gestorNome(p.gestor_id)}
      selecionada={atual?.id === p.id}
      onClick={() => abrir(p)}
    />
  );

  return (
    <AppShell title="Farmácias" hideHeader larguraTotal>
      <FarmaciasCabecalho
        subtitulo={<>
          {farmacias.length} unidades cadastradas · últimos {period} dias
          {totalSemDados > 0 && ` · ${totalSemDados} sem dados no período`}
        </>}
        atualizando={isFetching}
        onAtualizar={() => refetch()}
        acao={admin && (
          <button onClick={() => { setEditTarget(null); setDialogOpen(true); }} className={CLASSE_ACAO_TOPO}>
            <Plus className="size-4" /> Nova farmácia
          </button>
        )}
      >
        <IndicadorTopo icone={TrendingUp} rotulo="Receita total" carregando={isLoading} valor={fmtBRL(receitaCarteira)} />
        <IndicadorTopo icone={Store} rotulo="Vendas" carregando={isLoading} valor={vendasCarteira.toLocaleString("pt-BR")} />
        <IndicadorTopo
          icone={CheckCircle2}
          rotulo="Ativas"
          carregando={isLoading}
          valor={`${contagem.verde}/${farmacias.length}`}
          ativo={nivelFiltro === "ativas"}
          onClick={() => setNivelFiltro(nivelFiltro === "ativas" ? null : "ativas")}
        />
        <IndicadorTopo
          icone={AlertTriangle}
          rotulo="Em atenção"
          carregando={isLoading}
          valor={String(contagem.vermelho + contagem.amarelo)}
          detalhe={`${contagem.vermelho} em alerta · ${contagem.amarelo} atenção`}
          ativo={nivelFiltro === "atencao"}
          onClick={() => setNivelFiltro(nivelFiltro === "atencao" ? null : "atencao")}
        />
      </FarmaciasCabecalho>

      <div className={`grid items-start gap-6 ${atual ? "xl:grid-cols-[minmax(0,1fr)_380px]" : ""}`}>
        {/* Lista */}
        <section className="rounded-2xl bg-white ring-1 ring-black/5 shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 p-4">
            <FarmaciasTabs />
            <label className="flex h-10 flex-1 min-w-56 items-center gap-2 rounded-xl px-3 ring-1 ring-zinc-200 focus-within:ring-zinc-400">
              <Search className="size-4 text-zinc-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={admin ? "Buscar farmácia, cidade ou gestor…" : "Buscar farmácia ou cidade…"}
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
            <div className="flex items-center gap-1.5">
              <Megaphone className="size-3.5 text-zinc-400 shrink-0" />
              <select
                value={acaoFilter}
                onChange={(e) => setAcaoFilter(e.target.value as FiltroAcao)}
                className="h-10 rounded-xl px-2 text-sm text-zinc-700 bg-white ring-1 ring-zinc-200 outline-none"
              >
                {FILTROS_ACAO.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            {nivelFiltro && (
              <button
                onClick={() => setNivelFiltro(null)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${grupoDo(nivelFiltro === "ativas" ? "verde" : "amarelo").selo}`}
              >
                {nivelFiltro === "ativas" ? "Só ativas" : "Só em atenção"} ✕
              </button>
            )}
          </div>

          {isLoading && (
            <div className="divide-y divide-zinc-100">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 px-4 py-3"><div className="h-full rounded-lg bg-zinc-100 animate-pulse" /></div>
              ))}
            </div>
          )}

          {!isLoading && grupos.map((g) => g.itens.length > 0 && (
            <div key={g.nivel}>
              <CabecalhoGrupo ponto={g.ponto} titulo={g.titulo} detalhe={`${g.itens.length} ${g.dica}`} />
              {g.itens.map(linha)}
            </div>
          ))}

          {!isLoading && aguardando.length > 0 && (
            <div>
              <CabecalhoGrupo ponto="bg-zinc-300" titulo="Aguardando dados" detalhe={`${aguardando.length} sem coleta no período`} />
              {aguardando.map(linha)}
            </div>
          )}

          {!isLoading && filtradas.length === 0 && (
            <p className="p-12 text-center text-sm text-zinc-500">
              {acaoFilter !== "todos" ? "Nenhuma farmácia com este filtro de ação." : "Nenhuma farmácia encontrada."}
            </p>
          )}
        </section>

        {/* Detalhe */}
        {atual && (
          <PainelFarmacia
            key={atual.id}
            p={atual}
            gestor={gestorNome(atual.gestor_id)}
            custo={custoDe(atual.id)}
            period={period}
            admin={admin}
            onEditar={() => editar(atual)}
            onDesativar={() => setDeleteTarget(atual)}
          />
        )}
      </div>

      {/* Create / Edit dialog */}
      {admin && (
        <FarmaciaDialog
          open={dialogOpen}
          onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditTarget(null); }}
          editing={editTarget}
          gestores={gestores}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar farmácia?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.nome}" será removida das listagens. Os dados históricos são preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </AppShell>
  );
}

// ── Lista ──────────────────────────────────────────────────────────────────

function CabecalhoGrupo({ ponto, titulo, detalhe }: { ponto: string; titulo: string; detalhe: string }) {
  return (
    <div className="flex items-center gap-2 bg-zinc-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500 border-y border-zinc-100">
      <span className={`size-2 rounded-full ${ponto}`} />
      {titulo}
      <span className="font-medium normal-case tracking-normal text-zinc-400">· {detalhe}</span>
    </div>
  );
}

function LinhaFarmacia({
  p, gestor, selecionada, onClick,
}: {
  p: Farmacia;
  gestor: string | null;
  selecionada: boolean;
  onClick: () => void;
}) {
  const vazia = semDados(p);
  const acoes = p.acoes_ativas?.length ?? 0;
  const pct = p.percentual_meta_receita;
  const cor = pct != null ? corMeta(pct) : null;

  return (
    <button
      onClick={onClick}
      className={`grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 border-l-4 px-4 py-3 text-left transition-colors hover:bg-zinc-50 ${
        selecionada ? "border-l-brand bg-red-50/40" : "border-l-transparent"
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="truncate text-sm font-bold text-zinc-900">{nomeVisivel(p)}</p>
          {!p.nome_fachada && (
            <span
              title="Sem nome de fachada — o criativo do grupo está saindo com a razão social"
              className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold bg-red-100 text-red-700 ring-1 ring-red-200"
            >
              SEM FACHADA
            </span>
          )}
          {!p.tem_chatbot && (
            <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold bg-sky-50 text-sky-600 ring-1 ring-sky-200">
              Sem ChatBot
            </span>
          )}
          {acoes > 0 && (
            <span title={`${acoes} ação(ões) ativa(s)`} className="shrink-0 flex items-center gap-0.5 text-[10px] font-semibold text-zinc-500">
              <Megaphone className="size-3" />{acoes}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-zinc-500">
          {[gestor, vazia ? "Aguardando dados" : `${p.total_atendimentos} atendimentos`, !vazia && `#${p.posicao_ranking} no ranking`]
            .filter(Boolean).join(" · ")}
        </p>
      </div>

      {/* Progresso da meta de receita */}
      <div className="hidden sm:block w-28">
        {vazia ? null : pct != null && cor ? (
          <>
            <div className="flex justify-between text-[10px] text-zinc-400">
              <span>Meta</span>
              <span className={`font-semibold ${cor.texto}`}>{pct.toFixed(0)}%</span>
            </div>
            <div className="mt-0.5 h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
              <div className={`h-full rounded-full ${cor.barra}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          </>
        ) : (
          <p className="text-[10px] text-zinc-300 text-right">sem meta</p>
        )}
      </div>

      <div className="w-24 text-right">
        {vazia ? (
          <p className="text-xs text-zinc-300">—</p>
        ) : (
          <>
            <p className="font-mono text-sm font-bold text-zinc-900">{fmtCompacto(p.receita_total)}</p>
            <Variacao value={p.variacao_receita} />
          </>
        )}
      </div>
    </button>
  );
}

// ── Painel lateral ─────────────────────────────────────────────────────────

const TOM_PASSO: Record<Nivel, string> = {
  vermelho: "border-l-red-500 bg-red-50",
  amarelo: "border-l-amber-500 bg-amber-50",
  verde: "border-l-emerald-500 bg-emerald-50",
};

function PainelFarmacia({
  p, gestor, custo, period, admin, onEditar, onDesativar,
}: {
  p: Farmacia;
  gestor: string | null;
  custo: CustoJanela | null;
  period: Period;
  admin: boolean;
  onEditar: () => void;
  onDesativar: () => void;
}) {
  const navigate = useNavigate();
  const vazia = semDados(p);
  const grupo = grupoDo(p.nivel_alerta);
  const pct = p.percentual_meta_receita;
  const cor = pct != null ? corMeta(pct) : null;
  const passo = proximoPasso(p, custo);
  const saude = nivelSaude(custo);
  const C = 2 * Math.PI * 42;

  const { data: evolucao = [], isLoading: carregandoEvolucao } = useQuery({
    queryKey: ["farmacia-evolucao", p.id, period],
    queryFn: () => getFarmaciaEvolucaoPorPeriodo(p.id, period),
    enabled: !vazia,
  });

  const leadsDe = (termo: string) => p.canais?.find((c) => c.nome.toLowerCase().includes(termo))?.atendimentos ?? 0;

  return (
    <aside className="hidden xl:block sticky top-6 space-y-4 rounded-2xl bg-white ring-1 ring-black/5 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-extrabold leading-tight text-zinc-900">{nomeVisivel(p)}</p>
          <p className="truncate text-xs text-zinc-500">
            {[p.nome_fachada ? p.nome : null, gestor && `Gestor ${gestor}`].filter(Boolean).join(" · ") || " "}
          </p>
        </div>
        {!vazia && (
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${grupo.selo}`}>{grupo.rotulo}</span>
        )}
      </div>

      {vazia ? (
        <p className="rounded-xl bg-zinc-50 p-6 text-center text-sm text-zinc-400 italic">
          Nenhum dado coletado nos últimos {period} dias.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-5">
            <div className="relative size-24 shrink-0">
              <svg viewBox="0 0 100 100" className="size-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" strokeWidth="10" className="stroke-zinc-100" />
                {pct != null && cor && (
                  <circle
                    cx="50" cy="50" r="42" fill="none" strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(pct, 100) / 100)}
                    className={cor.traco}
                  />
                )}
              </svg>
              <div className="absolute inset-0 grid place-items-center text-center">
                {pct != null
                  ? <div><p className="font-mono text-lg font-bold">{Math.round(pct)}%</p><p className="text-[10px] text-zinc-400">da meta</p></div>
                  : <p className="text-[11px] font-semibold text-zinc-400 leading-tight">sem<br />meta</p>}
              </div>
            </div>
            <div className="space-y-0.5 min-w-0">
              <p className="text-xs text-zinc-500">Receita · {period} dias</p>
              <p className="font-mono text-2xl font-bold text-zinc-900">{fmtBRL(p.receita_total)}</p>
              <Variacao value={p.variacao_receita} />
              {p.meta_receita != null && <p className="text-xs text-zinc-400">Meta: {fmtBRL(p.meta_receita)}</p>}
            </div>
          </div>

          <EvolucaoReceita pontos={evolucao.map((e) => e.receita_total)} carregando={carregandoEvolucao} />

          <div className="grid grid-cols-2 gap-2.5">
            <Mini rotulo="Vendas" valor={String(p.vendas_realizadas)} extra={<Variacao value={p.variacao_vendas} />} />
            <Mini rotulo="Atendimentos" valor={String(p.total_atendimentos)} extra={<Variacao value={p.variacao_atendimentos} />} />
            {p.meta_ad_account_id ? (
              <>
                <Mini rotulo="Investido no Meta" valor={custo ? fmtBRL(custo.gasto) : "—"} extra={custo && <span className="text-[11px] text-zinc-400">{custo.resultados} conversas</span>} />
                <Mini
                  rotulo="Custo / conversa"
                  valor={custo?.custo_por_resultado != null ? custo.custo_por_resultado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                  extra={<span className={`inline-block rounded px-1.5 text-[10px] font-semibold ring-1 ${ESTILO_SAUDE[saude].selo}`}>{ESTILO_SAUDE[saude].rotulo}</span>}
                />
              </>
            ) : (
              <p className="col-span-2 rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-400">
                Sem conta de anúncios Meta — fora do custo por resultado.
              </p>
            )}
          </div>

          {(p.meta_leads_google !== null || p.meta_leads_meta !== null) && (
            <div className="space-y-2 rounded-xl ring-1 ring-zinc-100 p-3">
              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Leads da semana</p>
              {p.meta_leads_google !== null && <LeadsChannelRow canalNome="Google" atual={leadsDe("google")} meta={p.meta_leads_google} />}
              {p.meta_leads_meta !== null && <LeadsChannelRow canalNome="Meta" atual={leadsDe("meta")} meta={p.meta_leads_meta} />}
            </div>
          )}

          <div className={`rounded-xl border-l-4 p-4 ${TOM_PASSO[passo.tom]}`}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Próximo passo</p>
            <p className="mt-1 font-bold text-zinc-900">{passo.titulo}</p>
            <p className="mt-1 text-sm text-zinc-600">{passo.texto}</p>
          </div>
        </>
      )}

      {p.acoes_ativas && p.acoes_ativas.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {p.acoes_ativas.map((a) => (
            <button
              key={a.id}
              onClick={() => navigate({ to: "/acoes/$id", params: { id: String(a.id) } })}
              title={`${a.tipo} · ${a.status}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white truncate max-w-[160px] hover:opacity-80 transition-opacity"
              style={{ backgroundColor: a.cor ?? "#6B7280" }}
            >
              <Megaphone className="size-2.5 shrink-0" />
              <span className="truncate">{a.nome}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => navigate({ to: "/farmacias/$id", params: { id: String(p.id) } })}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-zinc-900 py-2 text-xs font-semibold text-white hover:opacity-90"
        >
          <ExternalLink className="size-3.5" /> Ver detalhes
        </button>
        {admin && (
          <>
            <button onClick={onEditar} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg ring-1 ring-zinc-200 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
              <Pencil className="size-3.5" /> Editar
            </button>
            <button onClick={onEditar} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg ring-1 ring-zinc-200 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
              <Target className="size-3.5" /> Metas
            </button>
            <button onClick={onDesativar} title="Desativar" className="flex items-center justify-center rounded-lg px-3 py-2 text-red-500 hover:bg-red-50">
              <Trash2 className="size-3.5" />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

/** Receita semana a semana dentro do período (vw_evolucao_semanal). */
function EvolucaoReceita({ pontos, carregando }: { pontos: number[]; carregando: boolean }) {
  if (carregando) return <div className="h-20 rounded-xl bg-zinc-50 animate-pulse" />;
  if (pontos.length < 2) {
    return <p className="rounded-xl bg-zinc-50 px-3 py-4 text-center text-xs text-zinc-400">Histórico semanal insuficiente para o gráfico.</p>;
  }
  const W = 300, H = 56;
  const max = Math.max(...pontos, 1);
  const xy = pontos.map((v, i) => `${(i / (pontos.length - 1)) * W},${H - (v / max) * (H - 4) - 2}`).join(" ");
  const subiu = pontos[pontos.length - 1] >= pontos[0];
  return (
    <div className="rounded-xl bg-zinc-50 p-3">
      <p className="mb-1 text-[11px] text-zinc-400">Receita por semana</p>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={`h-14 w-full ${subiu ? "text-emerald-500" : "text-red-500"}`}>
        <polyline points={xy} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function Mini({ rotulo, valor, extra }: { rotulo: string; valor: string; extra?: ReactNode }) {
  return (
    <div className="rounded-xl ring-1 ring-zinc-100 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{rotulo}</p>
      <p className="mt-0.5 font-mono text-base font-bold text-zinc-900">{valor}</p>
      {extra}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
