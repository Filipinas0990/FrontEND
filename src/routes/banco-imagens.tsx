import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout de /banco-imagens: a grade (index) e o editor (/banco-imagens/editar/$id).
export const Route = createFileRoute("/banco-imagens")({
  component: () => <Outlet />,
});
