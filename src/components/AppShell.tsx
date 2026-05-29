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
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getToken, getUser, clearAuth } from "@/lib/auth";
import {
  getStatus,
  rodarAgora,
  getPreviewPipeline,
  getGestores,
  type PipelinePreview,
} from "@/lib/api";
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

// ── ModalRodarAgora ───────────────────────────────────────────────────────

function ModalRodarAgora({
  open,
  onOpenChange,
  onConfirmar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirmar: (opts: { periodos: number[]; gestor_id?: number }) => void;
}) {
  const [periodos, setPeriodos] = useState<number[]>([7, 15, 30]);
  const [gestorId, setGestorId] = useState<number | undefined>(undefined);
  const [preview, setPreview] = useState<PipelinePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

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
    }
  }, [open]);

  // Preview com debounce
  useEffect(() => {
    if (!open || periodos.length === 0) { setPreview(null); return; }
    setLoadingPreview(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await getPreviewPipeline(periodos, gestorId);
        if (!cancelled) setPreview(res);
      } catch {
        if (!cancelled) setPreview(null);
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, periodos, gestorId]);

  function togglePeriodo(p: number) {
    setPeriodos((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  }

  const estimativa = preview
    ? preview.estimativa_segundos ?? preview.farmaciasTotais * periodos.length * 8
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="size-4 text-brand" fill="currentColor" />
            Configurar Automação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Períodos */}
          <div>
            <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Períodos</p>
            <p className="text-xs text-zinc-400 mt-0.5 mb-2.5">Selecione quais períodos processar</p>
            <div className="flex gap-2">
              {[7, 15, 30].map((p) => {
                const active = periodos.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => togglePeriodo(p)}
                    className={[
                      "flex-1 py-2.5 text-sm font-semibold rounded-xl ring-1 transition-all",
                      active
                        ? "bg-brand text-white ring-brand shadow-sm"
                        : "bg-zinc-50 text-zinc-600 ring-zinc-200 hover:ring-zinc-300 hover:bg-zinc-100",
                    ].join(" ")}
                  >
                    {p} dias
                  </button>
                );
              })}
            </div>
            {periodos.length === 0 && (
              <p className="text-xs text-red-500 mt-1.5">Selecione ao menos um período.</p>
            )}
          </div>

          {/* Gestor */}
          <div>
            <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Gestor</p>
            <select
              value={gestorId ?? ""}
              onChange={(e) => setGestorId(e.target.value ? Number(e.target.value) : undefined)}
              className="mt-1.5 form-input w-full"
            >
              <option value="">Todos os gestores</option>
              {gestores.map((g) => (
                <option key={g.id} value={g.id}>{g.nome}</option>
              ))}
            </select>
          </div>

          {/* Prévia */}
          <div className="bg-zinc-50 rounded-xl ring-1 ring-zinc-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Prévia</p>
              {loadingPreview && <RefreshCw className="size-3 animate-spin text-zinc-400" />}
            </div>

            {periodos.length === 0 ? (
              <p className="text-xs text-zinc-400 italic">Selecione ao menos um período.</p>
            ) : loadingPreview && !preview ? (
              <div className="space-y-2">
                {[80, 60, 70].map((w, i) => (
                  <div key={i} className="h-3 bg-zinc-200 rounded animate-pulse" style={{ width: `${w}%` }} />
                ))}
              </div>
            ) : preview ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Farmácias</span>
                  <span className="text-sm font-bold text-zinc-900">{preview.farmaciasTotais}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Períodos</span>
                  <span className="text-sm font-semibold text-zinc-700">{periodos.map((p) => `${p}d`).join(" · ")}</span>
                </div>
                {estimativa != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Tempo estimado</span>
                    <span className="text-sm font-medium text-zinc-700">
                      ~{estimativa < 60 ? `${Math.round(estimativa)}s` : `${Math.ceil(estimativa / 60)} min`}
                    </span>
                  </div>
                )}
                {preview.nomes.length > 0 && (
                  <div className="pt-2.5 border-t border-zinc-100">
                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Farmácias incluídas</p>
                    <div className="flex flex-wrap gap-1">
                      {preview.nomes.slice(0, 8).map((n) => (
                        <span key={n} className="text-[10px] bg-white ring-1 ring-zinc-200 px-2 py-0.5 rounded-full text-zinc-600 truncate max-w-[140px]">
                          {n}
                        </span>
                      ))}
                      {preview.nomes.length > 8 && (
                        <span className="text-[10px] text-zinc-400 self-center">+{preview.nomes.length - 8} mais</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <button type="button" onClick={() => onOpenChange(false)} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              if (periodos.length === 0) return;
              onConfirmar({ periodos, gestor_id: gestorId });
              onOpenChange(false);
            }}
            disabled={periodos.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-md hover:opacity-90 disabled:opacity-60"
          >
            <Play className="size-3.5" fill="currentColor" />
            Confirmar e Rodar
          </button>
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
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [modalRodar, setModalRodar] = useState(false);
  const seenRunning = useRef(false);

  const { data: pipelineStatus } = useQuery({
    queryKey: ["pipeline-status"],
    queryFn: getStatus,
    refetchInterval: (query) =>
      query.state.data?.pipeline_rodando ? 3000 : 30000,
    enabled: typeof window !== "undefined",
  });

  // Fecha o overlay quando o backend confirmar que o pipeline terminou
  useEffect(() => {
    if (pipelineStatus?.pipeline_rodando) {
      seenRunning.current = true;
    } else if (seenRunning.current && pipelineStatus?.pipeline_rodando === false) {
      seenRunning.current = false;
      setOverlayVisible(false);
      toast.success("Automação concluída! Dados atualizados.");
      queryClient.invalidateQueries();
    }
  }, [pipelineStatus?.pipeline_rodando, queryClient]);

  const { mutate: runPipeline } = useMutation({
    mutationFn: rodarAgora,
    onMutate: () => {
      setOverlayVisible(true);
      seenRunning.current = false;
    },
    onSuccess: (data) => {
      if (data.status === "ja_rodando") {
        toast.info("Pipeline já está em execução");
        seenRunning.current = true;
      }
      queryClient.invalidateQueries({ queryKey: ["pipeline-status"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setOverlayVisible(false);
    },
  });

  const isPipelineActive = overlayVisible || pipelineStatus?.pipeline_rodando === true;

  const navItems = [
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
      {isPipelineActive && <PipelineOverlay />}
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
            {headerRight ?? (
              isAdminUser ? (
                <button
                  onClick={() => { if (!isPipelineActive) setModalRodar(true); }}
                  disabled={isPipelineActive}
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

      <ModalRodarAgora
        open={modalRodar}
        onOpenChange={setModalRodar}
        onConfirmar={(opts) => runPipeline(opts)}
      />
    </div>
  );
}
