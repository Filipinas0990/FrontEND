import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { login } from "@/lib/api";
import { saveAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Entrar — PharmaFlow" }] }),
});

const subtitulos = [
  "Prometemos não vender seus dados... só os do seu concorrente 🤫",
  "Se errar a senha 3x, a gente liga pra sua mãe.",
  "Quanto mais fundo, mais ROAS. Confia.",
  "Atenção: efeitos colaterais podem incluir leads em excesso.",
  "100% farmacêutico. 0% placebo.",
];

function LoginPage() {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [sub] = useState(() => subtitulos[Math.floor(Math.random() * subtitulos.length)]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(email, senha);
      saveAuth(data);
      navigate({ to: "/" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao fazer login";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-neutral-50 to-sky-50 p-6 font-sans relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {["💊", "🧪", "💉", "🩺", "💊", "🧬", "💊"].map((e, i) => (
          <div
            key={i}
            className="absolute text-4xl opacity-20 animate-bounce"
            style={{
              left: `${(i * 13 + 5) % 95}%`,
              top: `${(i * 23 + 10) % 80}%`,
              animationDelay: `${i * 0.3}s`,
              animationDuration: `${3 + (i % 3)}s`,
            }}
          >
            {e}
          </div>
        ))}
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl ring-1 ring-black/5 p-8 relative z-10">
        <div className="flex justify-center mb-6">
          <div className="size-14 bg-brand rounded-2xl grid place-items-center text-white text-2xl rotate-3 hover:rotate-0 transition-transform">
            💊
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-zinc-900 leading-tight text-balance">
          Coloque a senha e o email para conhecer o fundo
        </h1>
        <p className="text-sm text-center text-zinc-500 mt-3 italic flex items-center justify-center gap-1.5">
          <Sparkles className="size-3.5 text-brand" />
          {sub}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full px-4 py-2.5 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition"
              placeholder="seuemail@agencia.com"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Senha</label>
            <div className="relative mt-1.5">
              <input
                type={show ? "text" : "password"}
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full px-4 py-2.5 pr-10 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-brand text-white rounded-lg text-sm font-semibold hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? "Entrando..." : "Mergulhar no fundo 🤿"}
          </button>

          <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-2">
            <a href="/setup" className="hover:text-brand">Primeiro acesso?</a>
            <span>v2.0 — feito com 💊</span>
          </div>
        </form>
      </div>
    </div>
  );
}
