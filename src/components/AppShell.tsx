import { Link, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  FileBarChart,
  Settings,
  Activity,
  Play,
  LogOut,
  Users,
  Trophy,
  CalendarDays,
  RefreshCw,
  Newspaper,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getToken, getUser, clearAuth } from "@/lib/auth";
import {
  getPreviewPipeline,
  getGestores,
  type PipelinePreview,
} from "@/lib/api";
import { usePipelineContext } from "@/contexts/PipelineContext";
import { PipelineLogTerminal } from "@/components/PipelineLogTerminal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const PIPELINE_MSGS = [
  "Estamos conhecendo seu fundo... 🔍",
  "Contando comprimido por comprimido... 💊",
  "Perguntando pro Google onde sumiram as vendas... 🤔",
  "Convencendo o Meta a gastar menos... 😅",
  "Verificando se o estoque de paciência está ok... 🧘",
  "Atualizando o karma das farmácias... ✨",
  "Mandando um abraço em cada farmácia... 🤗",
  "Calculando quantos reais cabem num dashboard... 💰",
  "Sincronizando com o universo farmacêutico... 🌌",
  "Pedindo permissão pros dados aparecerem... 🙏",
  "Brigando com o banco de dados... 😤",
  "Fazendo as contas sem precisar de calculadora... 🧮",
];

