import { Link, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  SlidersHorizontal,
  Activity,
  LogOut,
  Trophy,
  CalendarDays,
  Home,
  Megaphone,
  Send,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { estaLogado, getUser, clearAuth } from "@/lib/auth";
import {
  logout,
  getWhatsAppStatus,
  getOfertasPendentes,
} from "@/lib/api";

interface AppShellProps {
  title: string;
  children: ReactNode;
  headerRight?: ReactNode;
  hideHeader?: boolean;
}

export function AppShell({ title, children, headerRight, hideHeader }: AppShellProps) {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getUser());

  // Client-side auth guard
  useEffect(() => {
    if (!estaLogado()) {
      navigate({ to: "/login" });
    } else {
      setUser(getUser());
    }
  }, [navigate]);

  const handleLogout = async () => {
    await logout();
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

  const { data: whatsappStatus } = useQuery({
    queryKey: ["whatsapp-status"],
    queryFn: getWhatsAppStatus,
    staleTime: 5 * 60_000,
    retry: false,
    enabled: estaLogado(),
  });

  // Pedidos de oferta que os donos das farmácias enviaram e ainda não viraram disparo
  const { data: ofertasPendentes } = useQuery({
    queryKey: ["ofertas-pendentes"],
    queryFn: getOfertasPendentes,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
    enabled: estaLogado(),
  });

  const totalPendentes = ofertasPendentes?.total ?? 0;

  const navItems = [
    { icon: Home,            label: "Início",         to: "/novidades" as const,        badge: undefined as ReactNode },
    { icon: LayoutDashboard, label: "Painel Geral",   to: "/" as const,                 badge: undefined as ReactNode },
    // "Em Entrada" saiu da sidebar — agora é uma aba dentro de Farmácias (FarmaciasTabs)
    { icon: Building2,       label: "Farmácias",      to: "/farmacias" as const,        badge: undefined as ReactNode },
    { icon: CalendarDays,    label: "Reuniões",       to: "/reunioes" as const,         badge: undefined as ReactNode },
   // { icon: Zap,             label: "Ações",          to: "/acoes" as const,            badge: undefined as ReactNode },
    { icon: Megaphone,       label: "Anúncios",       to: "/anuncios" as const,         badge: undefined as ReactNode },
    // Disparo em grupos de WhatsApp — hub próprio (saiu do botão da tela de Anúncios)
    {
      icon: Send,
      label: "Grupos",
      to: "/grupos" as const,
      badge: totalPendentes > 0
        ? <span
            title={`${totalPendentes} cliente(s) enviaram lista de ofertas`}
            className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-amber-400 text-brand text-[11px] font-bold grid place-items-center shrink-0"
          >{totalPendentes}</span>
        : undefined as ReactNode,
    },
    //{ icon: Trophy,          label: "Ranking",        to: "/ranking-gestores" as const, badge: undefined as ReactNode },
    // "Gestores" saiu da sidebar — agora é um card dentro de Configurações
    {
      icon: SlidersHorizontal,
      label: "Configurações",
      to: "/configuracoes" as const,
      badge: whatsappStatus?.conectado
        ? <span className="size-2 rounded-full bg-emerald-400 shrink-0" title="WhatsApp conectado" />
        : undefined,
    },
  ];

  return (
    <div className="flex min-h-screen bg-neutral-50 text-zinc-900 font-sans">
      <aside className="w-52 bg-brand flex flex-col sticky top-0 h-screen">
        <div className="px-5 py-5 flex items-center gap-3 border-b border-white/15">
          <div className="size-9 bg-white/20 rounded-xl grid place-items-center text-white shadow-inner">
            <Activity className="size-[18px]" strokeWidth={2.5} />
          </div>
          <span className="font-bold tracking-tight text-white text-[15px]">GrupoSymbol</span>
        </div>

        <nav className="flex-1 px-3 pt-3 space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: ["/", "/farmacias", "/reunioes"].includes(item.to) }}
              className="flex items-center gap-3 py-2.5 px-3 text-sm font-medium rounded-xl transition-all duration-150 text-white/70 hover:bg-white/10 hover:text-white data-[status=active]:bg-white data-[status=active]:text-brand data-[status=active]:shadow-sm"
            >
              <item.icon className="size-[18px] shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge}
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
        {!hideHeader && (
          <header className="h-16 border-b border-zinc-200 bg-white px-8 flex items-center justify-between sticky top-0 z-10">
            <h1 className="text-base font-semibold text-zinc-900">{title}</h1>
            <div className="flex items-center gap-4">
              {headerRight !== undefined ? headerRight : null}
            </div>
          </header>
        )}
        <div className="p-8 max-w-7xl mx-auto space-y-8">{children}</div>
      </main>
    </div>
  );
}
