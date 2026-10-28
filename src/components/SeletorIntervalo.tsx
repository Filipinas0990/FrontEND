import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getPeriodoDisponivel } from "@/lib/api";
import {
  usePeriod, intervaloDoMes, mesDoIntervalo, nomeDoMes, rotuloIntervalo,
} from "@/contexts/PeriodContext";

/** Mesmo limite do backend (src/farmacias/periodo.ts). */
const MAX_DIAS = 93;

/** Meses "AAAA-MM" do mais novo ao mais antigo, entre as duas datas. */
function mesesEntre(primeiro: string, ultimo: string): string[] {
  const meses: string[] = [];
  let [ano, mes] = ultimo.slice(0, 7).split("-").map(Number);
  const fim = primeiro.slice(0, 7);
  for (;;) {
    const atual = `${ano}-${String(mes).padStart(2, "0")}`;
    if (atual < fim) break;
    meses.push(atual);
    if (--mes === 0) { mes = 12; ano--; }
  }
  return meses;
}

const diasEntre = (inicio: string, fim: string) =>
  Math.round((Date.parse(fim) - Date.parse(inicio)) / 86_400_000) + 1;

/**
 * Botão "Mês / período" ao lado dos atalhos 7/15/30: escolhe um mês fechado
 * ou um de/até. Só oferece dias que já têm coleta dia a dia gravada.
 */
export function SeletorIntervalo({ escuro = false }: { escuro?: boolean }) {
  const { intervalo, setIntervalo } = usePeriod();
  const [aberto, setAberto] = useState(false);
  const [de, setDe] = useState(intervalo?.inicio ?? "");
  const [ate, setAte] = useState(intervalo?.fim ?? "");

  const { data: disponivel } = useQuery({
    queryKey: ["periodo-disponivel"],
    queryFn: getPeriodoDisponivel,
    staleTime: 10 * 60_000,
  });
  const primeiro = disponivel?.primeiro_dia ?? null;
  const ultimo = disponivel?.ultimo_dia ?? null;
  const meses = primeiro && ultimo ? mesesEntre(primeiro, ultimo) : [];
  const mesAtivo = intervalo ? mesDoIntervalo(intervalo) : null;

  const erroDeAte = !de || !ate ? null
    : de > ate ? "A data inicial é depois da final."
    : diasEntre(de, ate) > MAX_DIAS ? `Escolha até ${MAX_DIAS} dias.`
    : null;

  function escolher(inicio: string, fim: string) {
    setIntervalo({ inicio, fim });
    setAberto(false);
  }

  const classeBotao = escuro
    ? intervalo ? "bg-white text-brand" : "bg-white/15 text-white/85 hover:text-white"
    : intervalo ? "border-2 border-zinc-900 bg-zinc-900/5 text-zinc-900 font-semibold" : "border-2 border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700";

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ${classeBotao}`}
        >
          <CalendarRange className="size-4" />
          <span className="capitalize">{intervalo ? rotuloIntervalo(intervalo) : "Mês / período"}</span>
          <ChevronDown className="size-3.5 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        {meses.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Ainda não há coleta dia a dia gravada. Depois da carga dos últimos 90 dias os meses aparecem aqui.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Mês fechado</p>
              <div className="grid grid-cols-2 gap-2">
                {meses.map((m) => {
                  const { inicio, fim } = intervaloDoMes(m);
                  const parcial = (primeiro && inicio < primeiro) || (ultimo && fim > ultimo);
                  return (
                    <button
                      key={m}
                      onClick={() => escolher(inicio, fim)}
                      title={parcial ? "Mês com coleta só em parte dos dias" : undefined}
                      className={`rounded-lg border px-2 py-1.5 text-sm capitalize transition-colors ${
                        mesAtivo === m ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 hover:border-zinc-400"
                      }`}
                    >
                      {nomeDoMes(m)}{parcial ? " *" : ""}
                    </button>
                  );
                })}
              </div>
              {meses.some((m) => {
                const { inicio, fim } = intervaloDoMes(m);
                return inicio < primeiro! || fim > ultimo!;
              }) && <p className="text-[11px] text-zinc-400">* mês com coleta só em parte dos dias</p>}
            </div>

            <div className="space-y-2 border-t border-zinc-100 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">De / até</p>
              <div className="flex items-center gap-2">
                <input
                  type="date" value={de} min={primeiro ?? undefined} max={ultimo ?? undefined}
                  onChange={(e) => setDe(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 px-2 py-1.5 text-sm"
                />
                <span className="text-zinc-400">–</span>
                <input
                  type="date" value={ate} min={primeiro ?? undefined} max={ultimo ?? undefined}
                  onChange={(e) => setAte(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 px-2 py-1.5 text-sm"
                />
              </div>
              {erroDeAte && <p className="text-xs text-red-500">{erroDeAte}</p>}
              <button
                disabled={!de || !ate || !!erroDeAte}
                onClick={() => escolher(de, ate)}
                className="w-full rounded-md bg-zinc-900 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                Aplicar
              </button>
            </div>
            <p className="text-[11px] text-zinc-400">
              Coleta disponível de {primeiro?.split("-").reverse().join("/")} a {ultimo?.split("-").reverse().join("/")}.
            </p>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
