import { useEffect, useMemo, useRef, useState } from "react";
import {
  X, ArrowRight, ArrowLeft, Check, Loader2, Search, Users, Store,
  QrCode, RefreshCw, Send, CalendarClock, ImageIcon, AlertCircle, CheckCircle2,
  Smartphone, Link2, Copy, Inbox, PencilLine, MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  conectarMeuWhatsapp, getMeuWhatsappStatus, getMeusGrupos, criarDisparo,
  getConexoesDisparo,
  getCarteiraOfertas, catalogoImagemUrl,
  type GrupoWhatsApp, type RepetirDisparo, type InstanciaStatus,
  type ClienteCarteira, type MidiaDisparo, type ConexaoDisparo,
} from "@/lib/api";
import { getUser } from "@/lib/auth";
import { exportarCriativoPng, comprimirParaEnvio } from "@/lib/exportarCriativo";
import { formatarMoeda } from "@/lib/moeda";
import type { CriativosConfig } from "@/components/CriativosModal";

export interface ProdutoDisparo {
  id: string;
  nome: string;
  preco: string;
  imagem?: string | null;
}

interface EnviarGrupoWizardProps {
  produtos: ProdutoDisparo[];
  /** Config vinda do fluxo de criativos. Ausente quando o disparo é aberto
   *  direto do cabeçalho (pelo botão de ofertas dos clientes). */
  criativosConfig?: CriativosConfig;
  /** Abre já com este cliente selecionado no passo 2. */
  clienteInicialId?: number;
  onClose: () => void;
}

/** Usado quando o gestor abre o disparo sem ter montado criativos na tela. */
const CONFIG_PADRAO: CriativosConfig = {
  layout: "azul",
  enquadramento: "4:5",
  localizacao: "",
  precos: {},
};

type Etapa = 1 | 2 | 3 | 4 | 5 | 6;

/** Produto candidato a virar criativo, venha do cliente ou da tela. */
interface ItemOferta {
  chave:   string;
  nome:    string;
  imagem?: string | null;
  preco:   string;
  /** true = digitado pelo dono, fora do catálogo (não tem foto pronta) */
  livre?:  boolean;
}

const TITULOS: Record<Etapa, { titulo: string; descricao: string }> = {
  1: { titulo: "Seu WhatsApp", descricao: "A conexão de onde saem os disparos." },
  2: { titulo: "Cliente",      descricao: "De qual farmácia é esta oferta." },
  3: { titulo: "Preços",       descricao: "O cliente não informa preço — você define." },
  4: { titulo: "Grupos",       descricao: "Escolha os grupos que vão receber." },
  5: { titulo: "Quando",       descricao: "Enviar agora ou agendar." },
  6: { titulo: "Revisão",      descricao: "Confira antes de disparar." },
};

const REPETICOES: { id: RepetirDisparo; nome: string }[] = [
  { id: "nunca",   nome: "Não repetir" },
  { id: "diario",  nome: "Todo dia" },
  { id: "semanal", nome: "Toda semana" },
  { id: "mensal",  nome: "Todo mês" },
];

