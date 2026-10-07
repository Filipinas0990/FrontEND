import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Facebook,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getUser } from "@/lib/auth";
import { getMetaStatus, iniciarOAuthMeta, desconectarMeta, salvarTokenMeta, type MetaStatus } from "@/lib/api";

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
  /** Bolinha no canto: verde = ok, âmbar = atenção. */
  selo?: "ok" | "atencao";
};

/** Volta do Facebook (?meta=...) → mensagem para o gestor. */
const RETORNO_META: Record<string, [("success" | "error" | "info"), string]> = {
  ok:         ["success", "Facebook conectado! Agora você publica com a sua conta."],
  cancelado:  ["info",    "Conexão com o Facebook cancelada."],
  permissoes: ["error",   "Faltaram permissões. Conecte de novo e deixe todas marcadas."],
  erro:       ["error",   "Não foi possível conectar o Facebook. Tente de novo."],
};

function ConfigPage() {
  const isAdmin = getUser()?.is_admin === true;
  const [modalMeta, setModalMeta] = useState(false);
  const { data: meta } = useQuery({ queryKey: ["meta-status"], queryFn: getMetaStatus, staleTime: 60_000 });

  // O Facebook devolve o gestor aqui com ?meta=ok|cancelado|permissoes|erro.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const retorno = params.get("meta");
    if (!retorno) return;
    const [tipo, msg] = RETORNO_META[retorno] ?? RETORNO_META.erro;
    // A página acabou de carregar (voltou do Facebook): sem o atraso, o toast
    // dispara antes de o <Toaster> montar e some.
    setTimeout(() => toast[tipo](msg), 400);
    setModalMeta(true);
    params.delete("meta");
    const resto = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (resto ? `?${resto}` : ""));
  }, []);

  const metaAtencao = !!meta && (meta.expirado || (meta.conectado && (meta.dias_restantes ?? 99) <= 7));

  // Ativos: Conexões, Gestores (só admin), Banco de Imagens, Horários de
  // Disparo e Categorias. O resto é futuro (cadeado).
  const cards: CardItem[] = [
    { icon: Waypoints, label: "Conexões", to: "/conexoes" },
    {
      icon: Facebook, label: "Facebook (Meta Ads)", onClick: () => setModalMeta(true),
      selo: metaAtencao ? "atencao" : meta?.conectado ? "ok" : undefined,
    },
    isAdmin
      ? { icon: Users, label: "Gestores", to: "/gestores" }
      : { icon: Users, label: "Gestores", locked: true },
    { icon: Images, label: "Banco de Imagens", to: "/banco-imagens" },
    { icon: Clock, label: "Horários de Disparo", to: "/horarios" },
    { icon: Tags, label: "Categorias", to: "/categorias" },
    { icon: Puzzle, label: "Integrações de API", locked: true },
    { icon: BarChart3, label: "Power BI", locked: true },
    { icon: Bell, label: "Notificações", locked: true },
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
          nos criativos, com as categorias que organizam esse acervo. Os demais
          recursos vão sendo liberados por aqui. 🚀
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-4 max-w-5xl mx-auto">
        {cards.map((c) => (
          <Card key={c.label} {...c} />
        ))}
      </div>

      {modalMeta && <ModalFacebook status={meta} onFechar={() => setModalMeta(false)} />}
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
  selo,
}: {
  icon: typeof Users;
  label: string;
  locked?: boolean;
  selo?: "ok" | "atencao";
}) {
  return (
    <>
      {selo && (
        <span className={`absolute top-3 right-3 size-2.5 rounded-full ${selo === "ok" ? "bg-emerald-500" : "bg-amber-500"}`} />
      )}
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

function Card({ icon, label, onClick, to, locked, selo }: CardItem) {
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
      <CardInner icon={icon} label={label} selo={selo} />
    </button>
  );
}

// ── Facebook do gestor ───────────────────────────────────────────────────────

function ModalFacebook({ status, onFechar }: { status?: MetaStatus; onFechar: () => void }) {
  const qc = useQueryClient();
  const [ocupado, setOcupado] = useState(false);
  const [colando, setColando] = useState(false);
  const [tokenColado, setTokenColado] = useState("");

  async function salvarToken() {
    setOcupado(true);
    try {
      const r = await salvarTokenMeta(tokenColado.trim());
      toast.success(`Token salvo — publicando como ${r.nome}.`);
      setTokenColado("");
      setColando(false);
      await qc.invalidateQueries({ queryKey: ["meta-status"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function conectar() {
    setOcupado(true);
    try {
      await iniciarOAuthMeta(); // sai da página para o Facebook
    } catch (e) {
      toast.error((e as Error).message);
      setOcupado(false);
    }
  }

  async function desconectar() {
    setOcupado(true);
    try {
      const r = await desconectarMeta();
      toast.success(r.mensagem);
      await qc.invalidateQueries({ queryKey: ["meta-status"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  const expira = status?.expira_em ? new Date(status.expira_em).toLocaleDateString("pt-BR") : null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onFechar}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="size-10 rounded-lg bg-[#1877F2]/10 text-[#1877F2] grid place-items-center">
              <Facebook className="size-5" />
            </span>
            <div>
              <h3 className="text-lg font-bold text-zinc-900">Facebook (Meta Ads)</h3>
              <p className="text-xs text-zinc-500">Publique campanhas com a sua própria conta.</p>
            </div>
          </div>
          <button onClick={onFechar} className="size-8 grid place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100">
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5">
          {!status ? (
            <div className="flex items-center gap-2 text-sm text-zinc-500"><Loader2 className="size-4 animate-spin" /> Verificando…</div>
          ) : status.conectado ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-900">
                <CheckCircle2 className="size-4" /> Conectado como {status.nome ?? "—"}
              </p>
              <p className="text-xs text-emerald-800 mt-1">
                Suas campanhas saem com esta conta, e você vê só as contas de anúncio e páginas a que ela tem acesso.
                {expira && <> A conexão vale até <b>{expira}</b> ({status.dias_restantes} dias) — reconecte antes disso.</>}
              </p>
            </div>
          ) : (
            <div className={`rounded-lg border px-3 py-2.5 ${status.expirado ? "border-amber-200 bg-amber-50" : "border-zinc-200 bg-zinc-50"}`}>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
                {status.expirado && <AlertTriangle className="size-4 text-amber-600" />}
                {status.expirado ? "Sua conexão expirou" : "Você ainda não conectou o seu Facebook"}
              </p>
              <p className="text-xs text-zinc-600 mt-1">
                Enquanto isso, as campanhas saem com o <b>acesso geral da agência</b>. Conecte para publicar com a sua conta.
              </p>
            </div>
          )}
        </div>

        {/* Alternativa ao botão: colar um token gerado no Facebook. O token é
            validado e guardado no servidor (criptografado) — não fica no navegador. */}
        {status && (
          <div className="mt-4">
            {!colando ? (
              <button type="button" onClick={() => setColando(true)} className="text-xs font-medium text-zinc-500 hover:text-brand hover:underline">
                Prefere colar um token gerado no Facebook?
              </button>
            ) : (
              <div className="rounded-lg border border-zinc-200 p-3">
                <label className="text-xs font-semibold text-zinc-600">Token de acesso do Facebook</label>
                <input
                  type="password"
                  value={tokenColado}
                  onChange={(e) => setTokenColado(e.target.value)}
                  placeholder="EAA..."
                  autoComplete="off"
                  className="mt-1 w-full px-3 py-2 text-sm font-mono bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Use o token <b>estendido</b> (60 dias), com as permissões ads_management, pages_manage_ads e pages_show_list.
                </p>
                <div className="mt-2 flex justify-end gap-2">
                  <button type="button" onClick={() => { setColando(false); setTokenColado(""); }} className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-800">
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={salvarToken}
                    disabled={ocupado || tokenColado.trim().length < 40}
                    className="bg-brand hover:bg-brand/90 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                  >
                    {ocupado && <Loader2 className="size-3.5 animate-spin" />} Validar e salvar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {status && (
          <div className="mt-5 flex items-center justify-end gap-2">
            {status.conectado && (
              <button
                onClick={desconectar}
                disabled={ocupado}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-red-600 disabled:opacity-50"
              >
                Desconectar
              </button>
            )}
            {status.configurado && <button
              onClick={conectar}
              disabled={ocupado}
              className="bg-[#1877F2] hover:bg-[#1877F2]/90 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2"
            >
              {ocupado ? <Loader2 className="size-4 animate-spin" /> : <Facebook className="size-4" />}
              {status.conectado ? "Reconectar" : "Conectar com Facebook"}
            </button>}
          </div>
        )}
      </div>
    </div>
  );
}
