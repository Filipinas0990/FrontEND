import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, X, ArrowRight, Clock, RefreshCw, Loader2, Megaphone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { EnviarGrupoWizard } from "@/components/EnviarGrupoWizard";
import { getCarteiraOfertas, type ClienteCarteira } from "@/lib/api";

export const Route = createFileRoute("/ofertas-clientes")({
  component: OfertasClientesPage,
  head: () => ({ meta: [{ title: "Ofertas dos Clientes — GrupoSymbol" }] }),
});

function OfertasClientesPage() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");
  const [clienteDisparo, setClienteDisparo] = useState<number | null>(null);

  const { data: carteira = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["ofertas-carteira"],
    queryFn: getCarteiraOfertas,
    staleTime: 60_000,
  });

  const responderam = carteira.filter((c) => c.respondeu);

  const rows = useMemo(() => {
    const filtro = busca.trim().toLowerCase();
    return [...carteira]
      .filter((c) => c.farmacia.toLowerCase().includes(filtro))
      // Quem respondeu primeiro — é onde o gestor consegue agir
      .sort((a, b) => Number(b.respondeu) - Number(a.respondeu) || a.farmacia.localeCompare(b.farmacia, "pt-BR"));
  }, [carteira, busca]);

  function montar(c: ClienteCarteira) {
    if (c.respondeu) setClienteDisparo(c.farmacia_id);
  }

  return (
    <AppShell
      title="Ofertas dos Clientes"
      headerRight={
        <button
          onClick={() => navigate({ to: "/anuncios" })}
          className="flex items-center gap-2 py-2 px-3 text-sm font-medium bg-brand text-white rounded-md hover:opacity-90"
        >
          <Megaphone className="size-3.5" /> Ir para Criativos
        </button>
      }
    >
      <div className="space-y-4">
        {/* Placar */}
        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm text-zinc-700">
                <strong className="text-zinc-900 text-lg">{responderam.length}</strong>
                {" "}de <strong className="text-zinc-900">{carteira.length}</strong> clientes enviaram a lista de ofertas
              </p>
              <div className="mt-2 h-2 rounded-full bg-zinc-100 overflow-hidden max-w-md">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${carteira.length ? (responderam.length / carteira.length) * 100 : 0}%` }}
                />
              </div>
            </div>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition shrink-0"
            >
              <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
            </button>
          </div>
        </div>

        {/* Busca */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl ring-1 ring-black/5 shadow-sm max-w-xs">
          <Search className="size-4 text-zinc-400 shrink-0" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar cliente..."
            className="bg-transparent outline-none text-sm flex-1"
          />
          {busca && (
            <button onClick={() => setBusca("")} className="text-zinc-400 hover:text-zinc-700">
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-100 grid grid-cols-[1fr_auto_auto] items-center gap-6">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Farmácia</p>
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider text-center w-28">Produtos</p>
            <div className="w-24" />
          </div>

          <div className="divide-y divide-zinc-50">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-zinc-400 text-sm">
                <Loader2 className="size-4 animate-spin" /> Carregando clientes...
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 text-sm">
                {busca ? `Nenhuma farmácia encontrada para "${busca}".` : "Nenhuma farmácia na carteira."}
              </div>
            ) : (
              rows.map((c) => (
                <div
                  key={c.farmacia_id}
                  onClick={() => montar(c)}
                  className={`px-5 py-4 grid grid-cols-[1fr_auto_auto] items-center gap-6 transition-colors ${
                    c.respondeu ? "hover:bg-emerald-50/40 cursor-pointer" : ""
                  }`}
                >
                  {/* Nome + estado */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`size-8 rounded-full grid place-items-center text-[11px] font-bold shrink-0 ${
                      c.respondeu ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-400"
                    }`}>
                      {c.farmacia.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">{c.farmacia}</p>
                      {c.respondeu && c.solicitacao ? (
                        <p className="text-[11px] text-emerald-700 mt-0.5">
                          {c.solicitacao.enviado_por ? `Enviado por ${c.solicitacao.enviado_por}` : "Lista enviada"}
                          {c.solicitacao.produtos_livres ? " · com itens escritos" : ""}
                        </p>
                      ) : (
                        <p className="text-[11px] text-zinc-400 mt-0.5 italic flex items-center gap-1">
                          <Clock className="size-3" /> aguardando o cliente enviar
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Produtos enviados */}
                  <div className="text-center w-28">
                    {c.respondeu && c.solicitacao ? (
                      <p className="text-sm font-bold text-emerald-600">{c.solicitacao.produtos.length}</p>
                    ) : (
                      <p className="text-sm text-zinc-300">—</p>
                    )}
                  </div>

                  {/* Ação */}
                  <div className="w-24 flex justify-end">
                    {c.respondeu ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); montar(c); }}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-brand text-white rounded-lg hover:bg-brand/90 shrink-0"
                      >
                        Montar <ArrowRight className="size-3.5" />
                      </button>
                    ) : (
                      <span className="text-[11px] text-zinc-400">—</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Disparo do cliente escolhido */}
      {clienteDisparo !== null && (
        <EnviarGrupoWizard
          produtos={[]}
          clienteInicialId={clienteDisparo}
          onClose={() => { setClienteDisparo(null); refetch(); }}
        />
      )}
    </AppShell>
  );
}
