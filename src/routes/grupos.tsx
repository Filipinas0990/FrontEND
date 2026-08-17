import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Send, Users, Inbox, Search, X, ArrowRight, ArrowLeft, Clock, RefreshCw, Loader2,
  CalendarClock, CheckCircle2, AlertCircle, Ban, Link2, Copy, Store, Check,
  ChevronRight, QrCode, Smartphone, History, MapPin, PencilLine,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { EnviarGrupoWizard } from "@/components/EnviarGrupoWizard";
import { CriativoCard, type CriativoDados, type LayoutCriativo } from "@/components/CriativoCard";
import { exportarCriativoPng, comprimirParaEnvio } from "@/lib/exportarCriativo";
import { formatarMoeda } from "@/lib/moeda";
import {
  getFarmacias, getDisparos, cancelarDisparo, getConexoesDisparo, getMeusGrupos,
  getCarteiraOfertas, conectarMeuWhatsapp, getMeuWhatsappStatus, getUltimaEscolha,
  listarCatalogoProdutos, catalogoImagemUrl, criarDisparo, getHorariosDisparo,
  type Farmacia, type DisparoResumo, type ClienteCarteira, type GrupoWhatsApp,
  type MidiaDisparo, type RepetirDisparo,
} from "@/lib/api";

type Aba = "disparo" | "clientes" | "historico";

export const Route = createFileRoute("/grupos")({
  component: GruposPage,
  // ?aba=clientes abre direto na carteira (usado pelos atalhos de Anúncios)
  validateSearch: (busca: Record<string, unknown>): { aba?: Aba } =>
    busca.aba === "clientes" ? { aba: "clientes" } : {},
  head: () => ({ meta: [{ title: "Grupos — GrupoSymbol" }] }),
});

/** Passos do disparo: farmácia → grupos → criativo → agendamento (modal). */
type Passo = 1 | 2 | 3 | 4;

