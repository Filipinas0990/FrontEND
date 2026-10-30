import { useId } from "react";
import { Switch } from "@/components/ui/switch";
import { ehFimDeSemana, nomeDoDia } from "@/lib/diaUtil";

interface Props {
  /** true = o gestor liberou sábado e domingo para ESTA campanha. */
  permitido: boolean;
  onChange: (permitido: boolean) => void;
  /** Data/hora do primeiro envio ("YYYY-MM-DDTHH:MM") — para avisar o dia escolhido. */
  quandoISO: string;
}

/**
 * Interruptor "Permitir disparos no fim de semana" do agendamento.
 *
 * A regra do dono (11/09/2026) continua sendo o padrão: DESLIGADO, nada sai em
 * sábado ou domingo. Ligando, só esta campanha passa a sair em qualquer dia —
 * o valor vai para a API como `permitir_fim_de_semana` e vale apenas para
 * disparos novos (a campanha já criada não muda).
 *
 * Mora num componente só porque o agendamento existe em duas telas (a aba
 * "Novo disparo" e o wizard "Montar"), e as duas precisam se comportar igual.
 */
export function SeletorFimDeSemana({ permitido, onChange, quandoISO }: Props) {
  const id = useId();
  const caiNoFimDeSemana = ehFimDeSemana(quandoISO);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-2.5">
        <Switch
          id={id}
          checked={permitido}
          onCheckedChange={onChange}
          className="mt-0.5 data-[state=checked]:bg-brand"
        />
        <label htmlFor={id} className="min-w-0 cursor-pointer select-none">
          <span className="block text-sm font-medium text-zinc-700">
            Permitir disparos no fim de semana?
          </span>
          <span className="block text-xs text-zinc-500 mt-0.5">
            {permitido
              ? "Ligado: esta campanha também sai aos sábados e domingos."
              : "Desligado: nada sai em sábado ou domingo — as repetições passam para a segunda-feira."}
          </span>
        </label>
      </div>

      {caiNoFimDeSemana && !permitido && (
        <p className="text-[11px] text-red-600">
          Esse dia é {nomeDoDia(quandoISO)} — disparos só saem em dia útil. Escolha outra data ou
          ligue &quot;Permitir disparos no fim de semana&quot;.
        </p>
      )}

      {caiNoFimDeSemana && permitido && (
        <p className="text-[11px] text-amber-600">
          Esse dia é {nomeDoDia(quandoISO)} — o disparo vai sair, porque o fim de semana está
          liberado nesta campanha.
        </p>
      )}
    </div>
  );
}
