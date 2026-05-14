import { createFileRoute } from "@tanstack/react-router";
import { Download, FileText, Calendar, CheckCircle2, AlertCircle, XCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { getRelatorios, downloadRelatorio, downloadRelatorioCSV, type Relatorio } from "@/lib/api";

export const Route = createFileRoute("/relatorios")({
  component: RelatoriosPage,
  head: () => ({ meta: [{ title: "Relatórios — PharmaFlow" }] }),
});

function statusStyle(s: Relatorio["status"]) {
  if (s === "Concluido") return "bg-emerald-50 text-emerald-700 ring-emerald-600/10";
  if (s === "Parcial") return "bg-amber-50 text-amber-700 ring-amber-600/10";
  return "bg-red-50 text-red-700 ring-red-600/10";
}

function statusLabel(s: Relatorio["status"]) {
  if (s === "Concluido") return "Concluído";
  if (s === "Parcial") return "Parcial";
  return "Erro";
}

function StatusIcon({ status }: { status: Relatorio["status"] }) {
  if (status === "Concluido") return <CheckCircle2 className="size-3.5 text-emerald-600" />;
  if (status === "Parcial") return <AlertCircle className="size-3.5 text-amber-500" />;
  return <XCircle className="size-3.5 text-red-500" />;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RelatoriosPage() {
  const { data: relatorios = [], isLoading } = useQuery({
    queryKey: ["relatorios"],
    queryFn: getRelatorios,
  });

  const concluidos = relatorios.filter((r) => r.status === "Concluido").length;
  const taxa = relatorios.length > 0 ? ((concluidos / relatorios.length) * 100).toFixed(1) : "—";

  return (
    <AppShell title="Relatórios Semanais">
      <div className="grid grid-cols-3 gap-6">
        <Kpi label="Total de Relatórios" value={String(relatorios.length)} sub="Execuções registradas" />
        <Kpi
          label="Relatórios Concluídos"
          value={String(concluidos)}
          sub={`${relatorios.length - concluidos} com erros ou parciais`}
        />
        <Kpi label="Taxa de Sucesso" value={relatorios.length > 0 ? `${taxa}%` : "—"} sub="Média histórica" />
      </div>

      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="size-4 text-zinc-400" /> Histórico de Execuções
          </h3>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-zinc-500">Carregando relatórios...</div>
        ) : relatorios.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">Nenhum relatório encontrado.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 border-b border-zinc-100">
                {["Período", "Gerado em", "Farmácias", "Status"].map((h) => (
                  <th key={h} className="px-6 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
                <th className="px-6 py-3 text-right text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Download
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {relatorios.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-50/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-zinc-400 shrink-0" />
                      <span className="text-sm font-medium text-zinc-900">{r.label}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-600">{fmtDate(r.data_geracao)}</td>
                  <td className="px-6 py-4 text-sm text-zinc-700">{r.farmacias}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ring-1 ${statusStyle(r.status)}`}>
                      <StatusIcon status={r.status} />
                      {statusLabel(r.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <DownloadButtons periodoInicio={r.periodo_inicio} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}

function DownloadButtons({ periodoInicio }: { periodoInicio: string }) {
  const [loadingXlsx, setLoadingXlsx] = useState(false);
  const [loadingCsv, setLoadingCsv]   = useState(false);

  async function handle(
    fn: (p: string) => Promise<void>,
    setLoading: (v: boolean) => void,
    label: string,
  ) {
    setLoading(true);
    try {
      await fn(periodoInicio);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : `Erro ao baixar ${label}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-3">
      <button
        onClick={() => handle(downloadRelatorio, setLoadingXlsx, "XLSX")}
        disabled={loadingXlsx || loadingCsv}
        className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand hover:underline disabled:opacity-50"
      >
        {loadingXlsx ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
        XLSX
      </button>
      <span className="text-zinc-200">|</span>
      <button
        onClick={() => handle(downloadRelatorioCSV, setLoadingCsv, "CSV")}
        disabled={loadingXlsx || loadingCsv}
        className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:underline disabled:opacity-50"
        title="Compatível com Power BI"
      >
        {loadingCsv ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
        Power BI (CSV)
      </button>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white p-6 rounded-xl ring-1 ring-black/5 shadow-sm">
      <span className="text-xs text-zinc-500 font-medium">{label}</span>
      <div className="text-2xl font-semibold tracking-tight mt-1">{value}</div>
      <div className="text-[10px] text-zinc-400 font-medium mt-1">{sub}</div>
    </div>
  );
}
