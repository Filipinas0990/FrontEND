import type { Paleta } from "@/components/CriativoCard";

/**
 * Interruptor da cor da arte.
 *
 * Duas opções lado a lado em vez de um switch: com switch, qual cor está
 * ligada depende de lembrar para que lado é o "sim". Aqui a cor escolhida está
 * escrita, e a bolinha mostra o tom que vai sair na arte.
 *
 * Vive fora das telas porque o /grupos e o wizard da carteira ("Montar") geram
 * a mesma arte — a farmácia de marca vermelha tem de achar a cor nos dois.
 */
const CORES_PALETA: { valor: Paleta; nome: string; amostra: string }[] = [
  { valor: "azul",     nome: "Azul",     amostra: "linear-gradient(180deg,#3f74dd,#0a2c78)" },
  { valor: "vermelho", nome: "Vermelho", amostra: "linear-gradient(180deg,#f2353c,#cf1a22)" },
  { valor: "laranja",  nome: "Laranja",  amostra: "linear-gradient(180deg,#ff9d2e,#e4600a)" },
];

/**
 * `travada` é a cor que o modelo escolhido impõe (campanha de data). Os botões
 * continuam na tela, apagados e mostrando qual cor está valendo: sumir com o
 * seletor faria parecer que a escolha de cor deixou de existir.
 */
export function SeletorPaleta({ paleta, onEscolher, travada }: {
  paleta: Paleta;
  onEscolher: (p: Paleta) => void;
  travada?: Paleta;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">
        Cor da arte
      </span>
      <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100" role="group" aria-label="Cor da arte">
        {CORES_PALETA.map((c) => {
          const ativa = (travada ?? paleta) === c.valor;
          return (
            <button
              key={c.valor}
              type="button"
              onClick={() => onEscolher(c.valor)}
              aria-pressed={ativa}
              disabled={Boolean(travada)}
              title={travada ? "Este modelo tem cor própria." : undefined}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                ativa ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              } ${travada ? "cursor-not-allowed opacity-60 hover:text-zinc-500" : ""}`}
            >
              <span
                className="size-3.5 rounded-full ring-1 ring-black/10"
                style={{ background: c.amostra }}
              />
              {c.nome}
            </button>
          );
        })}
      </div>
    </div>
  );
}
