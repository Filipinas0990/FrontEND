import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Search, Check, Store, Loader2, AlertCircle, CheckCircle2, Send, ArrowLeft, ImageIcon,
} from "lucide-react";
import {
  getOfertaPublica, enviarOfertaPublica, ofertaImagemUrl,
  type OfertaPublica,
} from "@/lib/api";

export const Route = createFileRoute("/ofertas/$token")({
  component: OfertasPublicaPage,
  head: () => ({ meta: [{ title: "Ofertas da semana" }] }),
});

/**
 * Página PÚBLICA — o dono da farmácia abre pelo link que o gestor mandou,
 * sem login. Não usa AppShell (é lá que mora a guarda de sessão).
 * Pensada para celular: o dono abre direto do WhatsApp.
 */
function OfertasPublicaPage() {
  const { token } = Route.useParams();

  const [dados, setDados] = useState<OfertaPublica | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [farmaciaId, setFarmaciaId] = useState<number | null>(null);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [busca, setBusca] = useState("");
  const [produtosLivres, setProdutosLivres] = useState("");
  const [enviadoPor, setEnviadoPor] = useState("");
  const [observacao, setObservacao] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  useEffect(() => {
    getOfertaPublica(token)
      .then((d) => {
        setDados(d);
        if (d.farmacias.length === 1) setFarmaciaId(d.farmacias[0].id);
      })
      .catch(() => setErro("Este link não é válido ou expirou. Peça um link novo ao seu gestor."))
      .finally(() => setCarregando(false));
  }, [token]);

  const produtosFiltrados = useMemo(
    () => (dados?.produtos ?? []).filter((p) =>
      p.nome.toLowerCase().includes(busca.toLowerCase())),
    [dados, busca],
  );

  const farmacia = dados?.farmacias.find((f) => f.id === farmaciaId) ?? null;

  function alternar(id: number) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }

  async function enviar() {
    if (!farmaciaId) return;
    setEnviando(true);
    setErroEnvio(null);
    try {
      await enviarOfertaPublica(token, {
        farmacia_id: farmaciaId,
        produtos: [...selecionados],
        produtos_livres: produtosLivres.trim() || null,
        observacao: observacao.trim() || null,
        enviado_por: enviadoPor.trim() || null,
      });
      setEnviado(true);
    } catch (err) {
      setErroEnvio(err instanceof Error ? err.message : "Não foi possível enviar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  // ── Estados de tela cheia ───────────────────────────────────────────────────

  if (carregando) {
    return (
      <Centro>
        <Loader2 className="size-6 animate-spin text-zinc-400" />
        <p className="text-sm text-zinc-500">Carregando...</p>
      </Centro>
    );
  }

  if (erro) {
    return (
      <Centro>
        <AlertCircle className="size-10 text-amber-500" />
        <p className="text-base font-semibold text-zinc-800">Link indisponível</p>
        <p className="text-sm text-zinc-500 max-w-xs">{erro}</p>
      </Centro>
    );
  }

  if (enviado) {
    return (
      <Centro>
        <CheckCircle2 className="size-12 text-emerald-500" />
        <p className="text-lg font-bold text-zinc-900">Recebemos sua lista!</p>
        <p className="text-sm text-zinc-500 max-w-xs">
          Seu gestor vai montar as artes e postar no grupo de ofertas da{" "}
          <strong>{farmacia?.nome}</strong>.
        </p>
      </Centro>
    );
  }

  const totalEscolhido = selecionados.size + (produtosLivres.trim() ? 1 : 0);

  // ── Passo 1: escolher a farmácia ────────────────────────────────────────────

  if (!farmaciaId) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <Cabecalho gestor={dados?.gestor.nome} />
        <div className="max-w-lg mx-auto px-4 py-6">
          <h2 className="text-lg font-bold text-zinc-900">Qual é a sua farmácia?</h2>
          <p className="text-sm text-zinc-500 mt-1 mb-4">
            Toque no nome da sua farmácia para começar.
          </p>
          <div className="grid gap-2">
            {(dados?.farmacias ?? []).map((f) => (
              <button
                key={f.id}
                onClick={() => setFarmaciaId(f.id)}
                className="flex items-center gap-3 p-4 rounded-xl border border-zinc-200 bg-white text-left hover:border-brand hover:bg-brand/5 transition"
              >
                <Store className="size-5 text-zinc-400 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-zinc-900 truncate">{f.nome}</p>
                  {f.cidade && <p className="text-xs text-zinc-500">{f.cidade}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Passo 2: escolher os produtos ───────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-50 pb-28">
      <Cabecalho gestor={dados?.gestor.nome} />

      <div className="max-w-lg mx-auto px-4 py-5">
        <button
          onClick={() => setFarmaciaId(null)}
          className="text-sm text-zinc-500 hover:text-zinc-800 flex items-center gap-1.5 mb-3 transition"
        >
          <ArrowLeft className="size-4" /> Trocar farmácia
        </button>

        <div className="bg-white rounded-xl border border-zinc-200 p-3 mb-4 flex items-center gap-2">
          <Store className="size-4 text-brand shrink-0" />
          <p className="text-sm font-medium text-zinc-900 truncate">{farmacia?.nome}</p>
        </div>

        <h2 className="text-lg font-bold text-zinc-900">O que você quer anunciar?</h2>
        <p className="text-sm text-zinc-500 mt-1 mb-3">
          Marque os produtos que entram na oferta. Não precisa informar preço —
          seu gestor cuida disso.
        </p>

        <div className="relative mb-3">
          <Search className="size-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto..."
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-zinc-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {produtosFiltrados.map((p) => {
            const marcado = selecionados.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => alternar(p.id)}
                className={`relative rounded-xl border bg-white p-2 text-left transition ${
                  marcado ? "border-brand ring-2 ring-brand/20" : "border-zinc-200"
                }`}
              >
                <div className="aspect-square rounded-lg bg-zinc-50 grid place-items-center overflow-hidden mb-2">
                  <img
                    src={ofertaImagemUrl(token, p.id)}
                    alt={p.nome}
                    loading="lazy"
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => { (e.currentTarget.style.display = "none"); }}
                  />
                </div>
                <p className="text-xs text-zinc-800 leading-snug line-clamp-2">{p.nome}</p>
                {marcado && (
                  <span className="absolute top-2 right-2 size-6 rounded-full bg-brand text-white grid place-items-center shadow">
                    <Check className="size-3.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {produtosFiltrados.length === 0 && (
          <div className="text-center py-8 text-sm text-zinc-400 flex flex-col items-center gap-2">
            <ImageIcon className="size-6 text-zinc-300" />
            Nenhum produto encontrado com esse nome.
          </div>
        )}

        {/* Itens fora do catálogo */}
        <div className="mt-6 flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700">
            Quer anunciar algo que não está na lista?
          </label>
          <textarea
            value={produtosLivres}
            onChange={(e) => setProdutosLivres(e.target.value)}
            rows={3}
            placeholder={"Escreva um produto por linha.\nEx.: Vitamina C 1g com 10 comprimidos"}
            className="w-full p-3 rounded-lg border border-zinc-200 text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <p className="text-xs text-zinc-400">
            Esses não têm foto pronta — seu gestor vai avaliar.
          </p>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">Seu nome (opcional)</label>
            <input
              value={enviadoPor}
              onChange={(e) => setEnviadoPor(e.target.value)}
              placeholder="Quem está enviando"
              className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700">Observação (opcional)</label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              placeholder="Algum recado para o seu gestor?"
              className="w-full p-3 rounded-lg border border-zinc-200 text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
        </div>

        {erroEnvio && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2">
            <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{erroEnvio}</p>
          </div>
        )}
      </div>

      {/* Barra fixa de envio */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-zinc-200 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <p className="text-sm text-zinc-500 flex-1">
            {totalEscolhido === 0
              ? "Nenhum item escolhido"
              : <><strong className="text-zinc-900">{selecionados.size}</strong> produto(s)
                  {produtosLivres.trim() ? " + itens escritos" : ""}</>}
          </p>
          <button
            onClick={enviar}
            disabled={enviando || totalEscolhido === 0}
            className="bg-brand hover:bg-brand/90 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg flex items-center gap-2 transition shadow-sm"
          >
            {enviando
              ? <><Loader2 className="size-4 animate-spin" /> Enviando...</>
              : <><Send className="size-4" /> Enviar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function Cabecalho({ gestor }: { gestor?: string }) {
  return (
    <div className="bg-white border-b border-zinc-200">
      <div className="max-w-lg mx-auto px-4 py-4">
        <p className="text-xs font-semibold text-brand uppercase tracking-wide">
          Ofertas da semana
        </p>
        <p className="text-sm text-zinc-500 mt-0.5">
          {gestor ? <>Enviado por <strong className="text-zinc-700">{gestor}</strong></> : " "}
        </p>
      </div>
    </div>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 grid place-items-center px-6">
      <div className="flex flex-col items-center gap-3 text-center">{children}</div>
    </div>
  );
}
