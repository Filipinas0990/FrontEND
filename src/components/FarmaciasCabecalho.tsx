import type { ReactNode } from "react";
import { RefreshCw, type LucideIcon } from "lucide-react";
import { usePeriod, type Period } from "@/contexts/PeriodContext";
import { SeletorIntervalo } from "@/components/SeletorIntervalo";

/**
 * Bloco vermelho do topo do módulo Farmácias. As abas "Farmácias" e
 * "Em Entrada" usam o mesmo, para a troca de aba não mudar o layout.
 * O período é o global (PeriodContext).
 */
export function FarmaciasCabecalho({
  subtitulo, atualizando, onAtualizar, acao, children,
}: {
  subtitulo: ReactNode;
  atualizando: boolean;
  onAtualizar: () => void;
  /** Botão principal à direita (ex.: "Nova farmácia"). */
  acao?: ReactNode;
  /** Os indicadores (IndicadorTopo), quatro por linha. */
  children: ReactNode;
}) {
  const { period, setPeriod, intervalo } = usePeriod();

  return (
    <section className="rounded-3xl bg-gradient-to-br from-red-500 via-brand to-[#5c0a24] px-6 py-5 text-white shadow-lg">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm font-medium text-white/80">Gestão da rede</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Farmácias</h1>
          <p className="mt-1 text-sm text-white/75">{subtitulo}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-2xl bg-white/15 p-1">
            {([7, 15, 30] as Period[]).map((d) => (
              <button
                key={d}
                onClick={() => setPeriod(d)}
                className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ${
                  !intervalo && period === d ? "bg-white text-brand" : "text-white/85 hover:text-white"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <SeletorIntervalo escuro />
          <button
            onClick={onAtualizar}
            disabled={atualizando}
            title="Atualizar dados"
            className="grid size-10 place-items-center rounded-xl bg-white/15 text-white hover:bg-white/25 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${atualizando ? "animate-spin" : ""}`} />
          </button>
          {acao}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>
    </section>
  );
}

/** Botão branco do topo, no lugar do botão principal da página. */
export const CLASSE_ACAO_TOPO =
  "flex items-center gap-2 h-10 px-4 text-sm font-semibold bg-white text-brand rounded-xl shadow-sm hover:bg-white/90";

export function IndicadorTopo({
  icone: Icone, rotulo, valor, detalhe, carregando, ativo, onClick,
}: {
  icone: LucideIcon;
  rotulo: string;
  valor: string;
  detalhe?: string;
  carregando: boolean;
  ativo?: boolean;
  onClick?: () => void;
}) {
  const conteudo = (
    <>
      <p className="flex items-center gap-1.5 text-xs text-white/85">
        <Icone className="size-4" /> {rotulo}
      </p>
      {carregando
        ? <div className="mt-1.5 h-6 w-24 rounded-lg bg-white/15 animate-pulse" />
        : <p className="mt-0.5 text-2xl font-extrabold tracking-tight">{valor}</p>}
      {detalhe && !carregando && <p className="text-xs text-white/70">{detalhe}</p>}
    </>
  );
  const base = "rounded-xl px-4 py-3 text-left ring-1 transition-colors";
  if (!onClick) return <div className={`${base} bg-white/10 ring-white/10`}>{conteudo}</div>;
  return (
    <button
      onClick={onClick}
      title={ativo ? "Mostrar todas" : `Filtrar a lista: ${rotulo.toLowerCase()}`}
      className={`${base} ${ativo ? "bg-white/25 ring-white/50" : "bg-white/10 ring-white/10 hover:bg-white/15"}`}
    >
      {conteudo}
    </button>
  );
}
