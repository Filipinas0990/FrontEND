import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import {
  BarChart2,
  CalendarDays,
  Target,
  TrendingUp,
  Users,
  Zap,
  Star,
} from "lucide-react";

export const Route = createFileRoute("/novidades")({
  component: NovidadesPage,
  head: () => ({ meta: [{ title: "Início — GrupoSymbol" }] }),
});

const FEATURES = [
  {
    icon: BarChart2,
    titulo: "Performance em tempo real",
    desc: "Cliques, conversões e variações de cada farmácia sempre atualizados, sem precisar abrir planilha.",
  },
  {
    icon: Target,
    titulo: "Metas por canal",
    desc: "Defina metas de leads para Google e Meta por farmácia e acompanhe o progresso semana a semana.",
  },
  {
    icon: CalendarDays,
    titulo: "Gestão de reuniões",
    desc: "Agende, confirme e registre observações das reuniões com cada cliente direto no sistema.",
  },
  {
    icon: TrendingUp,
    titulo: "Comparativo de períodos",
    desc: "Compare 7, 15 e 30 dias lado a lado para enxergar tendências e tomar decisões com dados.",
  },
  {
    icon: Users,
    titulo: "Ranking de gestores",
    desc: "Veja quem está batendo metas e reconheça os gestores que mais evoluem suas farmácias.",
  },
  {
    icon: Zap,
    titulo: "Automação com 1 clique",
    desc: "Rode a coleta de dados de todas as farmácias com um clique e tenha tudo atualizado em minutos.",
  },
];

function NovidadesPage() {
  return (
    <AppShell title="Início">
      {/* ── Hero ── */}
      <section className="relative bg-brand rounded-2xl overflow-hidden px-10 py-14 text-white">
        {/* Decoração de fundo */}
        <div className="absolute inset-0 opacity-10 pointer-events-none select-none">
          <div className="absolute -top-16 -right-16 size-72 rounded-full bg-white" />
          <div className="absolute -bottom-20 -left-10 size-56 rounded-full bg-white" />
        </div>

        <div className="relative max-w-2xl space-y-5">
          <div className="inline-flex items-center gap-2 bg-white/15 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider">
            <Star className="size-3.5 fill-white" />
            GrupoSymbol — Sistema de Gestão
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
            Dados claros.<br />Decisões precisas.<br />
            <span className="opacity-80">Farmácias que crescem.</span>
          </h1>

          <p className="text-base text-white/80 leading-relaxed max-w-xl">
            Desenvolvido por <span className="font-semibold text-white">Filipe do Marketing</span> para
            transformar a gestão da sua rede farmacêutica. Acompanhe em um só lugar o desempenho real de
            cada farmácia — cliques, conversões, metas e reuniões — para que cada gestor saiba
            exatamente onde agir e como evoluir.
          </p>
        </div>
      </section>

      {/* ── O que o sistema faz ── */}
      <section className="space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-zinc-800">O que você encontra aqui</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Tudo que um gestor moderno precisa, em um só painel.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.titulo}
              className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-5 space-y-3 hover:shadow-md transition-shadow"
            >
              <div className="size-9 rounded-xl bg-brand/8 grid place-items-center">
                <f.icon className="size-4 text-brand" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-900">{f.titulo}</p>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Criado por ── */}
      <section className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm p-6 flex items-center gap-5">
        <div className="size-14 rounded-full bg-brand grid place-items-center text-white text-lg font-bold shrink-0">
          F
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900">Filipe do Marketing</p>
          <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed max-w-xl">
            Este sistema foi construído com o objetivo de eliminar o ruído e dar clareza total
            para quem gerencia múltiplas farmácias. Menos tempo em planilhas, mais tempo
            tomando as decisões certas.
          </p>
        </div>
      </section>
    </AppShell>
  );
}
