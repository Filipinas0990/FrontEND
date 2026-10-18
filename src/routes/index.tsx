import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { getGestores, getFarmacias, getCustoResultado, type CustoJanela } from "@/lib/api";
import { isAdmin } from "@/lib/auth";
import { usePeriod } from "@/contexts/PeriodContext";
import { PeriodSelector } from "@/components/PeriodSelector";
import { PeriodBadge } from "@/components/PeriodBadge";
import { useState } from "react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "GrupoSymbol — Painel de Performance" },
      { name: "description", content: "Painel de performance para farmácias." },
    ],
  }),
});

type Canal = "google" | "meta";

type SortKey =
  | "criticidade"
  | "google_cliques"
  | "google_conv"
  | "meta_custo"
  | "meta_resultados"
  | "meta_gasto";

const COR_GOOGLE = "#4285F4";
const COR_META = "#1877F2";

/**
 * Saldo da conta de anúncios do Meta. Ainda não é lido da API (projeto à parte):
 * por enquanto vale sempre R$ 0,00.
 */
const SALDO_META_PROVISORIO = 0;

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function alertColor(nivel: string) {
  if (nivel === "vermelho") return "bg-red-50 text-red-700 ring-red-600/10";
  if (nivel === "amarelo") return "bg-amber-50 text-amber-700 ring-amber-600/10";
  return "bg-emerald-50 text-emerald-700 ring-emerald-600/10";
}
function alertLabel(nivel: string) {
  if (nivel === "vermelho") return "Alerta";
  if (nivel === "amarelo") return "Atenção";
  return "Ativa";
}

/** Valor para ordenar o custo: quem gastou e não teve resultado é o pior caso. */
function valorCusto(j: CustoJanela | null | undefined): number {
  if (!j) return -1;
  if (j.custo_por_resultado != null) return j.custo_por_resultado;
  return j.gasto > 0 ? 1e12 : -1;
}