/** Só o dia, em pt-BR ("14/08/2026"). O `fmtData` lá de baixo leva a hora. */
function fmtDia(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

/** Os 3 modelos de criativo do fluxo. */
type ModeloId = "padrao" | "abre" | "fecha";

function GruposPage() {
  const { aba: abaInicial } = Route.useSearch();
  const [aba, setAba] = useState<Aba>(abaInicial ?? "disparo");
  const queryClient = useQueryClient();

  // ── Estado do fluxo ─────────────────────────────────────────────────────────
  const [passo, setPasso] = useState<Passo>(1);
  const [farmacia, setFarmacia] = useState<Farmacia | null>(null);
  const [conexao, setConexao] = useState<string | null>(null);
  const [gruposSel, setGruposSel] = useState<Set<string>>(new Set());
  const [modelo, setModelo] = useState<ModeloId | null>(null);

  const { data: conexoes = [] } = useQuery({
    queryKey: ["disparo-conexoes"],
    queryFn: getConexoesDisparo,
    staleTime: 60_000,
  });

  // Escolhe a primeira conexão aberta assim que as conexões chegam. Mora aqui
  // no topo (e não dentro do passo 2) de propósito: com a conexão já definida
  // no passo 1, a busca dos grupos roda enquanto o gestor escolhe a farmácia —
  // quando ele chega no passo 2, a lista já está na tela.
  useEffect(() => {
    if (conexao || conexoes.length === 0) return;
    const aberta = conexoes.find((c) => c.status === "open");
    if (aberta) setConexao(aberta.instanceName);
  }, [conexoes, conexao]);

  const { data: listagem } = useGruposDaConexao(conexao);
  const grupos = useMemo(() => listagem?.grupos ?? [], [listagem]);

  // Marca sozinho os grupos com o nome da farmácia — uma vez por
  // (conexão, farmácia). Sem essa trava, voltar do passo 3 para o 2 desfaria
  // o que o gestor tivesse marcado ou desmarcado na mão.
  const preSelecionado = useRef<string | null>(null);
  useEffect(() => {
    if (!farmacia || grupos.length === 0) return;
    const chave = `${conexao}|${farmacia.id}`;
    if (preSelecionado.current === chave) return;
    preSelecionado.current = chave;
    setGruposSel(new Set(
      grupos.filter((g) => combina(g.nome, farmacia.nome)).map((g) => g.jid),
    ));
  }, [grupos, farmacia, conexao]);

  // Disparo por cliente (aba de ofertas) — continua no wizard antigo
  const [clienteDisparo, setClienteDisparo] = useState<number | null>(null);

  const { data: carteira = [] } = useQuery({
    queryKey: ["ofertas-carteira"],
    queryFn: getCarteiraOfertas,
    staleTime: 60_000,
  });
  const pendentes = carteira.filter((c) => c.respondeu).length;

  function escolherFarmacia(f: Farmacia) {
    setFarmacia(f);
    setGruposSel(new Set());
    preSelecionado.current = null;   // deixa a pré-seleção rodar para esta farmácia
    setPasso(2);
  }

  function recomecar() {
    setPasso(1);
    setFarmacia(null);
    setGruposSel(new Set());
    preSelecionado.current = null;
    setModelo(null);
  }

  return (
    <AppShell
      title="Grupos"
      headerRight={
        passo > 1 && aba === "disparo" ? (
          <button
            onClick={recomecar}
            className="flex items-center gap-2 py-2 px-3 text-sm font-medium text-zinc-600 border border-zinc-200 rounded-md hover:bg-zinc-50"
          >
            <X className="size-3.5" /> Recomeçar
          </button>
        ) : null
      }
    >
      <div className="space-y-5">
        {/* As abas só aparecem fora do fluxo — durante o disparo, quem guia é o stepper */}
        {(aba !== "disparo" || passo === 1) && (
          <div className="flex gap-1 border-b border-zinc-200">
            <AbaBtn ativa={aba === "disparo"} onClick={() => setAba("disparo")} icone={Send}>
              Novo disparo
            </AbaBtn>
            <AbaBtn ativa={aba === "clientes"} onClick={() => setAba("clientes")} icone={Inbox} badge={pendentes}>
              Ofertas dos clientes
            </AbaBtn>
            <AbaBtn ativa={aba === "historico"} onClick={() => setAba("historico")} icone={History}>
              Histórico
            </AbaBtn>
          </div>
        )}

        {aba === "disparo" && (
          <>
            <Stepper passo={passo} farmacia={farmacia} onIr={(p) => setPasso(p)} />

            {passo === 1 && <PassoFarmacia onEscolher={escolherFarmacia} />}

            {passo === 2 && farmacia && (
              <PassoGrupos
                farmacia={farmacia}
                conexao={conexao}
                setConexao={setConexao}
                selecionados={gruposSel}
                setSelecionados={setGruposSel}
                onVoltar={() => setPasso(1)}
                onContinuar={() => setPasso(3)}
              />
            )}

            {/* O passo 4 é o modal de agendamento — o 3 segue montado por baixo
                para não perder as imagens, preços e o modelo escolhidos. */}
            {(passo === 3 || passo === 4) && farmacia && (
              <PassoCriativo
                farmacia={farmacia}
                grupos={grupos.filter((g) => gruposSel.has(g.jid))}
                conexao={conexao}
                modelo={modelo}
                setModelo={setModelo}
                onVoltar={() => setPasso(2)}
                agendando={passo === 4}
                onAgendar={() => setPasso(4)}
                onFecharAgendamento={() => setPasso(3)}
                onAgendado={() => {
                  recomecar();
                  setAba("historico");
                  queryClient.invalidateQueries({ queryKey: ["disparos"] });
                }}
              />
            )}
          </>
        )}

        {aba === "clientes" && (
          <AbaClientes carteira={carteira} onMontar={(c) => setClienteDisparo(c.farmacia_id)} />
        )}

        {aba === "historico" && <AbaHistorico onNovo={() => { setAba("disparo"); recomecar(); }} />}
      </div>

      {clienteDisparo !== null && (
        <EnviarGrupoWizard
          produtos={[]}
          clienteInicialId={clienteDisparo}
          onClose={() => {
            setClienteDisparo(null);
            queryClient.invalidateQueries({ queryKey: ["ofertas-carteira"] });
            queryClient.invalidateQueries({ queryKey: ["ofertas-pendentes"] });
            queryClient.invalidateQueries({ queryKey: ["disparos"] });
          }}
        />
      )}
    </AppShell>
  );
}

// ── Abas e stepper ────────────────────────────────────────────────────────────

function AbaBtn({
  ativa, onClick, icone: Icone, badge, children,
}: {
  ativa: boolean;
  onClick: () => void;
  icone: typeof Send;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
        ativa ? "border-brand text-brand" : "border-transparent text-zinc-500 hover:text-zinc-800"
      }`}
    >
      <Icone className="size-4" />
      {children}
      {badge != null && badge > 0 && (
        <span className="min-w-5 h-5 px-1.5 rounded-full bg-amber-400 text-brand text-[11px] font-bold grid place-items-center">
          {badge}
        </span>
      )}
    </button>
  );
}

const PASSOS: { n: Passo; rotulo: string }[] = [
  { n: 1, rotulo: "Farmácia" },
  { n: 2, rotulo: "Grupos" },
  { n: 3, rotulo: "Criativo" },
  { n: 4, rotulo: "Agendamento" },
];

function Stepper({
  passo, farmacia, onIr,
}: {
  passo: Passo;
  farmacia: Farmacia | null;
  onIr: (p: Passo) => void;
}) {
  return (
    <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm px-5 py-3.5 flex items-center gap-2 flex-wrap">
      {PASSOS.map((p, i) => {
        const feito = p.n < passo;
        const atual = p.n === passo;
        return (
          <div key={p.n} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="size-4 text-zinc-300" />}
            <button
              onClick={() => { if (feito) onIr(p.n); }}
              disabled={!feito}
              className={`flex items-center gap-2 rounded-lg px-2 py-1 transition ${
                feito ? "hover:bg-zinc-50 cursor-pointer" : "cursor-default"
              }`}
            >
              <span className={`size-6 rounded-full grid place-items-center text-[11px] font-bold ${
                atual ? "bg-brand text-white"
                : feito ? "bg-emerald-100 text-emerald-700"
                : "bg-zinc-100 text-zinc-400"
              }`}>
                {feito ? <Check className="size-3.5" /> : p.n}
              </span>
              <span className={`text-sm font-medium ${
                atual ? "text-zinc-900" : feito ? "text-zinc-600" : "text-zinc-400"
              }`}>
                {p.rotulo}
              </span>
            </button>
          </div>
        );
      })}

      {farmacia && (
        <span className="ml-auto flex items-center gap-1.5 text-xs text-zinc-500 min-w-0">
          <Store className="size-3.5 shrink-0 text-brand" />
          <span className="truncate font-medium text-zinc-700">{farmacia.nome}</span>
        </span>
      )}
    </div>
  );
}

// ── Passo 1: farmácias ────────────────────────────────────────────────────────

function PassoFarmacia({ onEscolher }: { onEscolher: (f: Farmacia) => void }) {
  const [busca, setBusca] = useState("");

  const { data: farmacias = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["farmacias-grupos"],
    queryFn: () => getFarmacias(),
    staleTime: 5 * 60_000,
  });

  const rows = useMemo(() => {
    const filtro = busca.trim().toLowerCase();
    return farmacias
      .filter((f) =>
        f.nome.toLowerCase().includes(filtro)
        || (f.cidade ?? "").toLowerCase().includes(filtro))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [farmacias, busca]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl ring-1 ring-black/5 shadow-sm flex-1 max-w-sm">
          <Search className="size-4 text-zinc-400 shrink-0" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar farmácia..."
            className="bg-transparent outline-none text-sm flex-1"
          />
          {busca && (
            <button onClick={() => setBusca("")} className="text-zinc-400 hover:text-zinc-700">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-zinc-600 border border-zinc-200 bg-white rounded-xl hover:bg-zinc-50 transition"
        >
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-100">
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Escolha a farmácia {rows.length > 0 && `(${rows.length})`}
          </p>
        </div>

        <div className="divide-y divide-zinc-50">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-zinc-400 text-sm">
              <Loader2 className="size-4 animate-spin" /> Carregando farmácias...
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-zinc-400 text-sm">
              {busca ? `Nenhuma farmácia encontrada para "${busca}".` : "Nenhuma farmácia cadastrada."}
            </div>
          ) : (
            rows.map((f) => (
              <button
                key={f.id}
                onClick={() => onEscolher(f)}
                className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-brand/5 transition-colors group"
              >
                <div className="size-9 rounded-full bg-zinc-100 text-zinc-500 grid place-items-center text-[11px] font-bold shrink-0 group-hover:bg-brand group-hover:text-white transition-colors">
                  {f.nome.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-900 truncate">{f.nome}</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1">
                    {f.cidade ? <><MapPin className="size-3" /> {f.cidade}</> : "sem cidade cadastrada"}
                    {f.fase === "entrada" && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                        em entrada
                      </span>
                    )}
                  </p>
                </div>
                <ArrowRight className="size-4 text-zinc-300 group-hover:text-brand shrink-0 transition-colors" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Passo 2: grupos do WhatsApp ───────────────────────────────────────────────

/** Palavras que não ajudam a casar grupo com farmácia. */
const PALAVRAS_GENERICAS = new Set([
  "farmacia", "farmacias", "drogaria", "drogarias", "grupo", "grupos",
  "oferta", "ofertas", "promocao", "promocoes", "whatsapp", "zap", "clientes",
  "ltda", "epp", "comercio", "medicamentos", "manipulacao", "filial", "matriz",
]);

/** Tokens úteis de um nome: sem acento, sem pontuação, sem palavra genérica. */
function tokens(texto: string): string[] {
  return texto
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    .split(" ")
    .filter((t) => t.length >= 3 && !PALAVRAS_GENERICAS.has(t));
}

/** true = o nome do grupo tem a ver com o da farmácia. */
function combina(nomeGrupo: string, nomeFarmacia: string): boolean {
  const daFarmacia = tokens(nomeFarmacia);
  if (daFarmacia.length === 0) return false;
  const doGrupo = new Set(tokens(nomeGrupo));
  return daFarmacia.some((t) => doGrupo.has(t));
}

/** Chave da query de grupos — o passo 1 e o passo 2 dividem o mesmo cache. */
function chaveGrupos(conexao: string | null) {
  return ["grupos-whatsapp", conexao] as const;
}

/**
 * Grupos da conexão. O servidor já responde do cache dele e se revalida
 * sozinho, então aqui o staleTime só evita refazer o request a cada ida e
 * volta entre os passos do disparo.
 */
function useGruposDaConexao(conexao: string | null) {
  return useQuery({
    queryKey: chaveGrupos(conexao),
    queryFn: () => getMeusGrupos(conexao ?? undefined),
    enabled: !!conexao,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/** "agora há pouco", "há 12 min", "há 3 h" — idade do cache, em português. */
function desde(iso: string | null): string | null {
  if (!iso) return null;
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1)  return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

function PassoGrupos({
  farmacia, conexao, setConexao, selecionados, setSelecionados,
  onVoltar, onContinuar,
}: {
  farmacia: Farmacia;
  conexao: string | null;
  setConexao: (c: string | null) => void;
  selecionados: Set<string>;
  setSelecionados: (s: Set<string>) => void;
  onVoltar: () => void;
  onContinuar: () => void;
}) {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [soDaFarmacia, setSoDaFarmacia] = useState(true);
  const [atualizando, setAtualizando] = useState(false);

  const { data: conexoes = [], isLoading: carregandoConexoes, refetch: recarregarConexoes } = useQuery({
    queryKey: ["disparo-conexoes"],
    queryFn: getConexoesDisparo,
    staleTime: 60_000,
  });

  const temConexao = conexoes.some((c) => c.status === "open");

  // Mesma query do topo da página (o passo 1 já a disparou) — o react-query
  // devolve o cache aqui em vez de bater na API de novo.
  const { data: listagem, isPending, error } = useGruposDaConexao(conexao);
  const grupos = useMemo(() => listagem?.grupos ?? [], [listagem]);
  const carregando = !!conexao && isPending;
  const erro = error instanceof Error ? error.message : null;

  const combinam = useMemo(
    () => grupos.filter((g) => combina(g.nome, farmacia.nome)),
    [grupos, farmacia.nome],
  );

  // Nenhum grupo casou com o nome da farmácia: abre já na lista completa,
  // senão o gestor encara uma tela vazia sem saber que existe o toggle.
  useEffect(() => {
    if (grupos.length > 0 && combinam.length === 0) setSoDaFarmacia(false);
  }, [grupos, combinam]);

  // O servidor devolveu cache velho e foi atualizar por trás: daqui a pouco
  // buscamos de novo para a tela pegar a lista nova sem o gestor fazer nada.
  useEffect(() => {
    if (!listagem?.sincronizando || !conexao) return;
    const t = setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: chaveGrupos(conexao) });
    }, 15_000);
    return () => clearTimeout(t);
  }, [listagem?.sincronizando, conexao, queryClient]);

  /** Botão "Atualizar": ignora o cache do servidor e espera a Evolution. */
  async function atualizarGrupos() {
    if (!conexao || atualizando) return;
    setAtualizando(true);
    try {
      const nova = await getMeusGrupos(conexao, true);
      queryClient.setQueryData(chaveGrupos(conexao), nova);
      toast.success(`${nova.grupos.length} grupo(s) sincronizado(s).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar os grupos.");
    } finally {
      setAtualizando(false);
    }
  }

  const visiveis = useMemo(() => {
    const base = soDaFarmacia ? combinam : grupos;
    const filtro = busca.trim().toLowerCase();
    return filtro ? base.filter((g) => g.nome.toLowerCase().includes(filtro)) : base;
  }, [soDaFarmacia, combinam, grupos, busca]);

  function alternar(jid: string) {
    const novo = new Set(selecionados);
    if (novo.has(jid)) novo.delete(jid); else novo.add(jid);
    setSelecionados(novo);
  }

  return (
    <div className="space-y-4">
      {/* Conexão usada para listar os grupos */}
      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-4 flex items-center gap-3 flex-wrap">
        <Smartphone className="size-4 text-zinc-400 shrink-0" />
        <p className="text-sm text-zinc-600 shrink-0">Grupos do WhatsApp de:</p>
        {carregandoConexoes ? (
          <span className="text-sm text-zinc-400 flex items-center gap-1.5">
            <Loader2 className="size-3.5 animate-spin" /> carregando conexões...
          </span>
        ) : conexoes.length > 0 ? (
          <select
            value={conexao ?? ""}
            onChange={(e) => setConexao(e.target.value || null)}
            className="px-3 py-1.5 rounded-lg border border-zinc-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            <option value="">Selecione uma conexão</option>
            {conexoes.map((c) => (
              <option key={c.instanceName} value={c.instanceName} disabled={c.status !== "open"}>
                {c.nome} {c.tipo === "gestor" ? "(sua)" : "(agência)"}
                {c.status === "open" ? "" : " — desconectado"}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-zinc-500">nenhuma conexão disponível</span>
        )}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {listagem?.atualizadoEm && (
            <span className="text-[11px] text-zinc-400">
              {listagem.sincronizando || atualizando
                ? "sincronizando..."
                : `lista de ${desde(listagem.atualizadoEm)}`}
            </span>
          )}
          <button
            onClick={atualizarGrupos}
            disabled={!conexao || carregando || atualizando}
            title="Buscar a lista atualizada no WhatsApp (pode demorar)"
            className="size-8 rounded-lg border border-zinc-200 grid place-items-center text-zinc-500 hover:bg-zinc-50 disabled:opacity-40 transition"
          >
            <RefreshCw className={`size-4 ${carregando || atualizando ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Cache antigo sendo exibido porque o último sync falhou */}
      {listagem?.aviso && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2.5 items-start">
          <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            Mostrando a última lista salva — a sincronização com o WhatsApp falhou: {listagem.aviso}
          </p>
        </div>
      )}

      {/* Sem WhatsApp conectado não há grupos para listar */}
      {!carregandoConexoes && !temConexao ? (
        <ConectarWhatsapp onConectado={() => recarregarConexoes()} />
      ) : (
        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-900 truncate">
                Grupos de {farmacia.nome}
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                {soDaFarmacia
                  ? `Mostrando ${combinam.length} grupo(s) com o nome da farmácia.`
                  : `Mostrando todos os ${grupos.length} grupo(s) da conexão.`}
              </p>
            </div>
            <button
              onClick={() => setSoDaFarmacia((v) => !v)}
              className="text-sm font-medium text-brand hover:underline shrink-0"
            >
              {soDaFarmacia ? "Ver todos os grupos" : "Só os desta farmácia"}
            </button>
          </div>

          <div className="px-5 py-3 border-b border-zinc-100">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-200 max-w-sm">
              <Search className="size-4 text-zinc-400 shrink-0" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar grupo..."
                className="bg-transparent outline-none text-sm flex-1"
              />
              {busca && (
                <button onClick={() => setBusca("")} className="text-zinc-400 hover:text-zinc-700">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-zinc-50 max-h-[26rem] overflow-y-auto">
            {carregando ? (
              <div className="flex items-center justify-center gap-2 py-12 text-zinc-400 text-sm">
                <Loader2 className="size-4 animate-spin" /> Buscando os grupos...
              </div>
            ) : erro ? (
              <div className="m-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">{erro}</p>
              </div>
            ) : visiveis.length === 0 ? (
              <div className="py-12 px-5 text-center text-sm text-zinc-400">
                {soDaFarmacia
                  ? <>Nenhum grupo com o nome “{farmacia.nome}”. Use <strong className="text-zinc-600">Ver todos os grupos</strong> para escolher na mão.</>
                  : busca ? `Nenhum grupo encontrado para "${busca}".` : "Nenhum grupo nesta conexão."}
              </div>
            ) : (
              visiveis.map((g) => {
                const marcado = selecionados.has(g.jid);
                const daFarmacia = combina(g.nome, farmacia.nome);
                return (
                  <button
                    key={g.jid}
                    onClick={() => alternar(g.jid)}
                    className="w-full px-5 py-3.5 flex items-center gap-3 text-left hover:bg-zinc-50/70 transition-colors"
                  >
                    <div className={`size-5 rounded border grid place-items-center shrink-0 ${
                      marcado ? "bg-brand border-brand text-white" : "border-zinc-300"
                    }`}>
                      {marcado && <Check className="size-3.5" />}
                    </div>
                    <Users className="size-4 text-zinc-400 shrink-0" />
                    <span className="flex-1 min-w-0 truncate text-sm text-zinc-800">{g.nome}</span>
                    {daFarmacia && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 shrink-0">
                        desta farmácia
                      </span>
                    )}
                    {g.participantes !== null && (
                      <span className="text-xs text-zinc-400 shrink-0">{g.participantes} membros</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      <Rodape
        onVoltar={onVoltar}
        info={selecionados.size > 0 ? `${selecionados.size} grupo(s) selecionado(s)` : undefined}
        acao={
          <button
            onClick={() => {
              if (selecionados.size === 0) { toast.error("Selecione ao menos um grupo."); return; }
              onContinuar();
            }}
            disabled={selecionados.size === 0}
            className="bg-brand hover:bg-brand/90 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg flex items-center gap-2 transition shadow-sm"
          >
            Continuar <ArrowRight className="size-4" />
          </button>
        }
      />
    </div>
  );
}

/** Conectar o WhatsApp do gestor sem sair do fluxo (QR + polling). */
function ConectarWhatsapp({ onConectado }: { onConectado: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [conectando, setConectando] = useState(false);

  useEffect(() => {
    if (!qr) return;
    const timer = setInterval(async () => {
      try {
        const s = await getMeuWhatsappStatus();
        if (s.status === "open") {
          setQr(null);
          toast.success("WhatsApp conectado!");
          onConectado();
        } else if (s.qr_code) {
          setQr(s.qr_code);
        }
      } catch { /* segue tentando */ }
    }, 4000);
    return () => clearInterval(timer);
  }, [qr, onConectado]);

  return (
    <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-8 flex flex-col items-center gap-3 text-center">
      <Smartphone className="size-10 text-zinc-200" />
      <div>
        <p className="text-sm font-semibold text-zinc-800">Nenhum WhatsApp conectado</p>
        <p className="text-sm text-zinc-500 mt-0.5 max-w-sm">
          Conecte o seu WhatsApp para o sistema listar os grupos das farmácias.
        </p>
      </div>
      {qr ? (
        <>
          <img
            src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`}
            alt="QR Code do WhatsApp"
            className="size-56 rounded-lg border border-zinc-200"
          />
          <p className="text-xs text-zinc-500">
            No celular: WhatsApp → Aparelhos conectados → Conectar aparelho.
          </p>
          <span className="flex items-center gap-2 text-xs text-zinc-400">
            <Loader2 className="size-3 animate-spin" /> Aguardando leitura...
          </span>
        </>
      ) : (
        <button
          onClick={async () => {
            setConectando(true);
            try {
              const r = await conectarMeuWhatsapp();
              setQr(r.qr_code);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Não foi possível conectar.");
            } finally { setConectando(false); }
          }}
          disabled={conectando}
          className="bg-brand hover:bg-brand/90 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition"
        >
          {conectando
            ? <><Loader2 className="size-4 animate-spin" /> Gerando QR...</>
            : <><QrCode className="size-4" /> Conectar meu WhatsApp</>}
        </button>
      )}
    </div>
  );
}

