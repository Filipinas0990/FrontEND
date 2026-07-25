import { Link, useLocation } from "@tanstack/react-router";
import { Building2, UserPlus } from "lucide-react";
import { getUser } from "@/lib/auth";

/**
 * Abas do módulo Farmácias. "Em Entrada" deixou de ser item de sidebar e virou
 * uma aba aqui (só para admin). Renderize no topo das telas /farmacias e
 * /farmacias/entrada.
 */
export function FarmaciasTabs() {
  const { pathname } = useLocation();
  const admin = getUser()?.is_admin === true;

  const tabs = [
    { label: "Farmácias", to: "/farmacias", icon: Building2, ativo: pathname === "/farmacias" },
    ...(admin
      ? [{ label: "Em Entrada", to: "/farmacias/entrada", icon: UserPlus, ativo: pathname.startsWith("/farmacias/entrada") }]
      : []),
  ];

  // Sem a aba de entrada não há o que alternar
  if (tabs.length < 2) return null;

  return (
    <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl self-start">
      {tabs.map((t) => (
        <Link
          key={t.to}
          to={t.to}
          className={[
            "flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap",
            t.ativo
              ? "bg-white text-zinc-900 shadow-sm ring-1 ring-black/5"
              : "text-zinc-500 hover:text-zinc-800",
          ].join(" ")}
        >
          <t.icon className="size-4" /> {t.label}
        </Link>
      ))}
    </div>
  );
}