export function EnviarGrupoWizard({
  produtos, criativosConfig: configProp, clienteInicialId, onClose,
}: EnviarGrupoWizardProps) {
  const criativosConfig = configProp ?? CONFIG_PADRAO;
  // Vindo de um cliente (botão "Montar"), começa já nos produtos dele.
  // A conexão do WhatsApp continua acessível pelo "Voltar" e é exigida no envio.
  const [etapa, setEtapa] = useState<Etapa>(clienteInicialId ? 2 : 1);

  // Etapa 1 — minha conexão
  const [statusConexao, setStatusConexao] = useState<InstanciaStatus>("close");
  const [numero, setNumero] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [carregandoStatus, setCarregandoStatus] = useState(true);
  const [erroStatus, setErroStatus] = useState<string | null>(null);
  const [conectando, setConectando] = useState(false);

  // Etapa 2 — carteira de clientes (quem respondeu e quem não)
  const [carteira, setCarteira] = useState<ClienteCarteira[]>([]);
  const [carregandoSolic, setCarregandoSolic] = useState(false);
  const [clienteSel, setClienteSel] = useState<ClienteCarteira | null>(null);
  const [cobrando, setCobrando] = useState<ClienteCarteira | null>(null);
  const [usarDaTela, setUsarDaTela] = useState(false);
  const [itens, setItens] = useState<ItemOferta[]>([]);
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set());

  // Etapa 3 — preços e mensagem
  const [precos, setPrecos] = useState<Record<string, string>>({});
  const [mensagem, setMensagem] = useState("");

  // Etapa 4 — grupos
  const [grupos, setGrupos] = useState<GrupoWhatsApp[]>([]);
  const [carregandoGrupos, setCarregandoGrupos] = useState(false);
  const [erroGrupos, setErroGrupos] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  // Etapa 5 — agendamento
  const [quando, setQuando] = useState<"agora" | "agendado">("agora");
  const [agendadoPara, setAgendadoPara] = useState("");
  const [repetir, setRepetir] = useState<RepetirDisparo>("nunca");

  // Etapa 6 — criativos gerados
  const [midias, setMidias] = useState<MidiaDisparo[]>([]);
  const [gerando, setGerando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Conexões disponíveis para o disparo (a do gestor + as globais) e a escolhida.
  const [conexoes, setConexoes] = useState<ConexaoDisparo[]>([]);
  const [conexaoSel, setConexaoSel] = useState<string | null>(null);
  const [carregandoConexoes, setCarregandoConexoes] = useState(true);

  const conectado = statusConexao === "open";

  // ── Conexão ─────────────────────────────────────────────────────────────────
  function carregarStatus() {
    setCarregandoStatus(true);
    setErroStatus(null);
    getMeuWhatsappStatus()
      .then((s) => {
        setStatusConexao(s.status);
        setNumero(s.numero);
        setQrCode(s.qr_code);
        if (!s.configurado) {
          setErroStatus(
            "A Evolution API ainda não está configurada no servidor "
            + "(EVOLUTION_API_URL / EVOLUTION_API_KEY no .env). "
            + "Sem ela não há como conectar o WhatsApp.",
          );
        }
      })
      .catch((err) => setErroStatus(err instanceof Error ? err.message : "Erro ao consultar sua conexão."))
      .finally(() => setCarregandoStatus(false));
  }

  /** Conexões que posso usar no disparo (a minha + as globais). */
  function carregarConexoes() {
    setCarregandoConexoes(true);
    getConexoesDisparo()
      .then((lista) => {
        setConexoes(lista);
        // Mantém a escolha atual se ainda existir; senão pega a 1ª conectada.
        setConexaoSel((atual) =>
          atual && lista.some((c) => c.instanceName === atual)
            ? atual
            : (lista.find((c) => c.status === "open")?.instanceName ?? null),
        );
      })
      .catch(() => { /* lista vazia mostra o convite pra conectar */ })
      .finally(() => setCarregandoConexoes(false));
  }

  useEffect(() => {
    carregarStatus();
    carregarConexoes();
  }, []);

  useEffect(() => {
    if (conectado || !qrCode) return;
    const timer = setInterval(async () => {
      try {
        const s = await getMeuWhatsappStatus();
        setStatusConexao(s.status);
        setQrCode(s.qr_code);
        if (s.status === "open") {
          setNumero(s.numero);
          setQrCode(null);
          toast.success("WhatsApp conectado!");
          carregarConexoes();
        }
      } catch { /* segue tentando */ }
    }, 4000);
    return () => clearInterval(timer);
  }, [conectado, qrCode]);

  // ── Carteira de clientes ────────────────────────────────────────────────────
  function carregarSolicitacoes() {
    setCarregandoSolic(true);
    getCarteiraOfertas()
      .then(setCarteira)
      .catch(() => toast.error("Não foi possível carregar seus clientes."))
      .finally(() => setCarregandoSolic(false));
  }

  // Aberto pelo painel de ofertas: já traz a carteira para preparar o cliente
  useEffect(() => {
    if (clienteInicialId) carregarSolicitacoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ...e assim que ela chega, abre o cliente escolhido (uma vez só)
  const clienteAbertoRef = useRef(false);
  useEffect(() => {
    if (!clienteInicialId || clienteAbertoRef.current || carteira.length === 0) return;
    const alvo = carteira.find((c) => c.farmacia_id === clienteInicialId);
    if (alvo?.respondeu) {
      clienteAbertoRef.current = true;
      abrirCliente(alvo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carteira, clienteInicialId]);

  /** Monta os itens a partir do pedido do cliente (catálogo + escritos à mão). */
  function abrirCliente(c: ClienteCarteira) {
    if (!c.solicitacao) return;
    setClienteSel(c);
    setUsarDaTela(false);

    const doCatalogo: ItemOferta[] = c.solicitacao.produtos.map((p) => ({
      chave:  `cat-${p.id}`,
      nome:   p.nome,
      imagem: catalogoImagemUrl(p.id),
      preco:  "",
    }));

    const livres: ItemOferta[] = (c.solicitacao.produtos_livres ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((nome, i) => ({ chave: `livre-${i}`, nome, imagem: null, preco: "", livre: true }));

    const lista = [...doCatalogo, ...livres];
    setItens(lista);
    // Por padrão já vêm todos marcados — o gestor desmarca o que não quiser
    setEscolhidos(new Set(lista.map((i) => i.chave)));
    setPrecos({});
    setMensagem(`🔥 *OFERTAS* — ${c.farmacia} 🔥`);
  }

  /** Texto que o gestor manda para cobrar a lista do dono. */
  function mensagemCobranca(c: ClienteCarteira): string {
    const nome = getUser()?.nome ?? "seu gestor";
    const tratamento = c.responsavel ? `Olá, ${c.responsavel}!` : "Olá!";
    return `${tratamento} Aqui é ${nome}.\n\n`
      + `Preciso da lista de produtos para as ofertas da ${c.farmacia}. `
      // Link exclusivo deste cliente: abre direto na farmácia dele.
      + `É só abrir o link, marcar o que você quer anunciar e enviar:\n\n${c.link ?? ""}\n\n`
      + `Assim que você mandar, eu monto as artes e posto no grupo. 👍`;
  }

  /** Só dígitos, com DDI do Brasil — formato que o wa.me espera. */
  function telefoneWa(tel: string): string {
    const d = tel.replace(/\D/g, "");
    return d.startsWith("55") ? d : `55${d}`;
  }

  function cobrar(c: ClienteCarteira) {
    const texto = mensagemCobranca(c);
    if (c.telefone?.trim()) {
      window.open(
        `https://wa.me/${telefoneWa(c.telefone)}?text=${encodeURIComponent(texto)}`,
        "_blank",
        "noopener",
      );
    } else {
      // Sem telefone salvo não dá para abrir a conversa — entrega o texto pronto
      setCobrando(c);
    }
  }

  /** Alternativa: usar os produtos que já estão na tela de anúncios. */
  function usarProdutosDaTela() {
    setClienteSel(null);
    setUsarDaTela(true);
    const lista: ItemOferta[] = produtos.map((p) => ({
      chave:  p.id,
      nome:   p.nome,
      imagem: p.imagem,
      preco:  criativosConfig.precos[p.id] ?? p.preco,
    }));
    setItens(lista);
    setEscolhidos(new Set(lista.map((i) => i.chave)));
    setPrecos(Object.fromEntries(lista.map((i) => [i.chave, i.preco])));
    setMensagem("🔥 *OFERTAS DA SEMANA* 🔥");
  }

  // ── Grupos ──────────────────────────────────────────────────────────────────
  /** `forcar` = ignora o cache do servidor e busca no WhatsApp (botão de
   *  recarregar). Sem ele a lista vem do cache, instantânea. */
  async function carregarGrupos(forcar = false) {
    setCarregandoGrupos(true);
    setErroGrupos(null);
    try {
      const { grupos: lista } = await getMeusGrupos(conexaoSel ?? undefined, forcar);
      setGrupos(lista);
      if (lista.length === 0) setErroGrupos("Nenhum grupo encontrado nesta conexão de WhatsApp.");
    } catch (err) {
      setErroGrupos(err instanceof Error ? err.message : "Erro ao carregar os grupos.");
    } finally {
      setCarregandoGrupos(false);
    }
  }

  // ── Criativos ───────────────────────────────────────────────────────────────
  const itensEscolhidos = useMemo(
    () => itens.filter((i) => escolhidos.has(i.chave)),
    [itens, escolhidos],
  );

  /** Rasteriza um criativo por produto escolhido. Roda ao entrar na revisão. */
  async function gerarMidias() {
    setGerando(true);
    try {
      // Sem localização vinda do fluxo de criativos, usa o nome do cliente na
      // barra do criativo — evita a peça sair com o rodapé em branco.
      const localizacao = criativosConfig.localizacao || clienteSel?.farmacia || "";
      const geradas: MidiaDisparo[] = [];
      for (const item of itensEscolhidos) {
        const preco = precos[item.chave] ?? item.preco;
        const png = await exportarCriativoPng({
          layout:        criativosConfig.layout,
          enquadramento: criativosConfig.enquadramento,
          nome:          item.nome,
          preco,
          imagem:        item.imagem,
          localizacao,
          titulo:        criativosConfig.titulo,
          subtitulo:     criativosConfig.subtitulo,
        });
        // Comprime para caber sob o limite de 1 MB do nginx da Evolution.
        const comprimido = await comprimirParaEnvio(png);
        geradas.push({
          b64:    comprimido.b64,
          mime:   comprimido.mime,
          rotulo: preco ? `${item.nome} — ${preco}` : item.nome,
        });
      }
      setMidias(geradas);
    } catch {
      toast.error("Erro ao gerar os criativos.");
    } finally {
      setGerando(false);
    }
  }

  // ── Navegação ───────────────────────────────────────────────────────────────
  async function avancar() {
    if (etapa === 1) {
      const ativa = conexoes.find((c) => c.instanceName === conexaoSel);
      if (!ativa || ativa.status !== "open") {
        toast.error("Selecione uma conexão conectada."); return;
      }
      setEtapa(2);
      if (carteira.length === 0) carregarSolicitacoes();
      return;
    }
    if (etapa === 2) {
      if (itensEscolhidos.length === 0) {
        toast.error("Escolha um cliente e ao menos um produto."); return;
      }
      setEtapa(3);
      return;
    }
    if (etapa === 3) {
      const semPreco = itensEscolhidos.filter((i) => !(precos[i.chave] ?? i.preco).trim());
      if (semPreco.length > 0) {
        toast.error(`Falta o preço de ${semPreco.length} produto(s).`); return;
      }
      setEtapa(4);
      if (grupos.length === 0) void carregarGrupos();
      return;
    }
    if (etapa === 4) {
      if (selecionados.size === 0) { toast.error("Selecione ao menos um grupo."); return; }
      setEtapa(5);
      return;
    }
    if (etapa === 5) {
      if (quando === "agendado" && !agendadoPara) {
        toast.error("Informe a data e a hora do agendamento."); return;
      }
      setEtapa(6);
      void gerarMidias();
      return;
    }
    await confirmar();
  }

  async function confirmar() {
    setEnviando(true);
    try {
      const gruposSel = grupos
        .filter((g) => selecionados.has(g.jid))
        .map((g) => ({ jid: g.jid, nome: g.nome }));

      const resultado = await criarDisparo({
        titulo: clienteSel ? `Ofertas — ${clienteSel.farmacia}` : "Ofertas",
        mensagem,
        midias,
        grupos: gruposSel,
        quando,
        agendado_para: quando === "agendado" ? new Date(agendadoPara).toISOString() : null,
        repetir,
        timezone: "America/Sao_Paulo",
        farmacia_id: clienteSel?.farmacia_id ?? null,
        solicitacao_id: clienteSel?.solicitacao?.id ?? null,
        instance: conexaoSel,
      });

      if (quando === "agora") {
        toast.success(`Disparo concluído: ${resultado.enviados ?? 0} grupo(s), ${resultado.falhas ?? 0} falha(s).`);
      } else {
        toast.success("Disparo agendado!");
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao disparar.");
    } finally {
      setEnviando(false);
    }
  }

  function alternarGrupo(jid: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(jid)) novo.delete(jid); else novo.add(jid);
      return novo;
    });
  }

  function alternarItem(chave: string) {
    setEscolhidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave); else novo.add(chave);
      return novo;
    });
  }

  const gruposFiltrados = useMemo(
    () => grupos.filter((g) => g.nome.toLowerCase().includes(busca.toLowerCase())),
    [grupos, busca],
  );
  const todosSelecionados = gruposFiltrados.length > 0
    && gruposFiltrados.every((g) => selecionados.has(g.jid));

  // Quem respondeu aparece primeiro — é onde o gestor consegue agir
  const responderam = carteira.filter((c) => c.respondeu);
  const carteiraOrdenada = [...carteira].sort(
    (a, b) => Number(b.respondeu) - Number(a.respondeu) || a.farmacia.localeCompare(b.farmacia, "pt-BR"),
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div>
            <p className="text-xs font-semibold text-brand uppercase tracking-wide">
              Passo {etapa} de 6
            </p>
            <h2 className="text-lg font-bold text-zinc-900 leading-tight">{TITULOS[etapa].titulo}</h2>
            <p className="text-sm text-zinc-500">{TITULOS[etapa].descricao}</p>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-lg grid place-items-center text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition shrink-0"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex gap-1 px-6 pt-3">
          {([1, 2, 3, 4, 5, 6] as Etapa[]).map((n) => (
            <div key={n} className={`h-1 flex-1 rounded-full transition ${n <= etapa ? "bg-brand" : "bg-zinc-200"}`} />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* ── 1: Conexão ── */}
          {etapa === 1 && (
            <div className="flex flex-col gap-4">
              {(carregandoConexoes || carregandoStatus) ? (
                <div className="flex items-center justify-center gap-2 py-10 text-zinc-400">
                  <Loader2 className="size-4 animate-spin" /> Carregando suas conexões...
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-medium text-zinc-700">Escolha a conexão</p>
                    <p className="text-xs text-zinc-500">De qual WhatsApp esta oferta vai sair.</p>
                  </div>

                  {conexoes.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {conexoes.map((c) => {
                        const ativa = c.status === "open";
                        const sel = c.instanceName === conexaoSel;
                        return (
                          <button
                            key={c.instanceName}
                            type="button"
                            onClick={() => setConexaoSel(c.instanceName)}
                            className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                              sel ? "border-brand bg-brand/5" : "border-zinc-200 hover:border-zinc-300"
                            }`}
                          >
                            <span className={`size-2.5 rounded-full shrink-0 ${ativa ? "bg-emerald-500" : "bg-zinc-300"}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-zinc-800 truncate">{c.nome}</p>
                              <p className="text-xs text-zinc-500 truncate">
                                {c.tipo === "gestor" ? "Sua conexão" : "Conexão da agência"}
                                {c.numero ? ` · ${c.numero}` : ""}
                                {ativa ? "" : " · desconectado"}
                              </p>
                            </div>
                            {sel && <CheckCircle2 className="size-5 text-brand shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500">
                      Nenhuma conexão disponível ainda. Conecte o seu WhatsApp abaixo.
                    </p>
                  )}

                  {/* Conectar a conexão do próprio gestor — passa a aparecer na lista */}
                  {!conectado && (
                    <div className="border border-zinc-200 rounded-xl p-5 flex flex-col items-center gap-3">
                      <Smartphone className="size-8 text-zinc-300" />
                      <p className="text-sm text-zinc-600 text-center max-w-sm">
                        Quer usar o seu próprio WhatsApp? Conecte-o uma vez — ele passa a aparecer na lista acima.
                      </p>
                      {erroStatus && <p className="text-xs text-red-600 text-center">{erroStatus}</p>}
                      {qrCode ? (
                        <>
                          <img
                            src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                            alt="QR Code do WhatsApp"
                            className="size-56 rounded-lg border border-zinc-200"
                          />
                          <p className="text-xs text-zinc-500 text-center">
                            No celular: WhatsApp → Aparelhos conectados → Conectar aparelho.
                          </p>
                          <span className="flex items-center gap-2 text-xs text-zinc-400">
                            <Loader2 className="size-3 animate-spin" /> Aguardando leitura...
                          </span>
                        </>
                      ) : (
                        <button
                          onClick={async () => {
                            setConectando(true);
                            try {
                              const r = await conectarMeuWhatsapp();
                              setQrCode(r.qr_code);
                              setStatusConexao(r.status);
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Não foi possível conectar.");
                            } finally { setConectando(false); }
                          }}
                          disabled={conectando}
                          className="bg-brand hover:bg-brand/90 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition"
                        >
                          {conectando
                            ? <><Loader2 className="size-4 animate-spin" /> Gerando QR...</>
                            : <><QrCode className="size-4" /> Conectar meu WhatsApp</>}
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* O link é por cliente — vai junto na cobrança de cada um */}
              <div className="border border-zinc-200 rounded-xl p-4 flex items-start gap-3">
                <Link2 className="size-5 text-brand shrink-0 mt-0.5" />
                <p className="text-xs text-zinc-500">
                  Cada cliente tem o seu próprio link, que já abre na farmácia dele. Ao cobrar a
                  lista, o link certo vai junto na mensagem.
                </p>
              </div>
            </div>
          )}

          {/* ── 2: Cliente + produtos que ele enviou ── */}
          {etapa === 2 && (
            <div className="flex flex-col gap-4">
              {!clienteSel && !usarDaTela ? (
                <>
                  {carregandoSolic ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-zinc-400">
                      <Loader2 className="size-4 animate-spin" /> Carregando seus clientes...
                    </div>
                  ) : carteira.length === 0 ? (
                    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 text-center flex flex-col items-center gap-2">
                      <Inbox className="size-8 text-zinc-300" />
                      <p className="text-sm font-medium text-zinc-700">Você ainda não tem farmácias na carteira.</p>
                    </div>
                  ) : (
                    <>
                      {/* Placar: quantos responderam do total */}
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                        <div className="flex-1">
                          <p className="text-sm text-zinc-700">
                            <strong className="text-zinc-900">{responderam.length}</strong> de{" "}
                            <strong className="text-zinc-900">{carteira.length}</strong> clientes enviaram a lista
                          </p>
                          <div className="mt-1.5 h-1.5 rounded-full bg-zinc-200 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 transition-all"
                              style={{ width: `${carteira.length ? (responderam.length / carteira.length) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                        <button
                          onClick={carregarSolicitacoes}
                          title="Atualizar"
                          className="size-8 rounded-lg border border-zinc-200 bg-white grid place-items-center text-zinc-500 hover:bg-zinc-50 transition shrink-0"
                        >
                          <RefreshCw className="size-4" />
                        </button>
                      </div>

                      <div className="grid gap-2 max-h-96 overflow-y-auto">
                        {carteiraOrdenada.map((c) => (
                          <div
                            key={c.farmacia_id}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                              c.respondeu
                                ? "border-emerald-200 bg-emerald-50/40"
                                : "border-zinc-200"
                            }`}
                          >
                            <Store className={`size-5 shrink-0 ${c.respondeu ? "text-emerald-600" : "text-zinc-300"}`} />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-zinc-900 truncate">{c.farmacia}</p>
                              <p className="text-xs text-zinc-500">
                                {c.respondeu && c.solicitacao ? (
                                  <>
                                    {c.solicitacao.produtos.length} produto(s)
                                    {c.solicitacao.produtos_livres ? " + itens escritos" : ""}
                                    {c.solicitacao.enviado_por ? ` · por ${c.solicitacao.enviado_por}` : ""}
                                  </>
                                ) : c.ultimo_envio_em ? (
                                  `Sem lista nova — último envio em ${new Date(c.ultimo_envio_em).toLocaleDateString("pt-BR")}`
                                ) : (
                                  "Nunca enviou uma lista"
                                )}
                              </p>
                            </div>

                            {c.respondeu ? (
                              <button
                                onClick={() => abrirCliente(c)}
                                className="shrink-0 bg-brand hover:bg-brand/90 text-white text-sm font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
                              >
                                Montar <ArrowRight className="size-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => cobrar(c)}
                                title="Cobrar a lista deste cliente"
                                className="shrink-0 border border-zinc-300 text-zinc-600 hover:border-brand hover:text-brand text-sm font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
                              >
                                <MessageCircle className="size-3.5" /> Cobrar
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <button
                    onClick={usarProdutosDaTela}
                    disabled={produtos.length === 0}
                    className="self-start text-sm font-medium text-zinc-600 hover:text-brand disabled:opacity-40 flex items-center gap-1.5 transition"
                  >
                    <PencilLine className="size-4" />
                    Usar os {produtos.length} produto(s) desta tela (sem cliente)
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate">
                        {clienteSel ? clienteSel.farmacia : "Produtos desta tela"}
                      </p>
                      <p className="text-xs text-zinc-500">
                        Marque os que entram neste disparo.
                      </p>
                    </div>
                    <button
                      onClick={() => { setClienteSel(null); setUsarDaTela(false); setItens([]); setEscolhidos(new Set()); }}
                      className="text-sm text-zinc-500 hover:text-zinc-800 shrink-0 transition"
                    >
                      Trocar
                    </button>
                  </div>

                  {clienteSel?.solicitacao?.observacao && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                      <p className="text-xs font-medium text-blue-900">Recado do cliente</p>
                      <p className="text-sm text-blue-800 mt-0.5">{clienteSel.solicitacao.observacao}</p>
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
                    {itens.map((item) => {
                      const marcado = escolhidos.has(item.chave);
                      return (
                        <button
                          key={item.chave}
                          onClick={() => alternarItem(item.chave)}
                          className={`flex items-center gap-3 p-3 rounded-xl border text-left transition ${
                            marcado ? "border-brand bg-brand/5" : "border-zinc-200 hover:border-zinc-300"
                          }`}
                        >
                          <div className={`size-5 rounded border grid place-items-center shrink-0 ${
                            marcado ? "bg-brand border-brand text-white" : "border-zinc-300"
                          }`}>
                            {marcado && <Check className="size-3.5" />}
                          </div>
                          {item.imagem ? (
                            <img src={item.imagem} alt="" className="size-9 rounded object-contain bg-zinc-50 shrink-0" />
                          ) : (
                            <span className="size-9 rounded bg-zinc-100 grid place-items-center shrink-0">
                              <ImageIcon className="size-4 text-zinc-400" />
                            </span>
                          )}
                          <span className="flex-1 min-w-0 text-sm text-zinc-800 line-clamp-2">
                            {item.nome}
                            {item.livre && (
                              <span className="block text-xs text-amber-600">sem foto no catálogo</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-sm text-zinc-500">
                    <strong className="text-zinc-800">{itensEscolhidos.length}</strong> de {itens.length} produto(s).
                  </p>
                </>
              )}
            </div>
          )}

          {/* ── 3: Preços + mensagem ── */}
          {etapa === 3 && (
            <div className="flex flex-col gap-4">
              <div className="grid gap-2 max-h-64 overflow-y-auto">
                {itensEscolhidos.map((item) => (
                  <div key={item.chave} className="flex items-center gap-3 p-2.5 rounded-xl border border-zinc-200">
                    {item.imagem ? (
                      <img src={item.imagem} alt="" className="size-9 rounded object-contain bg-zinc-50 shrink-0" />
                    ) : (
                      <span className="size-9 rounded bg-zinc-100 grid place-items-center shrink-0">
                        <ImageIcon className="size-4 text-zinc-400" />
                      </span>
                    )}
                    <span className="flex-1 min-w-0 text-sm text-zinc-800 truncate">{item.nome}</span>
                    <div className="relative w-28 shrink-0">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-zinc-400 pointer-events-none">
                        R$
                      </span>
                      <input
                        value={precos[item.chave] ?? item.preco}
                        onChange={(e) => setPrecos((p) => ({ ...p, [item.chave]: formatarMoeda(e.target.value) }))}
                        inputMode="numeric"
                        placeholder="0,00"
                        className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-zinc-200 text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand/30"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-700">Mensagem do grupo</label>
                <textarea
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  rows={4}
                  placeholder="Texto que vai antes das imagens"
                  className="w-full p-3 rounded-lg border border-zinc-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
                <p className="text-xs text-zinc-400">
                  Vai como texto e, na sequência, cada produto como imagem. No WhatsApp, *texto* fica em negrito.
                </p>
              </div>
            </div>
          )}

          {/* ── 4: Grupos ── */}
          {etapa === 4 && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="size-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar grupo..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                </div>
                <button
                  onClick={() => void carregarGrupos(true)}
                  disabled={carregandoGrupos}
                  title="Buscar a lista atualizada no WhatsApp (pode demorar)"
                  className="size-9 rounded-lg border border-zinc-200 grid place-items-center text-zinc-500 hover:bg-zinc-50 transition shrink-0"
                >
                  <RefreshCw className={`size-4 ${carregandoGrupos ? "animate-spin" : ""}`} />
                </button>
              </div>

              {gruposFiltrados.length > 0 && (
                <button
                  onClick={() => {
                    setSelecionados((atual) => {
                      const novo = new Set(atual);
                      if (todosSelecionados) gruposFiltrados.forEach((g) => novo.delete(g.jid));
                      else gruposFiltrados.forEach((g) => novo.add(g.jid));
                      return novo;
                    });
                  }}
                  className="self-start text-sm font-medium text-brand hover:underline"
                >
                  {todosSelecionados ? "Desmarcar todos" : "Selecionar todos"}
                </button>
              )}

              {carregandoGrupos ? (
                <div className="flex items-center justify-center gap-2 py-10 text-zinc-400">
                  <Loader2 className="size-4 animate-spin" /> Buscando seus grupos...
                </div>
              ) : erroGrupos ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                  <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">{erroGrupos}</p>
                </div>
              ) : (
                <div className="grid gap-2 max-h-80 overflow-y-auto">
                  {gruposFiltrados.map((g) => {
                    const marcado = selecionados.has(g.jid);
                    return (
                      <button
                        key={g.jid}
                        onClick={() => alternarGrupo(g.jid)}
                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition ${
                          marcado ? "border-brand bg-brand/5" : "border-zinc-200 hover:border-zinc-300"
                        }`}
                      >
                        <div className={`size-5 rounded border grid place-items-center shrink-0 ${
                          marcado ? "bg-brand border-brand text-white" : "border-zinc-300"
                        }`}>
                          {marcado && <Check className="size-3.5" />}
                        </div>
                        <Users className="size-4 text-zinc-400 shrink-0" />
                        <span className="flex-1 min-w-0 truncate text-sm text-zinc-800">{g.nome}</span>
                        {g.participantes !== null && (
                          <span className="text-xs text-zinc-400 shrink-0">{g.participantes} membros</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {selecionados.size > 0 && (
                <p className="text-sm text-zinc-500">
                  <strong className="text-zinc-800">{selecionados.size}</strong> grupo(s) selecionado(s).
                </p>
              )}
            </div>
          )}

          {/* ── 5: Quando ── */}
          {etapa === 5 && (
            <div className="flex flex-col gap-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setQuando("agora")}
                  className={`p-4 rounded-xl border text-left transition ${
                    quando === "agora" ? "border-brand bg-brand/5" : "border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <Send className="size-5 text-brand mb-2" />
                  <p className="font-semibold text-zinc-900">Enviar agora</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Dispara assim que você confirmar.</p>
                </button>
                <button
                  onClick={() => setQuando("agendado")}
                  className={`p-4 rounded-xl border text-left transition ${
                    quando === "agendado" ? "border-brand bg-brand/5" : "border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <CalendarClock className="size-5 text-brand mb-2" />
                  <p className="font-semibold text-zinc-900">Agendar</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Escolhe data, hora e repetição.</p>
                </button>
              </div>

              {quando === "agendado" && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-zinc-700">Data e hora</label>
                    <input
                      type="datetime-local"
                      value={agendadoPara}
                      onChange={(e) => setAgendadoPara(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-zinc-700">Repetir</label>
                    <select
                      value={repetir}
                      onChange={(e) => setRepetir(e.target.value as RepetirDisparo)}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
                    >
                      {REPETICOES.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                    </select>
                  </div>
                  <p className="sm:col-span-2 text-xs text-zinc-400">
                    Horário de Brasília (America/Sao_Paulo).
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── 6: Revisão ── */}
          {etapa === 6 && (
            <div className="grid md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-3">
                <Linha rotulo="Cliente" valor={clienteSel?.farmacia ?? "Envio avulso"} />
                <Linha rotulo="Enviando de" valor={numero ? `Seu WhatsApp (${numero})` : "Seu WhatsApp"} />
                <Linha rotulo="Grupos" valor={`${selecionados.size} grupo(s)`} />
                <Linha rotulo="Criativos" valor={`${itensEscolhidos.length} produto(s)`} />
                <Linha
                  rotulo="Quando"
                  valor={
                    quando === "agora"
                      ? "Agora"
                      : `${new Date(agendadoPara).toLocaleString("pt-BR")}${
                          repetir !== "nunca"
                            ? ` — ${REPETICOES.find((r) => r.id === repetir)?.nome.toLowerCase()}`
                            : ""
                        }`
                  }
                />
                <div>
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Grupos escolhidos</p>
                  <div className="max-h-28 overflow-y-auto flex flex-wrap gap-1.5">
                    {grupos.filter((g) => selecionados.has(g.jid)).map((g) => (
                      <span key={g.jid} className="text-xs bg-zinc-100 text-zinc-700 px-2 py-1 rounded-full">
                        {g.nome}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Como vai chegar no grupo</p>
                <div className="rounded-xl border border-zinc-200 bg-[#e5ddd5] p-3 max-h-80 overflow-y-auto">
                  {/* Sem criativo, o texto vai sozinho; com criativo, ele é a
                      legenda da 1ª imagem (é assim que o backend envia). */}
                  {mensagem.trim() && midias.length === 0 && !gerando && (
                    <div className="bg-white rounded-lg p-2 shadow-sm mb-2">
                      <p className="text-sm text-zinc-800 whitespace-pre-wrap break-words">{mensagem}</p>
                    </div>
                  )}
                  {gerando ? (
                    <div className="bg-white rounded-lg p-4 shadow-sm flex items-center justify-center gap-2 text-sm text-zinc-400">
                      <Loader2 className="size-4 animate-spin" /> Gerando os criativos...
                    </div>
                  ) : (
                    midias.map((m, i) => (
                      <div key={i} className="bg-white rounded-lg p-2 shadow-sm mb-2">
                        <img src={`data:${m.mime};base64,${m.b64}`} alt="" className="rounded-md mb-1 max-h-48 mx-auto" />
                        <p className="text-xs text-zinc-700 whitespace-pre-wrap break-words">
                          {i === 0 && mensagem.trim()
                            ? `${mensagem.trim()}${m.rotulo ? `\n\n${m.rotulo}` : ""}`
                            : m.rotulo}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100 bg-zinc-50/50">
          {etapa > 1 ? (
            <button
              onClick={() => setEtapa((e) => (e - 1) as Etapa)}
              className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 flex items-center gap-1.5 transition"
            >
              <ArrowLeft className="size-4" /> Voltar
            </button>
          ) : (
            <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 transition">
              Cancelar
            </button>
          )}

          <button
            onClick={avancar}
            disabled={enviando || (etapa === 6 && (gerando || midias.length === 0))}
            className="bg-brand hover:bg-brand/90 disabled:opacity-60 text-white font-semibold px-5 py-2 rounded-lg flex items-center gap-2 transition shadow-sm"
          >
            {enviando ? (
              <><Loader2 className="size-4 animate-spin" /> Disparando...</>
            ) : etapa === 6 ? (
              <><Send className="size-4" /> {quando === "agora" ? "Disparar agora" : "Agendar disparo"}</>
            ) : (
              <>Continuar <ArrowRight className="size-4" /></>
            )}
          </button>
        </div>
      </div>

      {/* Cobrança sem telefone salvo: entrega a mensagem pronta para copiar */}
      {cobrando && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setCobrando(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-5 py-4 border-b border-zinc-100">
              <div className="min-w-0">
                <h3 className="font-bold text-zinc-900 truncate">Cobrar {cobrando.farmacia}</h3>
                <p className="text-sm text-zinc-500">
                  Esta farmácia não tem telefone salvo, então não dá para abrir a conversa direto.
                </p>
              </div>
              <button
                onClick={() => setCobrando(null)}
                className="size-8 rounded-lg grid place-items-center text-zinc-400 hover:bg-zinc-100 transition shrink-0"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="px-5 py-4 flex flex-col gap-3">
              <textarea
                readOnly
                value={mensagemCobranca(cobrando)}
                rows={8}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full p-3 rounded-lg border border-zinc-200 bg-zinc-50 text-sm resize-none"
              />
              <p className="text-xs text-zinc-500">
                Dica: salve o telefone em Farmácias → {cobrando.farmacia}. Da próxima vez o
                botão abre a conversa do dono já com o texto pronto.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-100 bg-zinc-50/50">
              <button
                onClick={() => setCobrando(null)}
                className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 transition"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(mensagemCobranca(cobrando))
                    .then(() => { toast.success("Mensagem copiada!"); setCobrando(null); })
                    .catch(() => toast.error("Não consegui copiar."));
                }}
                className="bg-brand hover:bg-brand/90 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition"
              >
                <Copy className="size-4" /> Copiar mensagem
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{rotulo}</p>
      <p className="text-sm text-zinc-900 font-medium">{valor}</p>
    </div>
  );
}
