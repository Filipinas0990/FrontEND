import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Play, Clock, CheckCircle2, AlertCircle, Power } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/automacoes")({
  component: AutomacoesPage,
  head: () => ({ meta: [{ title: "Automações — PharmaFlow" }] }),
});

const jobs = [
  { name: "Extração Meta Ads", schedule: "Domingo 23:00", last: "há 4 dias", status: "ok" },
  { name: "Extração Google Ads", schedule: "Domingo 23:15", last: "há 4 dias", status: "ok" },
  { name: "Geração XLSX (70 farmácias)", schedule: "Domingo 23:45", last: "há 4 dias", status: "ok" },
  { name: "Push para Power BI", schedule: "Segunda 00:01", last: "há 4 dias", status: "ok" },
  { name: "Notificação WhatsApp Clientes", schedule: "Segunda 08:00", last: "há 4 dias", status: "warn" },
];

function AutomacoesPage() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(jobs.map((j) => [j.name, true]))
  );

  return (
    <AppShell title="Automações">
      <div className="bg-gradient-to-br from-brand to-emerald-700 rounded-xl p-6 text-white flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider opacity-80 font-medium">Próxima Execução Agendada</p>
          <h2 className="text-3xl font-bold mt-1">Domingo, 23:59</h2>
          <p className="text-sm opacity-80 mt-1 font-mono">automacao_v4.py — em 3 dias, 14 horas</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-white text-brand rounded-lg text-sm font-semibold hover:bg-white/90">
          <Play className="size-4" fill="currentColor" /> Executar Agora
        </button>
      </div>

      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100">
          <h3 className="text-sm font-semibold">Jobs Agendados</h3>
        </div>
        <div className="divide-y divide-zinc-100">
          {jobs.map((j) => (
            <div key={j.name} className="p-5 flex items-center gap-4 hover:bg-zinc-50/50">
              <div className={`size-9 rounded-lg grid place-items-center ${enabled[j.name] ? "bg-brand/10 text-brand" : "bg-zinc-100 text-zinc-400"}`}>
                {j.status === "ok" ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{j.name}</p>
                <p className="text-[10px] text-zinc-500 flex items-center gap-3 mt-0.5">
                  <span className="flex items-center gap-1"><Clock className="size-3" /> {j.schedule}</span>
                  <span>Última execução: {j.last}</span>
                </p>
              </div>
              <button
                onClick={() => setEnabled((s) => ({ ...s, [j.name]: !s[j.name] }))}
                className={`relative w-10 h-6 rounded-full transition-colors ${enabled[j.name] ? "bg-brand" : "bg-zinc-200"}`}
              >
                <div className={`absolute top-0.5 size-5 bg-white rounded-full shadow transition-transform ${enabled[j.name] ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-zinc-950 text-zinc-300 rounded-xl p-6 font-mono text-xs">
        <div className="flex items-center justify-between mb-4">
          <span className="text-white font-semibold flex items-center gap-2">
            <Power className="size-3.5 text-brand" /> Console — Última Execução
          </span>
          <span className="text-zinc-500">automacao_v4.py</span>
        </div>
        <div className="space-y-1">
          <Log time="23:59:01" tag="INFO" text="Iniciando rotina de domingo..." />
          <Log time="23:59:05" tag="INFO" text="Conectando à API Meta Ads (70 contas)..." />
          <Log time="00:01:12" tag="INFO" text="Dados extraídos: R$ 142.900 total spend." />
          <Log time="00:02:45" tag="WARN" text="Farmácia 'Vida Plena' retornou dados parciais." color="amber" />
          <Log time="00:08:22" tag="PUSH" text="Enviando dataset para Power BI Service..." />
          <Log time="00:10:01" tag="DONE" text="Sincronização concluída em 633s." color="brand" />
        </div>
      </div>
    </AppShell>
  );
}

function Log({ time, tag, text, color = "brand" }: { time: string; tag: string; text: string; color?: "brand" | "amber" }) {
  const c = color === "amber" ? "text-amber-400" : "text-brand";
  return (
    <div className="flex gap-3">
      <span className="text-zinc-600">[{time}]</span>
      <span className={`${c} font-semibold w-12`}>{tag}:</span>
      <span className="text-zinc-300">{text}</span>
    </div>
  );
}
