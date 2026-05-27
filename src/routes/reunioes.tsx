import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  CalendarDays, Plus, X, Clock, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, Calendar, Building2, Search,
  Pencil, Trash2, AlertCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { getFarmacias } from "@/lib/api";
import {
  criarReuniao,
  atualizarReuniao,
  excluirReuniao,
  reunioesDaFarmacia,
  totalReunioesMes,
  totalReunioesGeral,
  proximaReuniao,
  fmtDataHora,
  fmtDataCurta,
  listarReunioes,
  type Reuniao,
  type ReuniaoStatus,
} from "@/lib/reunioes";
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

// ── Rota ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/reunioes")({
  component: ReunioesPage,
  head: () => ({ meta: [{ title: "Reuniões — PharmaFlow" }] }),
});

// ── Helpers ────────────────────────────────────────────────────────────────

const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const hojeHora = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const mesAtual = () => {
  const d = new Date();
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
};

function statusConfig(s: ReuniaoStatus) {
  if (s === "realizada")  return { label: "Realizada",  icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-50 ring-emerald-200" };
  if (s === "cancelada")  return { label: "Cancelada",  icon: XCircle,      cls: "text-red-500 bg-red-50 ring-red-200"             };
  return                         { label: "Agendada",   icon: Clock,        cls: "text-blue-600 bg-blue-50 ring-blue-200"           };
}

function isProxima(r: Reuniao): boolean {
  const agora = new Date().toISOString().slice(0, 16);
  return r.status === "agendada" && `${r.data}T${r.hora}` >= agora;
}

// ── Modal de agendamento / edição ──────────────────────────────────────────

interface ReuniaoForm {
  data: string;
  hora: string;
  observacao: string;
  status: ReuniaoStatus;
}

function ReuniaoDialog({
  open,
  onOpenChange,
  farmaciaId,
  farmaciaNome,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  farmaciaId: number;
  farmaciaNome: string;
  editing: Reuniao | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ReuniaoForm>({
    data: editing?.data ?? hoje(),
    hora: editing?.hora ?? hojeHora(),
    observacao: editing?.observacao ?? "",
    status: editing?.status ?? "agendada",
  });

  useEffect(() => {
    setForm({
      data: editing?.data ?? hoje(),
      hora: editing?.hora ?? hojeHora(),
      observacao: editing?.observacao ?? "",
      status: editing?.status ?? "agendada",
    });
  }, [editing, open]);

  function handleSave() {
    if (!form.data || !form.hora) {
      toast.error("Preencha a data e o horário.");
      return;
    }
    if (editing) {
      atualizarReuniao(editing.id, {
        data: form.data,
        hora: form.hora,
        observacao: form.observacao,
        status: form.status,
      });
      toast.success("Reunião atualizada!");
    } else {
      criarReuniao(farmaciaId, farmaciaNome, form.data, form.hora, form.observacao);
      toast.success("Reunião agendada!");
    }
    onSaved();
    onOpenChange(false);
  }

  const set = <K extends keyof ReuniaoForm>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value as ReuniaoForm[K] }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="size-4 text-brand" />
            {editing ? "Editar Reunião" : "Agendar Reunião"}
          </DialogTitle>
          <p className="text-xs text-zinc-500 mt-0.5">{farmaciaNome}</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Data + Hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Data</label>
              <input
                type="date"
                value={form.data}
                onChange={set("data")}
                className="mt-1 form-input w-full"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Horário</label>
              <input
                type="time"
                value={form.hora}
                onChange={set("hora")}
                className="mt-1 form-input w-full"
              />
            </div>
          </div>

          {/* Observação */}
          <div>
            <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">
              Observação / Pauta
            </label>
            <textarea
              value={form.observacao}
              onChange={set("observacao")}
              rows={3}
              placeholder="Ex: Apresentação de resultados do mês, ajuste de metas..."
              className="mt-1 form-input w-full resize-none"
            />
          </div>

          {/* Status (só aparece na edição) */}
          {editing && (
            <div>
              <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Status</label>
              <select value={form.status} onChange={set("status")} className="mt-1 form-input w-full">
                <option value="agendada">Agendada</option>
                <option value="realizada">Realizada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium bg-brand text-white rounded-md hover:opacity-90"
          >
            {editing ? "Salvar alterações" : "Agendar"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Card de farmácia ───────────────────────────────────────────────────────

function FarmaciaCard({
  farmaciaId,
  farmaciaNome,
  tick,
  onRefresh,
}: {
  farmaciaId: number;
  farmaciaNome: string;
  tick: number;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Reuniao | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Reuniao | null>(null);

  const { ano, mes } = mesAtual();
  const reunioes = reunioesDaFarmacia(farmaciaId);
  const totalMes = totalReunioesMes(farmaciaId, ano, mes);
  const totalGeral = totalReunioesGeral(farmaciaId);
  const proxima = proximaReuniao(farmaciaId);

  // Refresh quando tick muda
  // eslint-disable-next-line react-hooks/exhaustive-deps
  void tick;

  function handleDelete() {
    if (!deleteTarget) return;
    excluirReuniao(deleteTarget.id);
    toast.success("Reunião removida.");
    setDeleteTarget(null);
    onRefresh();
  }

  function handleStatusChange(r: Reuniao, status: ReuniaoStatus) {
    atualizarReuniao(r.id, { status });
    toast.success(`Marcada como ${status}.`);
    onRefresh();
  }

  return (
    <>
      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
        {/* Header do card */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            {/* Nome + badges de contagem */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Building2 className="size-4 text-zinc-400 shrink-0" />
                <h3 className="text-sm font-semibold text-zinc-900 truncate">{farmaciaNome}</h3>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Badge mês */}
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-brand/10 text-brand ring-1 ring-brand/20">
                  <Calendar className="size-3" />
                  {totalMes} {totalMes === 1 ? "reunião" : "reuniões"} este mês
                </span>
                {/* Badge total */}
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200">
                  {totalGeral} no total
                </span>
              </div>
            </div>

            {/* Botão agendar */}
            <button
              onClick={() => { setEditing(null); setDialogOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand text-white rounded-lg hover:opacity-90 shrink-0"
            >
              <Plus className="size-3.5" />
              Agendar
            </button>
          </div>

          {/* Próxima reunião */}
          {proxima ? (
            <div className="mt-3 p-3 rounded-lg bg-blue-50 ring-1 ring-blue-100 flex items-start gap-2">
              <Clock className="size-3.5 text-blue-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-blue-700">Próxima reunião</p>
                <p className="text-xs text-blue-600">{fmtDataHora(proxima.data, proxima.hora)}</p>
                {proxima.observacao && (
                  <p className="text-[11px] text-blue-500 mt-0.5 truncate">{proxima.observacao}</p>
                )}
              </div>
            </div>
          ) : reunioes.length === 0 ? (
            <div className="mt-3 p-3 rounded-lg bg-zinc-50 ring-1 ring-zinc-100 flex items-center gap-2">
              <AlertCircle className="size-3.5 text-zinc-300 shrink-0" />
              <p className="text-[11px] text-zinc-400 italic">Nenhuma reunião agendada ainda.</p>
            </div>
          ) : (
            <div className="mt-3 p-3 rounded-lg bg-zinc-50 ring-1 ring-zinc-100 flex items-center gap-2">
              <CheckCircle2 className="size-3.5 text-zinc-300 shrink-0" />
              <p className="text-[11px] text-zinc-400 italic">Sem próxima reunião agendada.</p>
            </div>
          )}
        </div>

        {/* Botão expandir histórico */}
        {reunioes.length > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full px-5 py-2.5 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500 hover:bg-zinc-50 transition-colors"
          >
            <span className="font-medium">
              {expanded ? "Ocultar histórico" : `Ver histórico (${reunioes.length})`}
            </span>
            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
        )}

        {/* Histórico expandido */}
        {expanded && reunioes.length > 0 && (
          <div className="border-t border-zinc-100 divide-y divide-zinc-50">
            {reunioes.map((r) => {
              const sc = statusConfig(r.status);
              const StatusIcon = sc.icon;
              const upcoming = isProxima(r);
              return (
                <div
                  key={r.id}
                  className={`px-5 py-3 flex items-start gap-3 ${upcoming ? "bg-blue-50/40" : ""}`}
                >
                  {/* Ícone de status */}
                  <StatusIcon className={`size-4 mt-0.5 shrink-0 ${sc.cls.split(" ")[0]}`} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-zinc-800">
                        {fmtDataHora(r.data, r.hora)}
                      </span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ring-1 ${sc.cls}`}>
                        {sc.label}
                      </span>
                    </div>
                    {r.observacao && (
                      <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">{r.observacao}</p>
                    )}
                  </div>

                  {/* Ações rápidas */}
                  <div className="flex items-center gap-1 shrink-0">
                    {r.status === "agendada" && (
                      <button
                        onClick={() => handleStatusChange(r, "realizada")}
                        title="Marcar como realizada"
                        className="p-1 rounded hover:bg-emerald-50 text-zinc-400 hover:text-emerald-600 transition-colors"
                      >
                        <CheckCircle2 className="size-3.5" />
                      </button>
                    )}
                    {r.status === "agendada" && (
                      <button
                        onClick={() => handleStatusChange(r, "cancelada")}
                        title="Cancelar reunião"
                        className="p-1 rounded hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors"
                      >
                        <XCircle className="size-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => { setEditing(r); setDialogOpen(true); }}
                      title="Editar"
                      className="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(r)}
                      title="Excluir"
                      className="p-1 rounded hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal agendar / editar */}
      <ReuniaoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        farmaciaId={farmaciaId}
        farmaciaNome={farmaciaNome}
        editing={editing}
        onSaved={onRefresh}
      />

      {/* Confirmar exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir reunião?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>Reunião de <strong>{fmtDataCurta(deleteTarget.data)}</strong> às <strong>{deleteTarget.hora}</strong> será removida permanentemente.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Página principal ───────────────────────────────────────────────────────

function ReunioesPage() {
  const [tick, setTick] = useState(0);
  const [busca, setBusca] = useState("");

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const { data: farmacias = [], isLoading } = useQuery({
    queryKey: ["farmacias"],
    queryFn: () => getFarmacias(),
    staleTime: 60_000,
  });

  // Estatísticas globais
  const { ano, mes } = mesAtual();
  const todasReunioes = listarReunioes();
  const totalGeralMes = todasReunioes.filter((r) => {
    const prefix = `${ano}-${String(mes).padStart(2, "0")}`;
    return r.data.startsWith(prefix) && r.status !== "cancelada";
  }).length;
  const totalGeralHistorico = todasReunioes.filter((r) => r.status !== "cancelada").length;
  const totalAgendadas = todasReunioes.filter((r) => r.status === "agendada" && isProxima(r)).length;

  // Filtro de busca
  const farmaciasFiltradas = farmacias.filter((f) =>
    f.nome.toLowerCase().includes(busca.toLowerCase()),
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  void tick; // força re-render nas atualizações

  return (
    <AppShell title="Reuniões com Clientes">
      {/* ── Estatísticas globais ── */}
      <section className="grid grid-cols-3 gap-4">
        <StatCard
          icon={<Calendar className="size-5 text-brand" />}
          label="Reuniões este mês"
          value={totalGeralMes}
          bg="bg-brand/5"
        />
        <StatCard
          icon={<CheckCircle2 className="size-5 text-emerald-500" />}
          label="Total realizadas (histórico)"
          value={totalGeralHistorico}
          bg="bg-emerald-50"
        />
        <StatCard
          icon={<Clock className="size-5 text-blue-500" />}
          label="Agendadas (futuras)"
          value={totalAgendadas}
          bg="bg-blue-50"
        />
      </section>

      {/* ── Busca ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl ring-1 ring-black/5 shadow-sm">
        <Search className="size-4 text-zinc-400 shrink-0" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar farmácia..."
          className="bg-transparent outline-none text-sm flex-1"
        />
        {busca && (
          <button onClick={() => setBusca("")} className="text-zinc-400 hover:text-zinc-700">
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* ── Lista de farmácias ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl ring-1 ring-black/5 h-40 animate-pulse" />
          ))}
        </div>
      ) : farmaciasFiltradas.length === 0 ? (
        <div className="text-center py-16 text-zinc-400 text-sm">
          {busca ? `Nenhuma farmácia encontrada para "${busca}".` : "Nenhuma farmácia cadastrada."}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {farmaciasFiltradas.map((f) => (
            <FarmaciaCard
              key={f.id}
              farmaciaId={f.id}
              farmaciaNome={f.nome}
              tick={tick}
              onRefresh={refresh}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  bg: string;
}) {
  return (
    <div className={`${bg} rounded-xl ring-1 ring-black/5 shadow-sm p-5 flex items-center gap-4`}>
      <div className="size-10 rounded-xl bg-white/70 grid place-items-center shadow-sm shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-zinc-900">{value}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}
