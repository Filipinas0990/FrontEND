import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Waypoints,
  Users,
  Images,
  Puzzle,
  BarChart3,
  Bell,
  Tags,
  Zap,
  Star,
  CalendarClock,
  Clock,
  Settings,
  Lock,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getUser } from "@/lib/auth";

export const Route = createFileRoute("/configuracoes")({
  component: ConfigPage,
  head: () => ({ meta: [{ title: "Configurações — GrupoSymbol" }] }),
});

type CardItem = {
  icon: typeof Users;
  label: string;
  onClick?: () => void; // ativo (abre modal / ação)
  to?: string; // ativo (navega)
  locked?: boolean; // futuro (cadeado)
};

function ConfigPage() {
  const isAdmin = getUser()?.is_admin === true;

  // Ativos: Conexões, Gestores (só admin), Banco de Imagens e Horários de
  // Disparo. O resto é futuro (cadeado).
  const cards: CardItem[] = [
    { icon: Waypoints, label: "Conexões", to: "/conexoes" },
    isAdmin
      ? { icon: Users, label: "Gestores", to: "/gestores" }
      : { icon: Users, label: "Gestores", locked: true },
    { icon: Images, label: "Banco de Imagens", to: "/banco-imagens" },
    { icon: Clock, label: "Horários de Disparo", to: "/horarios" },
    { icon: Puzzle, label: "Integrações de API", locked: true },
    { icon: BarChart3, label: "Power BI", locked: true },
    { icon: Bell, label: "Notificações", locked: true },
    { icon: Tags, label: "Etiquetas", locked: true },
    { icon: Zap, label: "Mensagens Rápidas", locked: true },
    { icon: Star, label: "Pesquisas de Satisfação", locked: true },
    { icon: CalendarClock, label: "Mensagens Agendadas", locked: true },
    { icon: Settings, label: "Configurações Gerais", locked: true },
  ];

  return (
    <AppShell title="Configurações">
      <div className="text-center max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-zinc-900">Administração</h2>
        <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
          Personalize o sistema de acordo com a operação do seu grupo. Aqui você
          gerencia as conexões, a equipe de gestores e o banco de imagens usado
          nos criativos. Os demais recursos vão sendo liberados por aqui. 🚀
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-4 max-w-5xl mx-auto">
        {cards.map((c) => (
          <Card key={c.label} {...c} />
        ))}
      </div>
    </AppShell>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────
// Largura fixa (w-40) + flex-wrap justify-center no container = 6 por linha e a
// última linha (5) centralizada, exatamente como no print.

const CARD_BASE =
  "relative flex flex-col items-center justify-center gap-3 rounded-2xl p-6 w-40 aspect-[4/3] transition-all duration-150";
const CARD_ACTIVE =
  "bg-zinc-100 hover:bg-zinc-200/70 hover:shadow-md hover:-translate-y-0.5 cursor-pointer";

function CardInner({
  icon: Icon,
  label,
  locked,
}: {
  icon: typeof Users;
  label: string;
  locked?: boolean;
}) {
  return (
    <>
      {locked && (
        <span className="absolute top-2.5 right-2.5 size-6 rounded-full bg-white grid place-items-center ring-1 ring-zinc-200">
          <Lock className="size-3 text-zinc-400" />
        </span>
      )}
      <Icon
        className={`size-9 ${locked ? "text-zinc-300" : "text-brand"}`}
        strokeWidth={1.75}
      />
      <span
        className={`text-sm font-semibold text-center leading-tight ${locked ? "text-zinc-400" : "text-zinc-700"}`}
      >
        {label}
      </span>
    </>
  );
}

function Card({ icon, label, onClick, to, locked }: CardItem) {
  if (locked) {
    return (
      <button
        type="button"
        onClick={() => toast.info(`"${label}" estará disponível em breve. 🔒`)}
        className={`${CARD_BASE} bg-zinc-100/60 cursor-not-allowed`}
      >
        <CardInner icon={icon} label={label} locked />
      </button>
    );
  }
  if (to) {
    return (
      <Link to={to} className={`${CARD_BASE} ${CARD_ACTIVE}`}>
        <CardInner icon={icon} label={label} />
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={`${CARD_BASE} ${CARD_ACTIVE}`}>
      <CardInner icon={icon} label={label} />
    </button>
  );
}
