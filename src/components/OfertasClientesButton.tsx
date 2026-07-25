import { Inbox } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getOfertasPendentes } from "@/lib/api";

/**
 * Botão do cabeçalho de Criativos e Campanhas. Mostra quantos clientes têm
 * lista pendente e leva para a tela cheia de Ofertas dos Clientes.
 */
export function OfertasClientesButton() {
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["ofertas-pendentes"],
    queryFn: getOfertasPendentes,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const total = data?.total ?? 0;

  return (
    <button
      onClick={() => navigate({ to: "/ofertas-clientes" })}
      className="relative border border-zinc-200 bg-white hover:border-brand hover:text-brand text-zinc-700 font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 transition shadow-sm"
    >
      <Inbox className="size-4" />
      Ofertas dos Clientes
      {total > 0 && (
        <span className="min-w-5 h-5 px-1.5 rounded-full bg-amber-400 text-brand text-[11px] font-bold grid place-items-center">
          {total}
        </span>
      )}
    </button>
  );
}
