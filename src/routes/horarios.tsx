import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Clock, Plus, Trash2, Loader2, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  getHorariosDisparo, criarHorarioDisparo, removerHorarioDisparo,
  type HorarioDisparo,
} from "@/lib/api";

export const Route = createFileRoute("/horarios")({
  component: HorariosPage,
  head: () => ({ meta: [{ title: "Horários de Disparo — GrupoSymbol" }] }),
});

/**
 * Horários pré-definidos que aparecem no agendamento do disparo. A lista é por
 * gestor — cada operação tem os seus horários de pico.
 */
function HorariosPage() {
  const queryClient = useQueryClient();
  const [horario, setHorario] = useState("09:00");
  const [rotulo, setRotulo] = useState("");

  const { data: horarios = [], isLoading } = useQuery({
    queryKey: ["horarios-disparo"],
    queryFn: getHorariosDisparo,
  });

  const adicionar = useMutation({
    mutationFn: () => criarHorarioDisparo(horario, rotulo.trim() || null),
    onSuccess: (lista) => {
      queryClient.setQueryData(["horarios-disparo"], lista);
      setRotulo("");
      toast.success("Horário adicionado.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Não foi possível adicionar."),
  });

  const remover = useMutation({
    mutationFn: (id: number) => removerHorarioDisparo(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<HorarioDisparo[]>(["horarios-disparo"], (atual) =>
        (atual ?? []).filter((h) => h.id !== id));
      toast.success("Horário removido.");
    },
    onError: () => toast.error("Não foi possível remover."),
  });

  const jaExiste = horarios.some((h) => h.horario === horario);

  return (
    <AppShell title="Horários de Disparo">
      <div className="max-w-2xl mx-auto space-y-5">
        <Link
          to="/configuracoes"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 transition"
        >
          <ChevronLeft className="size-4" /> Configurações
        </Link>

        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-5">
          <div className="flex items-start gap-3">
            <CalendarClock className="size-5 text-brand shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-zinc-900">
                Horários que aparecem no agendamento
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Ao agendar uma campanha, o gestor escolhe um destes num clique em vez de digitar a
                hora. Continua sendo possível digitar um horário fora da lista.
              </p>
            </div>
          </div>

          {/* Novo horário */}
          <div className="flex flex-wrap items-end gap-3 mt-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-600">Horário</label>
              <input
                type="time"
                value={horario}
                onChange={(e) => setHorario(e.target.value)}
                className="px-3 py-2 rounded-lg border border-zinc-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1 min-w-[12rem]">
              <label className="text-xs font-medium text-zinc-600">Nome (opcional)</label>
              <input
                value={rotulo}
                onChange={(e) => setRotulo(e.target.value)}
                maxLength={40}
                placeholder="Ex.: Abertura da farmácia"
                className="px-3 py-2 rounded-lg border border-zinc-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
            <button
              onClick={() => adicionar.mutate()}
              disabled={adicionar.isPending || jaExiste}
              title={jaExiste ? "Esse horário já está na lista" : "Adicionar horário"}
              className="bg-brand hover:bg-brand/90 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition shadow-sm"
            >
              {adicionar.isPending
                ? <Loader2 className="size-4 animate-spin" />
                : <Plus className="size-4" />}
              Adicionar
            </button>
          </div>
          {jaExiste && (
            <p className="text-[11px] text-amber-600 mt-2">
              {horario} já está na lista.
            </p>
          )}
        </div>

        {/* Lista */}
        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-zinc-400 text-sm">
              <Loader2 className="size-4 animate-spin" /> Carregando...
            </div>
          ) : horarios.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-400">
              Nenhum horário na lista. Adicione o primeiro acima.
            </div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {horarios.map((h) => (
                <div key={h.id} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="size-9 rounded-lg bg-brand/10 text-brand grid place-items-center shrink-0">
                    <Clock className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-900">{h.horario}</p>
                    {h.rotulo && <p className="text-[11px] text-zinc-500">{h.rotulo}</p>}
                  </div>
                  <button
                    onClick={() => remover.mutate(h.id)}
                    disabled={remover.isPending}
                    title="Remover"
                    className="size-8 rounded-lg grid place-items-center text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 transition"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-[11px] text-zinc-400 text-center">
          Os horários valem para os seus agendamentos. Todo disparo agendado é conferido pelo
          sistema a cada minuto — o horário aqui é o de Brasília.
        </p>
      </div>
    </AppShell>
  );
}