// ── Passo 3: criativo (banco de imagens + modelo + preço) ─────────────────────

/** Os 3 modelos do criativo. "Abre/Fecha Mês" são o banner com a faixa trocada. */
const MODELOS: {
  id: ModeloId;
  nome: string;
  desc: string;
  layout: LayoutCriativo;
  titulo?: string;
  subtituloPadrao?: string;
}[] = [
  {
    id: "padrao", nome: "Padrão", layout: "azul",
    desc: "Preço no topo e a farmácia na barra de baixo.",
  },
  {
    id: "abre", nome: "Abre Mês", layout: "banner", titulo: "ABRE MÊS", subtituloPadrao: "DIAS 01 A 10",
    desc: "Faixa “ABRE MÊS”, datas e preço em destaque.",
  },
  {
    id: "fecha", nome: "Fecha Mês", layout: "banner", titulo: "FECHA MÊS", subtituloPadrao: "DIAS 25 A 31",
    desc: "Faixa “FECHA MÊS”, datas e preço em destaque.",
  },
];

function PassoCriativo({
  farmacia, grupos, conexao, modelo, setModelo, onVoltar,
  agendando, onAgendar, onFecharAgendamento, onAgendado,
}: {
  farmacia: Farmacia;
  grupos: GrupoWhatsApp[];
  conexao: string | null;
  modelo: ModeloId | null;
  setModelo: (m: ModeloId) => void;
  onVoltar: () => void;
  /** true = está no passo 4 (modal de agendamento aberto) */
  agendando: boolean;
  onAgendar: () => void;
  onFecharAgendamento: () => void;
  onAgendado: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [escolhidos, setEscolhidos] = useState<Set<number>>(new Set());
  const [precos, setPrecos] = useState<Record<number, string>>({});
  // Produtos com oferta "de/por" e o preço antigo (riscado) de cada um
  const [dePor, setDePor] = useState<Set<number>>(new Set());
  const [precosDe, setPrecosDe] = useState<Record<number, string>>({});
  const [subtitulo, setSubtitulo] = useState("");

  // Ver o banco inteiro em vez de só o que o cliente pediu
  const [verTodos, setVerTodos] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["catalogo-produtos"],
    queryFn: listarCatalogoProdutos,
    staleTime: 5 * 60_000,
  });

  // O que este cliente escolheu no link dele — é a base do criativo
  const { data: ultima, isLoading: carregandoEscolha } = useQuery({
    queryKey: ["ultima-escolha", farmacia.id],
    queryFn: () => getUltimaEscolha(farmacia.id),
    staleTime: 60_000,
  });

  // Só o que está ligado no Banco de Imagens entra no criativo
  const ativos = useMemo(
    () => (data?.produtos ?? []).filter((p) => p.ativo),
    [data],
  );

  const pedidos = useMemo(
    () => new Set((ultima?.produtos ?? []).map((p) => p.id)),
    [ultima],
  );

  const doCliente = useMemo(
    () => ativos.filter((p) => pedidos.has(p.id)),
    [ativos, pedidos],
  );

  // Sem escolha do cliente não há o que filtrar: cai no banco inteiro.
  const soDoCliente = pedidos.size > 0 && !verTodos;
  const imagens = soDoCliente ? doCliente : ativos;

  // Produtos que o dono pediu mas saíram do banco de imagens (ou foram
  // desativados) — some da grade sem avisar se a gente não contar.
  const sumiram = pedidos.size - doCliente.length;

  /** Preços que o próprio cliente informou no link dele, por produto. */
  const precosDoCliente = useMemo(() => {
    const mapa: Record<number, string> = {};
    for (const p of ultima?.produtos ?? []) {
      if (p.preco) mapa[p.id] = p.preco;
    }
    return mapa;
  }, [ultima]);

  // Já vêm marcados os produtos do pedido, com o preço que o cliente mandou.
  // Uma vez por pedido, para não desfazer o que o gestor mexeu.
  const preMarcado = useRef<string | null>(null);
  useEffect(() => {
    if (!ultima || doCliente.length === 0) return;
    const chave = `${farmacia.id}|${ultima.id}`;
    if (preMarcado.current === chave) return;
    preMarcado.current = chave;
    setEscolhidos(new Set(doCliente.map((p) => p.id)));
    // Só os do pedido: preço digitado à mão para outro produto fica de pé.
    setPrecos((atual) => ({ ...atual, ...precosDoCliente }));
  }, [ultima, doCliente, farmacia.id, precosDoCliente]);

  const visiveis = useMemo(() => {
    const filtro = busca.trim().toLowerCase();
    return filtro ? imagens.filter((p) => p.nome.toLowerCase().includes(filtro)) : imagens;
  }, [imagens, busca]);

  const modeloAtual = MODELOS.find((m) => m.id === modelo);

  // Ao trocar de modelo, sugere as datas daquele modelo (o gestor pode editar)
  useEffect(() => {
    if (modeloAtual?.subtituloPadrao && !subtitulo) setSubtitulo(modeloAtual.subtituloPadrao);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelo]);

  // Sai de `ativos`, não de `imagens`: alternar "ver todo o banco" não pode
  // derrubar do criativo um produto que o gestor já tinha marcado.
  const selecionados = useMemo(
    () => ativos.filter((p) => escolhidos.has(p.id)),
    [ativos, escolhidos],
  );

  function alternar(id: number) {
    setEscolhidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }

  function alternarDePor(id: number) {
    setDePor((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }

  /** Dados de render de um produto no modelo escolhido. */
  function dadosCriativo(produto: { id: number; nome: string }) {
    return {
      layout:        modeloAtual?.layout ?? "azul",
      enquadramento: "4:5" as const,
      nome:          produto.nome,
      preco:         precos[produto.id] ?? "",
      precoDe:       dePor.has(produto.id) ? precosDe[produto.id] : undefined,
      imagem:        catalogoImagemUrl(produto.id),
      localizacao:   farmacia.nome,
      titulo:        modeloAtual?.titulo,
      subtitulo,
    };
  }

  function abrirAgendamento() {
    if (!modelo)                 { toast.error("Escolha o modelo do criativo.");   return; }
    if (selecionados.length === 0) { toast.error("Escolha ao menos uma imagem."); return; }
    const semPreco = selecionados.filter((p) => !(precos[p.id] ?? "").trim());
    if (semPreco.length > 0)     { toast.error(`Falta o preço de ${semPreco.length} produto(s).`); return; }
    const semPrecoDe = selecionados.filter((p) => dePor.has(p.id) && !(precosDe[p.id] ?? "").trim());
    if (semPrecoDe.length > 0)   { toast.error(`Falta o preço "de" de ${semPrecoDe.length} produto(s).`); return; }
    onAgendar();
  }

  return (
    <div className="space-y-4">
      {/* Modelo */}
      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-5">
        <p className="text-sm font-semibold text-zinc-900">Modelo do criativo</p>
        <p className="text-[11px] text-zinc-500 mt-0.5">
          Vai para {grupos.length} grupo(s) de {farmacia.nome}.
        </p>

        <div className="grid sm:grid-cols-3 gap-5 mt-5">
          {MODELOS.map((m) => {
            const escolhido = modelo === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setModelo(m.id)}
                className={`rounded-2xl p-4 border-2 text-center transition ${
                  escolhido ? "border-brand ring-2 ring-brand/20 bg-brand/5" : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <div className="max-w-[190px] mx-auto pointer-events-none" style={{ containerType: "inline-size" }}>
                  <CriativoCard
                    layout={m.layout}
                    enquadramento="4:5"
                    nome="Produto exemplo"
                    preco="9,90"
                    imagem={null}
                    localizacao={farmacia.nome}
                    titulo={m.titulo}
                    subtitulo={m.subtituloPadrao}
                  />
                </div>
                <div className="flex items-center justify-center gap-1.5 mt-4">
                  {escolhido && <Check className="size-4 text-brand" />}
                  <span className={`text-sm font-semibold ${escolhido ? "text-brand" : "text-zinc-700"}`}>
                    {m.nome}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-1">{m.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Datas da faixa — só os modelos Abre/Fecha Mês têm */}
        {modeloAtual?.titulo && (
          <div className="mt-5 flex items-center gap-3 flex-wrap">
            <label className="text-sm font-medium text-zinc-700">Datas na arte</label>
            <input
              value={subtitulo}
              onChange={(e) => setSubtitulo(e.target.value)}
              placeholder={modeloAtual.subtituloPadrao}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            <span className="text-xs text-zinc-400">aparece na pílula branca embaixo da faixa</span>
          </div>
        )}
      </div>

      {/* Banco de imagens */}
      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-zinc-900">
              {soDoCliente ? `Produtos que ${farmacia.nome} pediu` : "Imagens do banco"}
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {ultima && soDoCliente
                ? <>
                    Produtos escolhidos no dia <strong className="text-zinc-700">{fmtDia(ultima.criado_em)}</strong>
                    {ultima.enviado_por ? ` por ${ultima.enviado_por}` : ""}
                    {Object.keys(precosDoCliente).length > 0
                      ? " — os preços vieram no pedido, confira antes de disparar."
                      : " — o cliente não informou preço, preencha aqui."}
                  </>
                : "Escolha os produtos e informe o preço de cada um."}
            </p>
          </div>
          {pedidos.size > 0 && (
            <button
              onClick={() => setVerTodos((v) => !v)}
              className="text-sm font-medium text-brand hover:underline shrink-0"
            >
              {verTodos ? "Só o que o cliente pediu" : "Ver todo o banco de imagens"}
            </button>
          )}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-200 w-full sm:w-64">
            <Search className="size-4 text-zinc-400 shrink-0" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar produto..."
              className="bg-transparent outline-none text-sm flex-1 min-w-0"
            />
            {busca && (
              <button onClick={() => setBusca("")} className="text-zinc-400 hover:text-zinc-700">
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="p-5">
          {/* Recados sobre o pedido do cliente */}
          {!isLoading && !carregandoEscolha && (
            <div className="space-y-2 mb-4 empty:mb-0">
              {pedidos.size === 0 && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 flex gap-2.5 items-start">
                  <Inbox className="size-4 text-zinc-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-zinc-600">
                    {farmacia.nome} ainda não escolheu os produtos pelo link dela — mostrando o banco
                    inteiro. O link fica na aba <strong>Ofertas dos clientes</strong>, botão “Copiar link”.
                  </p>
                </div>
              )}

              {ultima?.produtos_livres && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2.5 items-start">
                  <PencilLine className="size-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 min-w-0">
                    <p className="font-medium">O cliente também escreveu itens fora do banco de imagens:</p>
                    <p className="whitespace-pre-line mt-0.5">{ultima.produtos_livres}</p>
                    <p className="text-amber-700/80 mt-1">
                      Esses não têm foto pronta — se for anunciar, cadastre a imagem antes.
                    </p>
                  </div>
                </div>
              )}

              {sumiram > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2.5 items-start">
                  <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    {sumiram} produto(s) que o cliente pediu não estão mais ativos no banco de imagens.
                  </p>
                </div>
              )}
            </div>
          )}

          {isLoading || carregandoEscolha ? (
            <div className="flex items-center justify-center gap-2 py-12 text-zinc-400 text-sm">
              <Loader2 className="size-4 animate-spin" /> Carregando o banco de imagens...
            </div>
          ) : visiveis.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-400">
              {busca
                ? `Nenhum produto encontrado para "${busca}".`
                : soDoCliente
                  ? "Nenhum dos produtos escolhidos pelo cliente está ativo no banco de imagens."
                  : "Nenhuma imagem ativa no banco. Cadastre em Configurações → Banco de Imagens."}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 max-h-[28rem] overflow-y-auto">
              {visiveis.map((p) => {
                const marcado = escolhidos.has(p.id);
                return (
                  <div
                    key={p.id}
                    className={`rounded-xl border p-2 transition ${
                      marcado ? "border-brand bg-brand/5" : "border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    <button onClick={() => alternar(p.id)} className="w-full text-left">
                      <div className="relative">
                        <img
                          src={catalogoImagemUrl(p.id)}
                          alt={p.nome}
                          loading="lazy"
                          className="w-full aspect-square object-contain rounded-lg bg-zinc-50"
                        />
                        <span className={`absolute top-1.5 left-1.5 size-5 rounded border grid place-items-center ${
                          marcado ? "bg-brand border-brand text-white" : "bg-white/90 border-zinc-300"
                        }`}>
                          {marcado && <Check className="size-3.5" />}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-700 mt-1.5 line-clamp-2 min-h-[2rem]">{p.nome}</p>
                    </button>

                    {marcado && (
                      <div className="mt-1.5 space-y-1.5">
                        {/* Liga o "de/por": um preço riscado antes do preço da oferta */}
                        <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
                          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">
                            De / Por
                          </span>
                          <Toggle
                            ligado={dePor.has(p.id)}
                            onChange={() => alternarDePor(p.id)}
                          />
                        </label>

                        {dePor.has(p.id) && (
                          <CampoPreco
                            rotulo="De"
                            valor={precosDe[p.id] ?? ""}
                            onChange={(v) => setPrecosDe((atual) => ({ ...atual, [p.id]: v }))}
                            riscado
                          />
                        )}
                        <CampoPreco
                          rotulo={dePor.has(p.id) ? "Por" : undefined}
                          valor={precos[p.id] ?? ""}
                          onChange={(v) => setPrecos((atual) => ({ ...atual, [p.id]: v }))}
                        />
                        {/* Deixa claro o que veio do cliente e o que o gestor mudou */}
                        {precosDoCliente[p.id] && (
                          <p className="text-[10px] text-zinc-400 text-right">
                            {precos[p.id] === precosDoCliente[p.id]
                              ? "preço enviado pelo cliente"
                              : `cliente enviou R$ ${precosDoCliente[p.id]}`}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Prévia dos criativos escolhidos */}
      {modelo && selecionados.length > 0 && (
        <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-5">
          <p className="text-sm font-semibold text-zinc-900">Prévia</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {selecionados.length} criativo(s) — é assim que vai chegar no grupo.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mt-4">
            {selecionados.map((p) => (
              <div key={p.id} style={{ containerType: "inline-size" }}>
                <CriativoCard {...dadosCriativo(p)} />
              </div>
            ))}
          </div>
        </div>
      )}

      <Rodape
        onVoltar={onVoltar}
        info={selecionados.length > 0 ? `${selecionados.length} criativo(s)` : undefined}
        acao={
          <button
            onClick={abrirAgendamento}
            disabled={!modelo || selecionados.length === 0}
            className="bg-brand hover:bg-brand/90 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg flex items-center gap-2 transition shadow-sm"
          >
            Continuar <ArrowRight className="size-4" />
          </button>
        }
      />

      {agendando && (
        <ModalAgendamento
          farmacia={farmacia}
          grupos={grupos}
          conexaoInicial={conexao}
          criativos={selecionados.map((p) => dadosCriativo(p))}
          onFechar={onFecharAgendamento}
          onPronto={onAgendado}
        />
      )}
    </div>
  );
}

/** Chavinha de ligar/desligar (usada no "de/por"). */
function Toggle({ ligado, onChange }: { ligado: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      onClick={onChange}
      className={`relative h-5 w-9 rounded-full transition-colors shrink-0 ${
        ligado ? "bg-brand" : "bg-zinc-300"
      }`}
    >
      <span
        className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${
          ligado ? "left-[1.125rem]" : "left-0.5"
        }`}
      />
    </button>
  );
}

/** Campo de preço com prefixo R$, máscara de dinheiro e rótulo opcional. */
function CampoPreco({
  rotulo, valor, onChange, riscado,
}: {
  rotulo?: string;
  valor: string;
  onChange: (v: string) => void;
  riscado?: boolean;
}) {
  return (
    <div className="relative">
      <span className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
        {rotulo && (
          <span className="text-[10px] font-semibold text-zinc-400 uppercase">{rotulo}</span>
        )}
        <span className="text-sm text-zinc-400">R$</span>
      </span>
      <input
        value={valor}
        onChange={(e) => onChange(formatarMoeda(e.target.value))}
        inputMode="numeric"
        placeholder="0,00"
        className={`w-full ${rotulo ? "pl-16" : "pl-8"} pr-2 py-1.5 rounded-lg border border-zinc-200 text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand/30 ${
          riscado ? "text-zinc-500 line-through" : ""
        }`}
      />
    </div>
  );
}

// ── Passo 4: modal de agendamento ─────────────────────────────────────────────

/** yyyy-mm-dd de hoje, no fuso do navegador (o input date espera esse formato). */
function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Próxima hora cheia, no formato do input datetime-local (yyyy-mm-ddThh:mm). */
function proximaHoraISO(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const data = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${data}T${String(d.getHours()).padStart(2, "0")}:00`;
}

const FREQUENCIAS: { id: RepetirDisparo; nome: string }[] = [
  { id: "diario",  nome: "Todo dia" },
  { id: "semanal", nome: "Toda semana" },
  { id: "mensal",  nome: "Todo mês" },
];

function ModalAgendamento({
  farmacia, grupos, conexaoInicial, criativos, onFechar, onPronto,
}: {
  farmacia: Farmacia;
  grupos: GrupoWhatsApp[];
  conexaoInicial: string | null;
  criativos: CriativoDados[];
  onFechar: () => void;
  onPronto: () => void;
}) {
  const [repete, setRepete] = useState(false);
  const [frequencia, setFrequencia] = useState<RepetirDisparo>("semanal");
  // Envio único: um campo só (data + hora). Repetido: janela com início e fim.
  const [envioEm, setEnvioEm] = useState(proximaHoraISO());
  const [dataInicio, setDataInicio] = useState(hojeISO());
  const [dataFim, setDataFim] = useState(hojeISO());
  const [horaInicio, setHoraInicio] = useState("08:00");
  const [horaFim, setHoraFim] = useState("21:00");
  const [conexao, setConexao] = useState<string | null>(conexaoInicial);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);

  const { data: conexoes = [] } = useQuery({
    queryKey: ["disparo-conexoes"],
    queryFn: getConexoesDisparo,
    staleTime: 60_000,
  });

  // Horários pré-definidos (Configurações → Horários de Disparo)
  const { data: horarios = [] } = useQuery({
    queryKey: ["horarios-disparo"],
    queryFn: getHorariosDisparo,
    staleTime: 5 * 60_000,
  });

  // Quando o disparo vai sair, nos dois modos
  const quandoISO = repete ? `${dataInicio}T${horaInicio}` : envioEm;
  const jaPassou = Boolean(quandoISO) && new Date(quandoISO).getTime() < Date.now();

  /** Hora atualmente escolhida ("HH:MM"), para destacar o chip correspondente. */
  const horaEscolhida = repete ? horaInicio : envioEm.slice(11, 16);

  /**
   * Aplica um horário pré-definido. No envio único mantém a data que já estava
   * e troca só a hora; se essa data/hora já passou, joga para amanhã — o
   * gestor clicou às 16h num preset de 09:00 querendo o próximo, não o de hoje.
   */
  function aplicarHorario(hora: string) {
    if (repete) {
      setHoraInicio(hora);
      return;
    }
    const dia = envioEm.slice(0, 10) || hojeISO();
    const candidato = `${dia}T${hora}`;
    if (new Date(candidato).getTime() < Date.now()) {
      const amanha = new Date(`${dia}T${hora}`);
      amanha.setDate(amanha.getDate() + 1);
      const d = `${amanha.getFullYear()}-${String(amanha.getMonth() + 1).padStart(2, "0")}-${String(amanha.getDate()).padStart(2, "0")}`;
      setEnvioEm(`${d}T${hora}`);
      return;
    }
    setEnvioEm(candidato);
  }

  async function confirmar() {
    if (!conexao) { toast.error("Escolha a conexão que vai disparar."); return; }
    if (!quandoISO) {
      toast.error(repete ? "Informe a data e a hora de início." : "Informe o horário do envio.");
      return;
    }
    if (repete && dataFim && dataFim < dataInicio) {
      toast.error("A data de término é anterior à de início."); return;
    }

    setEnviando(true);
    setProgresso(0);
    try {
      // Rasteriza um criativo por produto e comprime para caber no limite da Evolution
      const midias: MidiaDisparo[] = [];
      for (const dados of criativos) {
        const png = await exportarCriativoPng(dados);
        const comprimido = await comprimirParaEnvio(png);
        midias.push({
          b64:    comprimido.b64,
          mime:   comprimido.mime,
          rotulo: dados.precoDe && dados.preco
            ? `${dados.nome} — de R$${dados.precoDe} por R$${dados.preco}`
            : dados.preco ? `${dados.nome} — R$${dados.preco}` : dados.nome,
        });
        setProgresso(midias.length);
      }

      await criarDisparo({
        titulo:        `Ofertas — ${farmacia.nome}`,
        mensagem:      `🔥 *OFERTAS* — ${farmacia.nome} 🔥`,
        midias,
        grupos:        grupos.map((g) => ({ jid: g.jid, nome: g.nome })),
        quando:        "agendado",
        agendado_para: new Date(quandoISO).toISOString(),
        repetir:       repete ? frequencia : "nunca",
        timezone:      "America/Sao_Paulo",
        farmacia_id:   farmacia.id,
        instance:      conexao,
      });

      toast.success("Campanha agendada!");
      onPronto();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao agendar a campanha.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onFechar}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 py-4 border-b border-zinc-100">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-zinc-900 leading-tight">Agendamento</h2>
            <p className="text-sm text-zinc-500">
              {criativos.length} criativo(s) para {grupos.length} grupo(s) de {farmacia.nome}.
            </p>
          </div>
          <button
            onClick={onFechar}
            className="size-8 rounded-lg grid place-items-center text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition shrink-0"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Repetição */}
          <div>
            <p className="text-sm font-medium text-zinc-700">Essa campanha vai se repetir?</p>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                onClick={() => setRepete(false)}
                className={`p-3 rounded-xl border text-left transition ${
                  !repete ? "border-brand bg-brand/5" : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <p className="font-semibold text-zinc-900 text-sm">Não, envio único</p>
                <p className="text-xs text-zinc-500 mt-0.5">Dispara uma vez na data marcada.</p>
              </button>
              <button
                onClick={() => setRepete(true)}
                className={`p-3 rounded-xl border text-left transition ${
                  repete ? "border-brand bg-brand/5" : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <p className="font-semibold text-zinc-900 text-sm">Sim, repetir</p>
                <p className="text-xs text-zinc-500 mt-0.5">Repete até a data de término.</p>
              </button>
            </div>

            {repete && (
              <select
                value={frequencia}
                onChange={(e) => setFrequencia(e.target.value as RepetirDisparo)}
                className="mt-3 w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                {FREQUENCIAS.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            )}
          </div>

          {/* Horários pré-definidos — um clique em vez de digitar a hora */}
          {horarios.length > 0 && (
            <div>
              <p className="text-sm font-medium text-zinc-700">Horários pré-definidos</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {horarios.map((h) => {
                  const ativo = horaEscolhida === h.horario;
                  return (
                    <button
                      key={h.id}
                      onClick={() => aplicarHorario(h.horario)}
                      title={h.rotulo ?? undefined}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition ${
                        ativo
                          ? "border-brand bg-brand/5 text-brand"
                          : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                      }`}
                    >
                      {h.horario}
                      {h.rotulo && (
                        <span className="text-[11px] font-normal text-zinc-400 ml-1.5">{h.rotulo}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-zinc-400 mt-1.5">
                Configure a lista em Configurações → Horários de Disparo.
              </p>
            </div>
          )}

          {/* Envio único: só o horário do envio. Repetido: a janela inteira. */}
          {!repete ? (
            <Campo rotulo="Horário do envio">
              <input
                type="datetime-local"
                value={envioEm}
                onChange={(e) => setEnvioEm(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm bg-zinc-50/60 focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </Campo>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              <Campo rotulo="Data de início">
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm bg-zinc-50/60 focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </Campo>
              <Campo rotulo="Data de término">
                <input
                  type="date"
                  value={dataFim}
                  min={dataInicio}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm bg-zinc-50/60 focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </Campo>
              <Campo rotulo="Hora de início">
                <input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm bg-zinc-50/60 focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </Campo>
              <Campo rotulo="Hora de término">
                <input
                  type="time"
                  value={horaFim}
                  onChange={(e) => setHoraFim(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm bg-zinc-50/60 focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </Campo>
            </div>
          )}

          {jaPassou && (
            <p className="text-[11px] text-amber-600">
              Esse horário já passou — o disparo sai no próximo ciclo do agendador (até 1 minuto).
            </p>
          )}

          {/* Conexões */}
          <Campo rotulo="Conexões">
            <select
              value={conexao ?? ""}
              onChange={(e) => setConexao(e.target.value || null)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <option value="">Selecione a conexão</option>
              {conexoes.map((c) => (
                <option key={c.instanceName} value={c.instanceName} disabled={c.status !== "open"}>
                  {c.nome} {c.tipo === "gestor" ? "(sua)" : "(agência)"}
                  {c.status === "open" ? "" : " — desconectado"}
                </option>
              ))}
            </select>
          </Campo>

          <p className="text-[11px] text-zinc-400">
            Horário de Brasília.
            {repete && " Hoje o agendador usa a data/hora de início e a repetição — data de término e hora de término ainda não são aplicadas (falta suporte no backend)."}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-zinc-100 bg-zinc-50/50">
          <button
            onClick={onFechar}
            disabled={enviando}
            className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 disabled:opacity-50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={enviando}
            className="bg-brand hover:bg-brand/90 disabled:opacity-60 text-white font-semibold px-5 py-2 rounded-lg flex items-center gap-2 transition shadow-sm"
          >
            {enviando
              ? <><Loader2 className="size-4 animate-spin" /> Gerando criativos ({progresso}/{criativos.length})...</>
              : <><CalendarClock className="size-4" /> Agendar campanha</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-zinc-700">{rotulo}</label>
      {children}
    </div>
  );
}

/** Barra de navegação do passo: voltar à esquerda, ação à direita. */
function Rodape({
  onVoltar, info, acao,
}: {
  onVoltar: () => void;
  info?: string;
  acao: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <button
        onClick={onVoltar}
        className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 flex items-center gap-1.5 transition"
      >
        <ArrowLeft className="size-4" /> Voltar
      </button>
      <div className="flex items-center gap-3">
        {info && <span className="text-sm text-zinc-500">{info}</span>}
        {acao}
      </div>
    </div>
  );
}

// ── Aba: histórico de disparos ────────────────────────────────────────────────

const STATUS_CHIP: Record<string, { rotulo: string; classe: string; icone: typeof Send }> = {
  agendado:  { rotulo: "Agendado",  classe: "bg-blue-50 text-blue-700 ring-blue-200",          icone: CalendarClock },
  enviando:  { rotulo: "Enviando",  classe: "bg-amber-50 text-amber-700 ring-amber-200",       icone: Loader2 },
  enviado:   { rotulo: "Enviado",   classe: "bg-emerald-50 text-emerald-700 ring-emerald-200", icone: CheckCircle2 },
  erro:      { rotulo: "Erro",      classe: "bg-red-50 text-red-700 ring-red-200",             icone: AlertCircle },
  cancelado: { rotulo: "Cancelado", classe: "bg-zinc-100 text-zinc-500 ring-zinc-200",         icone: Ban },
};

const REPETICAO_ROTULO: Record<string, string> = {
  nunca: "", diario: "todo dia", semanal: "toda semana", mensal: "todo mês",
};

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function AbaHistorico({ onNovo }: { onNovo: () => void }) {
  const queryClient = useQueryClient();
  const { data: disparos = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["disparos"],
    queryFn: getDisparos,
    staleTime: 30_000,
  });

  const cancelar = useMutation({
    mutationFn: cancelarDisparo,
    onSuccess: () => {
      toast.success("Disparo cancelado.");
      queryClient.invalidateQueries({ queryKey: ["disparos"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Não foi possível cancelar."),
  });

  // Agendados primeiro — é o que ainda dá para mexer; depois o histórico.
  const { agendados, historico } = useMemo(() => ({
    agendados: disparos.filter((d) => d.status === "agendado"),
    historico: disparos.filter((d) => d.status !== "agendado"),
  }), [disparos]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-zinc-400 text-sm">
        <Loader2 className="size-4 animate-spin" /> Carregando disparos...
      </div>
    );
  }

  if (disparos.length === 0) {
    return (
      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm py-16 flex flex-col items-center gap-3 text-center">
        <Users className="size-10 text-zinc-200" />
        <div>
          <p className="text-sm font-semibold text-zinc-800">Nenhum disparo ainda</p>
          <p className="text-sm text-zinc-500 mt-0.5">
            Escolha uma farmácia e envie as ofertas para os grupos dela.
          </p>
        </div>
        <button
          onClick={onNovo}
          className="mt-1 flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-brand text-white rounded-lg hover:bg-brand/90 transition"
        >
          <Send className="size-4" /> Novo disparo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition"
        >
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      {agendados.length > 0 && (
        <Secao titulo="Agendados" contagem={agendados.length}>
          {agendados.map((d) => (
            <LinhaDisparo
              key={d.id}
              disparo={d}
              onCancelar={() => cancelar.mutate(d.id)}
              cancelando={cancelar.isPending && cancelar.variables === d.id}
            />
          ))}
        </Secao>
      )}

      {historico.length > 0 && (
        <Secao titulo="Histórico" contagem={historico.length}>
          {historico.map((d) => <LinhaDisparo key={d.id} disparo={d} />)}
        </Secao>
      )}
    </div>
  );
}

function Secao({ titulo, contagem, children }: { titulo: string; contagem: number; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center gap-2">
        <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">{titulo}</p>
        <span className="text-[11px] font-semibold text-zinc-400">({contagem})</span>
      </div>
      <div className="divide-y divide-zinc-50">{children}</div>
    </div>
  );
}

function LinhaDisparo({
  disparo, onCancelar, cancelando,
}: {
  disparo: DisparoResumo;
  onCancelar?: () => void;
  cancelando?: boolean;
}) {
  const chip = STATUS_CHIP[disparo.status] ?? {
    rotulo: disparo.status, classe: "bg-zinc-100 text-zinc-600 ring-zinc-200", icone: Send,
  };
  const Icone = chip.icone;
  const repeticao = REPETICAO_ROTULO[disparo.repetir] ?? "";

  return (
    <div className="px-5 py-4 flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-zinc-900 truncate">{disparo.titulo}</p>
        <p className="text-[11px] text-zinc-500 mt-0.5">
          {disparo.total_grupos} grupo(s) · {disparo.total_midias} criativo(s)
          {disparo.status === "agendado"
            ? ` · próximo envio ${fmtData(disparo.proximo_envio ?? disparo.agendado_para)}`
            : ` · ${fmtData(disparo.ultimo_envio ?? disparo.criado_em)}`}
          {repeticao && ` · repete ${repeticao}`}
        </p>
      </div>

      <span className={`shrink-0 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ring-1 ${chip.classe}`}>
        <Icone className={`size-3.5 ${disparo.status === "enviando" ? "animate-spin" : ""}`} />
        {chip.rotulo}
      </span>

      {onCancelar && (
        <button
          onClick={onCancelar}
          disabled={cancelando}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 border border-zinc-200 rounded-lg hover:border-red-300 hover:text-red-600 disabled:opacity-50 transition"
        >
          {cancelando ? <Loader2 className="size-3.5 animate-spin" /> : <Ban className="size-3.5" />}
          Cancelar
        </button>
      )}
    </div>
  );
}

// ── Aba: ofertas dos clientes ─────────────────────────────────────────────────

function AbaClientes({
  carteira, onMontar,
}: {
  carteira: ClienteCarteira[];
  onMontar: (c: ClienteCarteira) => void;
}) {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [copiado, setCopiado] = useState<number | null>(null);

  const responderam = carteira.filter((c) => c.respondeu);

  /** Copia o link daquele cliente. Cada farmácia tem o seu. */
  function copiarLink(c: ClienteCarteira) {
    if (!c.link) return;
    navigator.clipboard.writeText(c.link)
      .then(() => {
        setCopiado(c.farmacia_id);
        toast.success(`Link da ${c.farmacia} copiado!`);
        setTimeout(() => setCopiado((atual) => (atual === c.farmacia_id ? null : atual)), 2000);
      })
      .catch(() => toast.error("Não consegui copiar."));
  }

  const rows = useMemo(() => {
    const filtro = busca.trim().toLowerCase();
    return [...carteira]
      .filter((c) => c.farmacia.toLowerCase().includes(filtro))
      // Quem respondeu primeiro — é onde o gestor consegue agir
      .sort((a, b) => Number(b.respondeu) - Number(a.respondeu) || a.farmacia.localeCompare(b.farmacia, "pt-BR"));
  }, [carteira, busca]);

  return (
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
            onClick={() => queryClient.invalidateQueries({ queryKey: ["ofertas-carteira"] })}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition shrink-0"
          >
            <RefreshCw className="size-4" /> Atualizar
          </button>
        </div>
      </div>

      {/* Cada cliente tem o seu link — o botão fica na linha dele, abaixo */}
      <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-4 flex items-start gap-3">
        <Link2 className="size-5 text-brand shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-900">Cada cliente tem o seu próprio link</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Use o botão <strong className="text-zinc-600">Copiar link</strong> na linha do cliente e
            mande para ele. O link já abre na farmácia dele — o dono só escolhe os produtos, e o que
            ele enviar aparece nesta lista.
          </p>
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
          <div className="w-56" />
        </div>

        <div className="divide-y divide-zinc-50">
          {rows.length === 0 ? (
            <div className="text-center py-12 text-zinc-400 text-sm">
              {busca ? `Nenhuma farmácia encontrada para "${busca}".` : "Nenhuma farmácia na carteira."}
            </div>
          ) : (
            rows.map((c) => (
              <div
                key={c.farmacia_id}
                onClick={() => { if (c.respondeu) onMontar(c); }}
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

                {/* Ações */}
                <div className="w-56 flex justify-end items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); copiarLink(c); }}
                    disabled={!c.link}
                    title={c.link ?? "Link indisponível"}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-40 shrink-0 transition"
                  >
                    {copiado === c.farmacia_id
                      ? <><Check className="size-3.5 text-emerald-600" /> Copiado</>
                      : <><Copy className="size-3.5" /> Copiar link</>}
                  </button>
                  {c.respondeu && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onMontar(c); }}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-brand text-white rounded-lg hover:bg-brand/90 shrink-0"
                    >
                      Montar <ArrowRight className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