function PipelineOverlay() {
  const [msgIdx, setMsgIdx] = useState(0);
  const [fade, setFade] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setFade(false);
      setTimeout(() => {
        setMsgIdx((i) => (i + 1) % PIPELINE_MSGS.length);
        setFade(true);
      }, 400);
    }, 2800);
    return () => clearTimeout(timerRef.current);
  }, [msgIdx]);

  return (
    <div className="fixed inset-0 z-[9999] bg-zinc-900/75 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-white rounded-2xl p-10 max-w-sm w-full mx-4 text-center shadow-2xl flex flex-col items-center gap-6">
        {/* Spinner triplo */}
        <div className="relative size-20">
          <div className="absolute inset-0 rounded-full border-4 border-brand/20" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand animate-spin" />
          <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-emerald-400 animate-spin [animation-duration:0.7s] [animation-direction:reverse]" />
          <div className="absolute inset-4 rounded-full border-4 border-transparent border-t-brand/60 animate-spin [animation-duration:1.4s]" />
        </div>

        <div>
          <h2 className="text-lg font-bold text-zinc-900">Automação em andamento</h2>
          <p
            className="text-sm text-zinc-500 mt-2 transition-opacity duration-400 min-h-[2.5rem]"
            style={{ opacity: fade ? 1 : 0 }}
          >
            {PIPELINE_MSGS[msgIdx]}
          </p>
        </div>

        {/* Barra indeterminada */}
        <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
          <div className="h-full bg-brand rounded-full animate-[indeterminate_1.6s_ease-in-out_infinite]" />
        </div>

        <p className="text-[10px] text-zinc-400">
          Não feche esta janela. Isso pode demorar alguns minutos.
        </p>
      </div>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────

function fmtDuracao(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r > 0 ? `${m}min ${r}s` : `${m}min`;
}

const CHIP_PERIODO: Record<number, string> = {
  7:  "bg-blue-100 text-blue-700",
  15: "bg-purple-100 text-purple-700",
  30: "bg-emerald-100 text-emerald-700",
};

// ── ModalRodarAgora ───────────────────────────────────────────────────────

type ModalFase = "config" | "rodando" | "resultado";

function ModalRodarAgora({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { pipelineRodando, ultimoResultado, iniciarPipeline, iniciadoEm } = usePipelineContext();
  const [periodos, setPeriodos] = useState<number[]>([7, 15, 30]);
  const [gestorId, setGestorId] = useState<number | undefined>(undefined);
  const [preview, setPreview] = useState<PipelinePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [fase, setFase] = useState<ModalFase>("config");

  const { data: gestores = [] } = useQuery({
    queryKey: ["gestores"],
    queryFn: getGestores,
    staleTime: 60_000,
    enabled: open,
  });

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setPeriodos([7, 15, 30]);
      setGestorId(undefined);
      setPreview(null);
      // Se pipeline já está rodando ao abrir, vai direto para fase "rodando"
      setFase(pipelineRodando ? "rodando" : ultimoResultado ? "resultado" : "config");
    }
  }, [open]);

  // Quando o pipeline termina, avança para "resultado"
  useEffect(() => {
    if (fase === "rodando" && !pipelineRodando) setFase("resultado");
  }, [pipelineRodando, fase]);

  // Preview com debounce
  useEffect(() => {
    if (!open || fase !== "config" || periodos.length === 0) { setPreview(null); return; }
    setLoadingPreview(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await getPreviewPipeline(periodos, gestorId);
        if (!cancelled) setPreview(res);
      } catch { if (!cancelled) setPreview(null); }
      finally { if (!cancelled) setLoadingPreview(false); }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, fase, periodos, gestorId]);

  function togglePeriodo(p: number) {
    setPeriodos((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  }

  async function handleConfirmar() {
    if (periodos.length === 0) return;
    setFase("rodando");
    await iniciarPipeline({ periodos, gestor_id: gestorId });
  }

  // Duração calculada
  const duracao = iniciadoEm && ultimoResultado?.executado_em
    ? fmtDuracao(new Date(ultimoResultado.executado_em).getTime() - iniciadoEm)
    : null;

  // Agrupa erros por farmácia
  const errosAgrupados = ultimoResultado
    ? Object.values(
        ultimoResultado.farmaciasComErro.reduce<Record<string, { nome: string; periodos: number[]; erro: string }>>((acc, e) => {
          if (!acc[e.nome]) acc[e.nome] = { nome: e.nome, periodos: [], erro: e.erro };
          acc[e.nome].periodos.push(e.periodo);
          return acc;
        }, {})
      )
    : [];

  const estimativa = preview
    ? preview.estimativa_segundos ?? preview.farmaciasTotais * periodos.length * 8
    : null;

  return (
    <Dialog open={open} onOpenChange={(v) => {
      // Permite fechar em qualquer fase, mas enquanto roda o modal reabre (usuário precisa clicar fora com intenção)
      onOpenChange(v);
    }}>
      <DialogContent className={fase === "config" ? "sm:max-w-md" : "sm:max-w-2xl"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {fase === "config"    && <><Play className="size-4 text-brand" fill="currentColor" /> Configurar Automação</>}
            {fase === "rodando"   && <><RefreshCw className="size-4 text-blue-500 animate-spin" /> Automação em andamento</>}
            {fase === "resultado" && (ultimoResultado?.totalErros === 0
              ? <><CheckCircle2 className="size-4 text-emerald-500" /> Coleta concluída</>
              : <><AlertTriangle className="size-4 text-amber-500" /> Coleta com erros</>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* ── Fase: config ── */}
        {fase === "config" && (
          <div className="space-y-5 py-1">
            <div>
              <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Períodos</p>
              <p className="text-xs text-zinc-400 mt-0.5 mb-2.5">Selecione quais períodos processar</p>
              <div className="flex gap-2">
                {[7, 15, 30].map((p) => {
                  const active = periodos.includes(p);
                  return (
                    <button key={p} onClick={() => togglePeriodo(p)}
                      className={["flex-1 py-2.5 text-sm font-semibold rounded-xl ring-1 transition-all",
                        active ? "bg-brand text-white ring-brand shadow-sm" : "bg-zinc-50 text-zinc-600 ring-zinc-200 hover:ring-zinc-300 hover:bg-zinc-100",
                      ].join(" ")}
                    >{p} dias</button>
                  );
                })}
              </div>
              {periodos.length === 0 && <p className="text-xs text-red-500 mt-1.5">Selecione ao menos um período.</p>}
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Gestor</p>
              <select value={gestorId ?? ""} onChange={(e) => setGestorId(e.target.value ? Number(e.target.value) : undefined)} className="mt-1.5 form-input w-full">
                <option value="">Todos os gestores</option>
                {gestores.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </select>
            </div>
            <div className="bg-zinc-50 rounded-xl ring-1 ring-zinc-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Prévia</p>
                {loadingPreview && <RefreshCw className="size-3 animate-spin text-zinc-400" />}
              </div>
              {periodos.length === 0 ? <p className="text-xs text-zinc-400 italic">Selecione ao menos um período.</p>
              : loadingPreview && !preview ? (
                <div className="space-y-2">{[80,60,70].map((w,i) => <div key={i} className="h-3 bg-zinc-200 rounded animate-pulse" style={{ width:`${w}%` }} />)}</div>
              ) : preview ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between"><span className="text-xs text-zinc-500">Farmácias</span><span className="text-sm font-bold text-zinc-900">{preview.farmaciasTotais}</span></div>
                  <div className="flex items-center justify-between"><span className="text-xs text-zinc-500">Períodos</span><span className="text-sm font-semibold text-zinc-700">{periodos.map(p=>`${p}d`).join(" · ")}</span></div>
                  {estimativa != null && <div className="flex items-center justify-between"><span className="text-xs text-zinc-500">Estimativa</span><span className="text-sm font-medium text-zinc-700">~{estimativa<60?`${Math.round(estimativa)}s`:`${Math.ceil(estimativa/60)} min`}</span></div>}
                  {preview.nomes.length > 0 && (
                    <div className="pt-2.5 border-t border-zinc-100">
                      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Farmácias incluídas</p>
                      <div className="flex flex-wrap gap-1">
                        {preview.nomes.slice(0,8).map(n=><span key={n} className="text-[10px] bg-white ring-1 ring-zinc-200 px-2 py-0.5 rounded-full text-zinc-600 truncate max-w-[140px]">{n}</span>)}
                        {preview.nomes.length > 8 && <span className="text-[10px] text-zinc-400 self-center">+{preview.nomes.length-8} mais</span>}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* ── Fase: rodando — terminal em tempo real ── */}
        {fase === "rodando" && (
          <div className="py-2 space-y-3">
            <PipelineLogTerminal ativo={pipelineRodando} onConcluir={() => setFase("resultado")} />
            <p className="text-[11px] text-zinc-400 text-center">
              Pode fechar — o pipeline continua rodando e o resultado aparecerá no painel.
            </p>
          </div>
        )}

        {/* ── Fase: resultado — resumo + logs ── */}
        {fase === "resultado" && ultimoResultado && (
          <div className="py-2 space-y-4">
            {/* Resumo */}
            {ultimoResultado.totalErros === 0 ? (
              <div className="flex items-start gap-3 p-4 bg-emerald-50 rounded-xl ring-1 ring-emerald-100">
                <CheckCircle2 className="size-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Tudo certo!</p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    {ultimoResultado.totalSucessos}/{ultimoResultado.farmaciasTotais} farmácias coletadas
                    {duracao && ` · ${duracao}`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl ring-1 ring-amber-100">
                  <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      {ultimoResultado.totalSucessos}/{ultimoResultado.farmaciasTotais} farmácias coletadas
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      {ultimoResultado.totalErros} falharam mesmo após retries{duracao && ` · ${duracao}`}
                    </p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {errosAgrupados.map((e) => (
                    <div key={e.nome} className="flex items-center gap-2 p-2.5 bg-zinc-50 rounded-lg ring-1 ring-zinc-100">
                      <XCircle className="size-3.5 text-amber-500 shrink-0" />
                      <span className="text-xs font-medium text-zinc-800 flex-1 min-w-0 truncate">{e.nome}</span>
                      <div className="flex gap-1 shrink-0">
                        {e.periodos.sort().map(p => (
                          <span key={p} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${CHIP_PERIODO[p] ?? "bg-zinc-100 text-zinc-600"}`}>{p}d</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Terminal com logs completos */}
            <PipelineLogTerminal ativo={false} />
          </div>
        )}

        <DialogFooter>
          {fase === "config" && (
            <>
              <button type="button" onClick={() => onOpenChange(false)} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">Cancelar</button>
              <button type="button" onClick={handleConfirmar} disabled={periodos.length === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-md hover:opacity-90 disabled:opacity-60">
                <Play className="size-3.5" fill="currentColor" /> Confirmar e Rodar
              </button>
            </>
          )}
          {fase === "rodando" && (
            <button type="button" onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-700">
              Fechar (pipeline continua em background)
            </button>
          )}
          {fase === "resultado" && (
            <button type="button" onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm font-medium bg-zinc-100 text-zinc-700 rounded-md hover:bg-zinc-200">
              Fechar
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AppShellProps {
  title: string;
  children: ReactNode;
  headerRight?: ReactNode;
}

export function AppShell({ title, children, headerRight }: AppShellProps) {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getUser());

  // Client-side auth guard
  useEffect(() => {
    if (!getToken()) {
      navigate({ to: "/login" });
    } else {
      setUser(getUser());
    }
  }, [navigate]);

  const handleLogout = () => {
    clearAuth();
    navigate({ to: "/login" });
  };

  const isAdminUser = user?.is_admin === true;
  const initials = user?.nome
    ? user.nome
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "??";

  const queryClient = useQueryClient();
  const [modalRodar, setModalRodar] = useState(false);
  const { pipelineRodando } = usePipelineContext();
  const prevRodando = useRef(false);

  // Invalida cache quando o pipeline termina
  useEffect(() => {
    if (prevRodando.current && !pipelineRodando) {
      queryClient.invalidateQueries();
    }
    prevRodando.current = pipelineRodando;
  }, [pipelineRodando, queryClient]);

  const isPipelineActive = pipelineRodando;

  const navItems = [
    { icon: Newspaper,       label: "Início",       to: "/novidades" as const },
    { icon: LayoutDashboard, label: "Painel Geral", to: "/" as const },
    { icon: Building2, label: "Farmácias", to: "/farmacias" as const },
    { icon: CalendarDays, label: "Reuniões", to: "/reunioes" as const },
    { icon: Trophy, label: "Ranking", to: "/ranking-gestores" as const },
    { icon: FileBarChart, label: "Relatórios", to: "/relatorios" as const },
    ...(isAdminUser
      ? [{ icon: Users, label: "Gestores", to: "/gestores" as const }]
      : []),
    { icon: Settings, label: "Configurações", to: "/configuracoes" as const },
  ];

  return (
    <div className="flex min-h-screen bg-neutral-50 text-zinc-900 font-sans">
      <aside className="w-52 bg-brand flex flex-col sticky top-0 h-screen">
        <div className="p-6 flex items-center gap-3">
          <div className="size-8 bg-white/20 rounded-lg grid place-items-center text-white">
            <Activity className="size-4" strokeWidth={2.5} />
          </div>
          <span className="font-semibold tracking-tight text-white">GrupoSymbol</span>
        </div>

        <nav className="flex-1 px-4 space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="flex items-center gap-2.5 py-2.5 px-3 text-sm font-medium rounded-lg transition-colors text-white/75 hover:bg-white/10 hover:text-white data-[status=active]:bg-white/20 data-[status=active]:text-white"
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-white/15">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="size-8 rounded-full bg-white/20 grid place-items-center text-white text-xs font-semibold">
              {initials}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-xs font-medium text-white truncate">
                {user?.nome ?? "Usuário"}
              </span>
              <span className="text-[10px] text-white/60">
                {isAdminUser ? "Super Admin" : "Gestor"}
              </span>
            </div>
            <button
              onClick={handleLogout}
              title="Sair"
              className="text-white/60 hover:text-white transition-colors"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="h-16 border-b border-zinc-200 bg-white px-8 flex items-center justify-between sticky top-0 z-10">
          <h1 className="text-base font-semibold text-zinc-900">{title}</h1>
          <div className="flex items-center gap-4">
            {headerRight !== undefined ? headerRight : (
              isAdminUser ? (
                <button
                  onClick={() => setModalRodar(true)}
                  className="flex items-center gap-2 py-2 px-3 text-sm font-medium bg-brand text-white rounded-md hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {isPipelineActive
                    ? <><RefreshCw className="size-3.5 animate-spin" /> Rodando...</>
                    : <><Play className="size-3.5" fill="currentColor" /> Rodar Agora</>}
                </button>
              ) : null
            )}
          </div>
        </header>
        <div className="p-8 max-w-7xl mx-auto space-y-8">{children}</div>
      </main>

      <ModalRodarAgora open={modalRodar} onOpenChange={setModalRodar} />
    </div>
  );
}
