import { getContasAnuncio } from "@/lib/api";

/**
 * A query das contas de anúncio (etapa 1 do wizard de campanha), num lugar só.
 *
 * Fica fora da rota porque quem ABRE o wizard não é quem o desenha: os botões
 * "Nova Campanha" pré-carregam esta mesma query no hover, e chave diferente
 * entre os dois lados faria o pré-carregamento não valer de nada.
 */
export const CHAVE_CONTAS = ["campanha-contas"] as const;

/**
 * `staleTime` alto de propósito: quem entra no wizard, volta uma etapa e entra
 * de novo estava refazendo a chamada inteira a cada vez. A lista muda quando
 * entra cliente novo no BM — semanas — e o botão "Atualizar" fica do lado dela
 * para quem acabou de cadastrar uma conta.
 */
export function opcoesContas() {
  return {
    queryKey: CHAVE_CONTAS,
    queryFn: () => getContasAnuncio(),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  };
}
