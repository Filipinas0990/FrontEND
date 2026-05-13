import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { criarSuperAdmin } from "@/lib/api";

export const Route = createFileRoute("/setup")({
  component: SetupPage,
  head: () => ({ meta: [{ title: "Setup Inicial — PharmaFlow" }] }),
});

function SetupPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    email: "",
    senha: "",
    admin_secret: "",
  });

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await criarSuperAdmin(form);
      toast.success("Super admin criado! Faça login para continuar.");
      navigate({ to: "/login" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao criar admin";
      if (msg.includes("ja existe") || msg.toLowerCase().includes("409")) {
        toast.error("Admin já existe. Use o login normal.");
        navigate({ to: "/login" });
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-neutral-50 to-sky-50 p-6 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl ring-1 ring-black/5 p-8">
        <div className="flex justify-center mb-6">
          <div className="size-14 bg-brand rounded-2xl grid place-items-center text-white">
            <ShieldCheck className="size-7" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-zinc-900">
          Setup Inicial
        </h1>
        <p className="text-sm text-center text-zinc-500 mt-2">
          Crie o Super Admin da plataforma. Esta ação só pode ser feita uma vez.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <Field label="Nome completo">
            <input
              type="text"
              required
              value={form.nome}
              onChange={set("nome")}
              className="input"
              placeholder="João Silva"
            />
          </Field>

          <Field label="E-mail">
            <input
              type="email"
              required
              value={form.email}
              onChange={set("email")}
              className="input"
              placeholder="joao@agencia.com"
            />
          </Field>

          <Field label="Senha">
            <div className="relative">
              <input
                type={showSenha ? "text" : "password"}
                required
                minLength={8}
                value={form.senha}
                onChange={set("senha")}
                className="input pr-10"
                placeholder="Mínimo 8 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowSenha(!showSenha)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
              >
                {showSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>

          <Field label="Admin Secret">
            <div className="relative">
              <input
                type={showSecret ? "text" : "password"}
                required
                value={form.admin_secret}
                onChange={set("admin_secret")}
                className="input pr-10"
                placeholder="Segredo definido no servidor"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
              >
                {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-brand text-white rounded-lg text-sm font-semibold hover:opacity-90 transition disabled:opacity-60"
          >
            {loading ? "Criando admin..." : "Criar Super Admin"}
          </button>

          <p className="text-center text-xs text-zinc-500">
            Já tem conta?{" "}
            <a href="/login" className="text-brand hover:underline">
              Fazer login
            </a>
          </p>
        </form>
      </div>

      <style>{`
        .input {
          width: 100%;
          padding: 0.625rem 1rem;
          font-size: 0.875rem;
          background: rgb(250 250 250);
          border: 1px solid rgb(228 228 231);
          border-radius: 0.5rem;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .input:focus {
          border-color: var(--brand);
          box-shadow: 0 0 0 3px color-mix(in oklch, var(--brand) 20%, transparent);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
