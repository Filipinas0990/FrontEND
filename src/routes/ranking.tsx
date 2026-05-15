import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Trophy, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getRankingGestores } from "@/lib/api";

export const Route = createFileRoute("/ranking")({
  component: RankingPage,
  head: () => ({ meta: [{ title: "Ranking de Gestores — PharmaFlow" }] }),
});

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function MedalBadge({ posicao }: { posicao: number }) {
  if (posicao === 1) return <span className="text-amber-400 font-bold text-base">🥇</span>;
  if (posicao === 2) return <span className="text-zinc-400 font-bold text-base">🥈</span>;
  if (posicao === 3) return <span className="text-amber-600 font-bold text-base">🥉</span>;
  return <span className="text-xs font-semibold text-zinc-500 w-6 text-center">{posicao}</span>;
}

function TaxaBar({ value }: { value: number }) {
  const cor = value >= 80 ? "bg-emerald-500" : value >= 50 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 bg-zinc-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${cor}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-xs font-semibold text-zinc-700">{value.toFixed(1)}%</span>
    </div>
  );
}

function RankingPage() {
  const { data: ranking = [], isLoading } = useQuery({
    queryKey: ["ranking-gestores"],
    queryFn: getRankingGestores,
  });

  return (
    <AppShell title="Ranking de Gestores">
      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-zinc-100 flex items-center gap-2">
          <Trophy className="size-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-zinc-900">Gestores por desempenho de meta</h2>
        </div>

        {isLoading && (
          <div className="p-8 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-zinc-50 rounded animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && ranking.length === 0 && (
          <div className="py-16 text-center text-sm text-zinc-400">
            Nenhum dado de ranking disponível.
          </div>
        )}

        {!isLoading && ranking.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/60">
                  <th className="px-5 py-3 text-left text-[10px] font-semibold text-zinc-400 uppercase tracking-wider w-10">#</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Gestor</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Farmácias</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Meta OK</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Taxa Acerto</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">% Médio</th>
                  <th className="px-5 py-3 text-right text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Receita Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {ranking.map((g) => (
                  <tr key={g.gestor_id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <MedalBadge posicao={g.posicao} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-full bg-brand/10 text-brand grid place-items-center text-[10px] font-bold shrink-0">
                          {g.gestor_nome.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-zinc-900">{g.gestor_nome}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-zinc-600">{g.total_farmacias}</td>
                    <td className="px-5 py-4">
                      <span className="font-medium text-zinc-900">{g.farmacias_meta_ok}</span>
                      <span className="text-zinc-400">/{g.farmacias_com_meta}</span>
                    </td>
                    <td className="px-5 py-4">
                      <TaxaBar value={g.taxa_acerto} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="size-3 text-zinc-400" />
                        <span className="font-semibold text-zinc-700">{g.percentual_medio_meta.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-zinc-900">
                      {fmtBRL(g.receita_total)}
                      {g.meta_receita_total > 0 && (
                        <div className="text-[10px] text-zinc-400 font-normal">
                          meta: {fmtBRL(g.meta_receita_total)}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}