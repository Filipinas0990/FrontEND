import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Key, Database, Bell, User } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/configuracoes")({
  component: ConfigPage,
  head: () => ({ meta: [{ title: "Configurações — PharmaFlow" }] }),
});

function ConfigPage() {
  const [showKey, setShowKey] = useState(false);

  return (
    <AppShell
      title="Configurações"
      headerRight={
        <button className="px-4 py-2 text-sm font-medium bg-brand text-white rounded-md hover:opacity-90">
          Salvar Alterações
        </button>
      }
    >
      <Section icon={User} title="Conta da Agência" desc="Informações públicas da sua agência.">
        <Field label="Nome da Agência" defaultValue="Agência Alpha" />
        <Field label="E-mail Principal" defaultValue="contato@agenciaalpha.com.br" />
        <Field label="Fuso Horário" defaultValue="America/Sao_Paulo" />
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
    </AppShell>
  );
}

function Section({ icon: Icon, title, desc, children }: { icon: typeof Key; title: string; desc: string; children: React.ReactNode }) {
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

function Field({ label, defaultValue, type = "text" }: { label: string; defaultValue: string; type?: string }) {
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

function Toggle({ label, defaultChecked }: { label: string; defaultChecked: boolean }) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-zinc-700">{label}</span>
      <button
        onClick={() => setOn(!on)}
        className={`relative w-10 h-6 rounded-full transition-colors ${on ? "bg-brand" : "bg-zinc-200"}`}
      >
        <div className={`absolute top-0.5 size-5 bg-white rounded-full shadow transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}
