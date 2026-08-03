import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * A tela de ofertas dos clientes virou uma aba dentro de /grupos, que centraliza
 * todo o disparo em grupos. Esta rota fica só para não quebrar links antigos.
 */
export const Route = createFileRoute("/ofertas-clientes")({
  beforeLoad: () => {
    throw redirect({ to: "/grupos", search: { aba: "clientes" }, replace: true });
  },
});
