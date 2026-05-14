import { Link, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  FileBarChart,
  Zap,
  Settings,
  Activity,
  Play,
  LogOut,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getToken, getUser, clearAuth } from "@/lib/auth";
import { getStatus, rodarAgora } from "@/lib/api";

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
  // overlayVisible = fonte de verdade para mostrar o overlay
  const [overlayVisible, setOverlayVisible] = useState(false);
  // Rastreia se já chegou a ver pipeline_rodando: true (para saber quando terminou)
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
      // Mostra overlay IMEDIATAMENTE ao clicar
      setOverlayVisible(true);
      seenRunning.current = false;
    },
    onSuccess: (data) => {
      if (data.status === "ja_rodando") {
        toast.info("Pipeline já está em execução");
        seenRunning.current = true; // já estava rodando
      }
      // Força poll imediato para pegar pipeline_rodando: true rápido
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
    { icon: FileBarChart, label: "Relatórios", to: "/relatorios" as const },
    ...(isAdminUser
      ? [{ icon: Users, label: "Gestores", to: "/gestores" as const }]
      : []),
    { icon: Zap, label: "Automações", to: "/automacoes" as const },
    { icon: Settings, label: "Configurações", to: "/configuracoes" as const },
  ];

  return (
    <div className="flex min-h-screen bg-neutral-50 text-zinc-900 font-sans">
      {isPipelineActive && <PipelineOverlay />}
      <aside className="w-64 border-r border-zinc-200 bg-white flex flex-col sticky top-0 h-screen">
        <div className="p-6 flex items-center gap-3">
          <div className="size-8 bg-brand rounded-lg grid place-items-center text-white">
            <Activity className="size-4" strokeWidth={2.5} />
          </div>
          <span className="font-semibold tracking-tight text-zinc-900">PharmaFlow</span>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="flex items-center gap-2.5 py-2 px-2.5 text-sm font-medium rounded-md transition-colors text-zinc-600 hover:bg-zinc-50 data-[status=active]:text-brand data-[status=active]:bg-brand/5"
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-100">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="size-8 rounded-full bg-brand/10 grid place-items-center text-brand text-xs font-semibold">
              {initials}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-xs font-medium truncate">
                {user?.nome ?? "Usuário"}
              </span>
              <span className="text-[10px] text-zinc-500">
                {isAdminUser ? "Super Admin" : "Gestor"}
              </span>
            </div>
            <button
              onClick={handleLogout}
              title="Sair"
              className="text-zinc-400 hover:text-zinc-900 transition-colors"
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
                  onClick={() => runPipeline()}
                  disabled={isPipelineActive}
                  className="flex items-center gap-2 py-2 px-3 text-sm font-medium bg-brand text-white rounded-md hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                    <Play className="size-3.5" fill="currentColor" />
                  {isPipelineActive ? "Rodando..." : "Rodar Agora"}
                </button>
              ) : null
            )}
          </div>
        </header>
        <div className="p-8 max-w-7xl mx-auto space-y-8">{children}</div>
      </main>
    </div>
  );
}
