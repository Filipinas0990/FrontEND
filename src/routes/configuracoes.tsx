import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Key, Database, Bell, User, MessageSquareMore, Images, UploadCloud } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { WhatsAppSection } from "@/components/WhatsAppSection";
import { BancoImagensModal } from "@/components/BancoImagensModal";
import { getCatalogoStatus } from "@/lib/api";

export const Route = createFileRoute("/configuracoes")({
  component: ConfigPage,
  head: () => ({ meta: [{ title: "Configurações — GrupoSymbol" }] }),
});

function ConfigPage() {
  const [showKey, setShowKey] = useState(false);
  const [showBancoImagens, setShowBancoImagens] = useState(false);

  const { data: catalogo } = useQuery({
    queryKey: ["catalogo-status"],
    queryFn: getCatalogoStatus,
  });

  return (
    <AppShell title="Configurações">
      <Section icon={User} title="Conta da Agência" desc="Informações públicas da sua agência.">
        <Field label="Nome da Agência" defaultValue="Agência Alpha" />
        <Field label="E-mail Principal" defaultValue="contato@agenciaalpha.com.br" />
        <Field label="Fuso Horário" defaultValue="America/Sao_Paulo" />
      </Section>

      <Section
        icon={Images}
        title="Banco de Imagens"
        desc="Fotos dos produtos usadas para gerar os criativos automaticamente."
      >
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-600">
            {catalogo
              ? <><span className="font-semibold text-zinc-900">{catalogo.total}</span> imagem(ns) no banco</>
              : "Carregando..."}
          </p>
          <button
            onClick={() => setShowBancoImagens(true)}
            className="bg-brand hover:bg-brand/90 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition text-sm"
          >
            <UploadCloud className="size-4" /> Subir imagens
          </button>
        </div>
      </Section>

      <Section icon={Key} title="Integrações de API" desc="Tokens utilizados pelo script Python para coletar dados.">
        <Field label="Meta Ads Access Token" defaultValue="EAAJk7Z...••••••••••••3Xq2" type={showKey ? "text" : "password"} />
        <Field label="Google Ads Refresh Token" defaultValue="1//0g...••••••••••••a7Yz" type={showKey ? "text" : "password"} />
        <label className="flex items-center gap-2 text-xs text-zinc-600">
          <input type="checkbox" checked={showKey} onChange={(e) => setShowKey(e.target.checked)} />
          Mostrar tokens
        </label>
      </Section>

      <Section icon={Database} title="Power BI" desc="Workspace e dataset de destino dos relatórios semanais.">
        <Field label="Workspace ID" defaultValue="b3f9c2e1-7d4a-4b8e-9f12-a5c6d7e8f9a0" />
        <Field label="Dataset" defaultValue="pharmaflow_weekly_v4" />
        <Field label="Endpoint Push" defaultValue="https://api.powerbi.com/beta/..." />
      </Section>

      <Section icon={Bell} title="Notificações" desc="Receba avisos quando algo precisar de atenção.">
        <Toggle label="E-mail quando uma execução falhar" defaultChecked />
        <Toggle label="WhatsApp quando ROAS cair abaixo de 2x" defaultChecked />
        <Toggle label="Resumo semanal por e-mail" defaultChecked={false} />
      </Section>

      <Section
        icon={MessageSquareMore}
        title="WhatsApp"
        desc="Notificações automáticas de reunião enviadas às farmácias."
      >
        <WhatsAppSection />
      </Section>

      {showBancoImagens && <BancoImagensModal onClose={() => setShowBancoImagens(false)} />}
    </AppShell>
  );
}

function Section({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: typeof Key;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl ring-1 ring-black/5 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-zinc-100 flex items-start gap-3">
        <div className="size-9 rounded-lg bg-brand/10 text-brand grid place-items-center">
          <Icon className="size-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
        </div>
      </div>
      <div className="p-6 space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  defaultValue,
  type = "text",
}: {
  label: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <div className="grid grid-cols-3 gap-4 items-center">
      <label className="text-xs font-medium text-zinc-700">{label}</label>
      <input
        type={type}
        defaultValue={defaultValue}
        className="col-span-2 px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
      />
    </div>
  );
}

function Toggle({
  label,
  defaultChecked,
}: {
  label: string;
  defaultChecked: boolean;
}) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-zinc-700">{label}</span>
      <button
        onClick={() => setOn(!on)}
        className={`relative w-10 h-6 rounded-full transition-colors ${on ? "bg-brand" : "bg-zinc-200"}`}
      >
        <div
          className={`absolute top-0.5 size-5 bg-white rounded-full shadow transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </button>
    </div>
  );
}
