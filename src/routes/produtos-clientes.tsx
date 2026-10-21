import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft, PackagePlus, Search, Loader2, Store, ImageIcon, Download, X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  getProdutosEnviadosPelosClientes, produtoDoClienteImagemUrl,
  type ProdutoEnviadoPeloCliente,
} from "@/lib/api";

export const Route = createFileRoute("/produtos-clientes")({
  component: ProdutosClientesPage,
  head: () => ({ meta: [{ title: "Produtos enviados pelos clientes — GrupoSymbol" }] }),
});

/** Minúsculo e sem acento — "sao jose" acha "São José". */
function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

interface GrupoCliente {
  farmaciaId: number;
  nome: string;
  razaoSocial: string;
  cidade: string | null;
  ultimoEnvio: string | null;
  produtos: ProdutoEnviadoPeloCliente[];
}

/**
 * Os produtos (foto + nome) que os clientes mandaram pelo link de ofertas,
 * agrupados por cliente. O gestor vê só a carteira dele; o admin vê todos.
 * Cada cliente tem um espaço de até `limite` produtos — o contador mostra
 * quem está perto de encher.
 */
function ProdutosClientesPage() {
  const [busca, setBusca] = useState("");
  const [clienteSel, setClienteSel] = useState<number | "todos">("todos");

  const { data, isLoading, error } = useQuery({
    queryKey: ["produtos-enviados-clientes"],
    queryFn: getProdutosEnviadosPelosClientes,
  });
  const limite = data?.limite ?? 30;

  // A API já vem do mais recente para o mais antigo: o primeiro produto de
  // cada cliente é o último envio dele, e os grupos saem na mesma ordem.
  const grupos = useMemo<GrupoCliente[]>(() => {
    const porCliente = new Map<number, GrupoCliente>();
    for (const p of data?.itens ?? []) {
      let g = porCliente.get(p.farmacia_id);
      if (!g) {
        g = {
          farmaciaId: p.farmacia_id, nome: p.farmacia_visivel, razaoSocial: p.farmacia,
          cidade: p.cidade, ultimoEnvio: p.criado_em, produtos: [],
        };
        porCliente.set(p.farmacia_id, g);
      }
      g.produtos.push(p);
    }
    return [...porCliente.values()];
  }, [data]);

  const visiveis = useMemo(() => {
    const termo = semAcento(busca);
    return grupos
      .filter((g) => clienteSel === "todos" || g.farmaciaId === clienteSel)
      .map((g) => {
        if (!termo) return g;
        // Achou pelo cliente: mostra tudo dele. Senão, só os produtos que batem.
        const doCliente = [g.nome, g.razaoSocial, g.cidade ?? ""].some((t) => semAcento(t).includes(termo));
        return doCliente ? g : { ...g, produtos: g.produtos.filter((p) => semAcento(p.nome).includes(termo)) };
      })
      .filter((g) => g.produtos.length > 0);
  }, [grupos, busca, clienteSel]);

  const total = data?.itens.length ?? 0;

  return (
    <AppShell title="Produtos enviados pelos clientes">
      <div className="max-w-5xl mx-auto space-y-5">
        <Link
          to="/configuracoes"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 transition"
        >
          <ChevronLeft className="size-4" /> Configurações
        </Link>

        {/* Cabeçalho + resumo */}
        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-5">
          <div className="flex items-start gap-3">
            <PackagePlus className="size-5 text-brand shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-zinc-900">Produtos enviados pelos clientes</h2>
              <p className="text-sm text-zinc-500 mt-0.5">
                O que os donos das farmácias mandaram pelo link de ofertas, com foto e nome.
                Cada cliente pode guardar até {limite} produtos.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4 max-w-sm">
            <Resumo valor={total} rotulo={total === 1 ? "produto" : "produtos"} />
            <Resumo valor={grupos.length} rotulo={grupos.length === 1 ? "cliente enviou" : "clientes enviaram"} />
          </div>

          {total > 0 && (
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <div className="relative flex-1">
                <Search className="size-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar produto, cliente ou cidade..."
                  className="w-full pl-9 pr-9 py-2 rounded-lg border border-zinc-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                />
                {busca && (
                  <button
                    onClick={() => setBusca("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                    aria-label="Limpar busca"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <select
                value={clienteSel}
                onChange={(e) => setClienteSel(e.target.value === "todos" ? "todos" : Number(e.target.value))}
                className="sm:w-64 px-3 py-2 rounded-lg border border-zinc-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              >
                <option value="todos">Todos os clientes</option>
                {[...grupos].sort((a, b) => a.nome.localeCompare(b.nome)).map((g) => (
                  <option key={g.farmaciaId} value={g.farmaciaId}>
                    {g.nome} ({g.produtos.length})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
            <Loader2 className="size-4 animate-spin" /> Carregando...
          </div>
        ) : error ? (
          <p className="text-center text-sm text-red-600 py-10">
            {error instanceof Error ? error.message : "Não foi possível carregar."}
          </p>
        ) : total === 0 ? (
          <div className="bg-white rounded-xl ring-1 ring-black/5 p-10 text-center">
            <ImageIcon className="size-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-sm text-zinc-600">Nenhum cliente enviou produtos ainda.</p>
            <p className="text-xs text-zinc-400 mt-1">
              Eles enviam pela aba “Enviar meus produtos” do link de ofertas.
            </p>
          </div>
        ) : visiveis.length === 0 ? (
          <p className="text-center text-sm text-zinc-400 py-10">Nada encontrado para “{busca}”.</p>
        ) : (
          visiveis.map((g) => {
            const usados = grupos.find((x) => x.farmaciaId === g.farmaciaId)?.produtos.length ?? g.produtos.length;
            const cheio = usados >= limite;
            return (
              <section key={g.farmaciaId} className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Store className="size-4 text-brand shrink-0 mt-1" />
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-900 truncate">{g.nome}</p>
                      <p className="text-xs text-zinc-500">
                        {g.nome !== g.razaoSocial && <>{g.razaoSocial} · </>}
                        {g.cidade && <>{g.cidade} · </>}
                        Último envio em {fmtData(g.ultimoEnvio)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      cheio ? "bg-amber-100 text-amber-800" : "bg-zinc-100 text-zinc-600"
                    }`}
                    title="Espaço usado pelo cliente"
                  >
                    {usados}/{limite}{cheio && " · cheio"}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  {g.produtos.map((p) => {
                    const url = produtoDoClienteImagemUrl(g.farmaciaId, p.id);
                    return (
                      <div key={p.id} className="group rounded-lg border border-zinc-200 p-2">
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="block aspect-square rounded-md bg-zinc-50 grid place-items-center overflow-hidden mb-2"
                          title="Abrir a foto"
                        >
                          <img src={url} alt={p.nome} loading="lazy" className="max-h-full max-w-full object-contain" />
                        </a>
                        <p className="text-xs text-zinc-800 leading-snug line-clamp-2" title={p.nome}>{p.nome}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[11px] text-zinc-400">{fmtData(p.criado_em)}</span>
                          <a
                            href={url}
                            download={`${p.nome}.jpg`}
                            className="text-zinc-400 hover:text-brand"
                            title="Baixar a foto"
                            aria-label={`Baixar a foto de ${p.nome}`}
                          >
                            <Download className="size-3.5" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>
    </AppShell>
  );
}

function Resumo({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-2.5">
      <p className="text-xl font-bold text-zinc-900">{valor}</p>
      <p className="text-xs text-zinc-500">{rotulo}</p>
    </div>
  );
}