function Index() {
  const navigate = useNavigate();
  const admin = isAdmin();
  const [gestorId, setGestorId] = useState<number | undefined>();
  const { period, setPeriod } = usePeriod();
  const [canal, setCanal] = useState<Canal>("meta");
  const [sortKey, setSortKey] = useState<SortKey>("meta_custo");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const { data: gestores = [] } = useQuery({
    queryKey: ["gestores"],
    queryFn: getGestores,
    enabled: admin,
  });

  const {
    data: farmacias = [],
    isLoading: loadingFarmacias,
    isFetching: fetchingFarmacias,
  } = useQuery({
    queryKey: ["farmacias", undefined, undefined, gestorId, period],
    queryFn: () => getFarmacias(gestorId ? { gestor_id: gestorId, dias: period } : { dias: period }),
    select: (data) =>
      [...data].sort((a, b) => b.score_criticidade - a.score_criticidade),
  });

  const { data: custo } = useQuery({
    queryKey: ["custo-resultado", gestorId],
    queryFn: () => getCustoResultado(gestorId),
  });

  /** Custo por resultado da farmácia na janela do período selecionado. */
  function custoDe(farmaciaId: number): { janela: CustoJanela | null; erro: string | null } {
    const f = custo?.farmacias.find((x) => x.farmacia_id === farmaciaId);
    if (!f) return { janela: null, erro: null };
    const janela = period === 7 ? f.janela_7d : period === 15 ? f.janela_15d : f.janela_30d;
    return { janela, erro: f.erro };
  }

  function trocarCanal(novo: Canal) {
    setCanal(novo);
    setSortKey(novo === "meta" ? "meta_custo" : "criticidade");
    setSortDir("desc");
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  function findGoogle(canais?: typeof farmacias[0]["canais"]) {
    return canais?.find((c) => c.nome.toLowerCase().includes("google"))
      ?? canais?.find((c) => c.nome.toLowerCase().includes("site")
          && !c.nome.toLowerCase().includes("meta")
          && !c.nome.toLowerCase().includes("facebook"));
  }

  const sortedFarmacias = [...farmacias].sort((a, b) => {
    const gA = findGoogle(a.canais);
    const gB = findGoogle(b.canais);
    const cA = custoDe(a.id).janela;
    const cB = custoDe(b.id).janela;
    let vA = 0, vB = 0;
    if (sortKey === "criticidade")     { vA = a.score_criticidade; vB = b.score_criticidade; }
    if (sortKey === "google_cliques")  { vA = gA?.atendimentos ?? 0; vB = gB?.atendimentos ?? 0; }
    if (sortKey === "google_conv")     { vA = gA?.vendas != null && (gA.atendimentos ?? 0) > 0 ? gA.vendas / gA.atendimentos : 0; vB = gB?.vendas != null && (gB.atendimentos ?? 0) > 0 ? gB.vendas / gB.atendimentos : 0; }
    if (sortKey === "meta_custo")      { vA = valorCusto(cA); vB = valorCusto(cB); }
    if (sortKey === "meta_resultados") { vA = cA?.resultados ?? -1; vB = cB?.resultados ?? -1; }
    if (sortKey === "meta_gasto")      { vA = cA?.gasto ?? -1; vB = cB?.gasto ?? -1; }
    return sortDir === "desc" ? vB - vA : vA - vB;
  });

  function SortBtn({ k, children }: { k: SortKey; children: React.ReactNode }) {
    const ativo = sortKey === k;
    return (
      <button
        onClick={() => toggleSort(k)}
        className={`flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded transition-colors ${ativo ? "bg-brand/10 text-brand font-bold" : "text-zinc-400 hover:text-zinc-600"}`}
      >
        {children}{" "}
        {ativo ? (sortDir === "desc" ? <ArrowDown className="size-2.5" /> : <ArrowUp className="size-2.5" />) : <ArrowUpDown className="size-2.5" />}
      </button>
    );
  }

  const filtroCanal = (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Canal</span>
      <div className="flex items-center rounded-lg border-2 border-zinc-200 overflow-hidden">
        {([
          { id: "google", nome: "Google", cor: COR_GOOGLE },
          { id: "meta", nome: "Meta", cor: COR_META },
        ] as const).map((c) => (
          <button
            key={c.id}
            onClick={() => trocarCanal(c.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${canal === c.id ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-800 bg-transparent"}`}
          >
            <span className="size-2 rounded-full inline-block" style={{ background: c.cor }} />
            {c.nome}
          </button>
        ))}
      </div>
    </div>
  );

  const thBase = "px-6 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider";

  return (
    <AppShell title="Painel de Performance" larguraTotal>
      {/* Gestor filter (admin only) */}
      {admin && (
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Filtrar por Gestor
          </label>
          <select
            value={gestorId ?? ""}
            onChange={(e) => setGestorId(e.target.value ? Number(e.target.value) : undefined)}
            className="text-sm border border-zinc-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
          >
            <option value="">Todos</option>
            {gestores.filter((g) => !g.is_admin).map((g) => (
              <option key={g.id} value={g.id}>{g.nome}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Seletor global de período + filtro de canal ── */}
      <PeriodSelector
        value={period}
        onChange={setPeriod}
        loading={fetchingFarmacias && !loadingFarmacias}
        extra={filtroCanal}
      />

      {/* Top farmácias table */}
      <section className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="size-4 text-zinc-400" />
            {canal === "meta" ? "Farmácias em Destaque (custo por resultado)" : "Farmácias em Destaque (por criticidade)"}
            <PeriodBadge dias={period} />
          </h3>
          <button
            onClick={() => navigate({ to: "/farmacias" })}
            className="text-[10px] font-semibold text-brand hover:underline"
          >
            VER TODAS
          </button>
        </div>
        {loadingFarmacias ? (
          <div className="p-8 text-center text-sm text-zinc-500">Carregando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/50 border-b border-zinc-100">
                  <th className={thBase}>#</th>
                  <th className={thBase}>Farmácia</th>
                  <th className={thBase}>Status</th>
                  {canal === "google" ? (
                    <th className={thBase}>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full inline-block shrink-0" style={{ background: COR_GOOGLE }} />
                          Google
                        </span>
                        <SortBtn k="google_cliques">cliques</SortBtn>
                        <SortBtn k="google_conv">conv%</SortBtn>
                      </div>
                    </th>
                  ) : (
                    <>
                      <th className={thBase}>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1.5">
                            <span className="size-2 rounded-full inline-block shrink-0" style={{ background: COR_META }} />
                            Meta · Custo por resultado
                          </span>
                          <SortBtn k="meta_custo">custo</SortBtn>
                        </div>
                      </th>
                      <th className={thBase}>
                        <div className="flex items-center gap-2">
                          Conversas
                          <SortBtn k="meta_resultados">qtd</SortBtn>
                        </div>
                      </th>
                      <th className={thBase}>
                        <div className="flex items-center gap-2">
                          Gasto
                          <SortBtn k="meta_gasto">valor</SortBtn>
                        </div>
                      </th>
                      <th className={thBase}>Saldo</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {sortedFarmacias.map((p, idx) => {
                  const google = findGoogle(p.canais);
                  const gAtend = google?.atendimentos ?? 0;
                  const gConv  = google?.vendas != null && gAtend > 0
                    ? ((google.vendas / gAtend) * 100).toFixed(1)
                    : null;
                  const { janela, erro } = custoDe(p.id);

                  return (
                  <tr
                    key={p.id}
                    className="hover:bg-zinc-50/50 cursor-pointer"
                    onClick={() => navigate({ to: "/farmacias/$id", params: { id: String(p.id) } })}
                  >
                    <td className="px-6 py-3 text-xs text-zinc-400 font-mono">{idx + 1}</td>
                    <td className="px-6 py-3 text-sm font-medium text-zinc-900">{p.nome}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ring-1 ${alertColor(p.nivel_alerta)}`}>
                        {alertLabel(p.nivel_alerta)}
                      </span>
                    </td>
                    {canal === "google" ? (
                      <td className="px-6 py-3">
                        {gAtend > 0 ? (
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-semibold text-zinc-800">{gAtend.toLocaleString("pt-BR")}</span>
                            <span className="text-[11px] font-semibold" style={{ color: COR_GOOGLE }}>{gConv != null ? `${gConv}%` : "—"}</span>
                          </div>
                        ) : <span className="text-xs text-zinc-300">—</span>}
                      </td>
                    ) : (
                      <>
                        {/* Custo por resultado (campanhas de WhatsApp) */}
                        <td className="px-6 py-3">
                          {!janela ? (
                            <span className="text-xs text-zinc-300">—</span>
                          ) : janela.custo_por_resultado != null ? (
                            <span className="text-sm font-semibold text-zinc-800">{fmtBRL(janela.custo_por_resultado)}</span>
                          ) : janela.gasto > 0 ? (
                            <span className="text-[11px] font-semibold text-red-600">Gastou sem resultado</span>
                          ) : (
                            <span className="text-xs text-zinc-300">—</span>
                          )}
                          {erro && (
                            <span
                              title={`Falha na última leitura do Meta: ${erro}`}
                              className="ml-2 inline-flex items-center text-amber-500 align-middle"
                            >
                              <AlertTriangle className="size-3" />
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-sm text-zinc-800">
                          {janela ? janela.resultados.toLocaleString("pt-BR") : <span className="text-xs text-zinc-300">—</span>}
                        </td>
                        <td className="px-6 py-3 text-sm text-zinc-800">
                          {janela ? fmtBRL(janela.gasto) : <span className="text-xs text-zinc-300">—</span>}
                        </td>
                        <td className="px-6 py-3 text-sm text-zinc-500" title="Saldo da conta de anúncios: em breve">
                          {fmtBRL(SALDO_META_PROVISORIO)}
                        </td>
                      </>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>
            {farmacias.length === 0 && (
              <div className="p-8 text-center text-sm text-zinc-500">Nenhuma farmácia encontrada.</div>
            )}
          </div>
        )}
      </section>
    </AppShell>
  );
}
