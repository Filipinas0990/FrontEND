import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  Search,
  SlidersHorizontal,
  Plus,
  MessageCircle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Trash2,
  Power,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { getUser } from "@/lib/auth";
import {
  getWhatsAppConexoes,
  connectWhatsApp,
  getWhatsAppQrCode,
  disconnectWhatsApp,
  deleteWhatsAppInstance,
  type ConexaoWhatsApp,
} from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/conexoes")({
  component: ConexoesPage,
  head: () => ({ meta: [{ title: "Conexões — GrupoSymbol" }] }),
});

type ModalState = "none" | "connect_form" | "qr" | "qr_expired" | "success";

const MAX_TENTATIVAS = 40; // 40 × 3 s = 2 min

function formatPhone(num: string) {
  const d = num.replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12) return `+${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 8)}-${d.slice(8)}`;
  return `+${d}`;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/**
 * Nome amigável → identificador da instância na Evolution. O usuário digita
 * "WhatsApp Ofertas SP" e não precisa saber que vira "whatsapp-ofertas-sp".
 */
function paraInstancia(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

const STATUS_MAP: Record<ConexaoWhatsApp["status"], { color: string; label: string }> = {
  open: { color: "#10B981", label: "Conectado" },
  connecting: { color: "#F59E0B", label: "Conectando..." },
  close: { color: "#6B7280", label: "Desconectado" },
};

function StatusBadge({ status }: { status: ConexaoWhatsApp["status"] }) {
  const { color, label } = STATUS_MAP[status];
  return (
    <span className="flex items-center gap-1.5 font-medium text-sm">
      <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function ConexoesPage() {
  const qc = useQueryClient();
  const isAdmin = getUser()?.is_admin === true;

  const { data, isLoading } = useQuery({
    queryKey: ["whatsapp-conexoes"],
    queryFn: getWhatsAppConexoes,
    staleTime: 30_000,
    retry: false,
  });

  const conexoes = data?.conexoes ?? [];

  const [busca, setBusca] = useState("");
  const [modalState, setModalState] = useState<ModalState>("none");
  const [nomeConexao, setNomeConexao] = useState("");
  const [instanceName, setInstanceName] = useState("");
  /** Instância que o modal de QR está acompanhando. */
  const [instanciaAtiva, setInstanciaAtiva] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(120);
  const [confirmacao, setConfirmacao] = useState<
    { tipo: "desconectar" | "excluir"; conexao: ConexaoWhatsApp } | null
  >(null);
  /** Instância cuja ação está em voo — para o spinner ficar no card certo. */
  const [emAcao, setEmAcao] = useState<string | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tentativasRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const invalidarConexoes = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["whatsapp-conexoes"] });
    // O pontinho verde da sidebar vem do /status — segue a mesma verdade.
    qc.invalidateQueries({ queryKey: ["whatsapp-status"] });
  }, [qc]);

  const startPolling = useCallback((instancia: string) => {
    stopPolling();
    tentativasRef.current = 0;
    setCountdown(120);

    countdownRef.current = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);

    pollingRef.current = setInterval(async () => {
      tentativasRef.current++;
      if (tentativasRef.current > MAX_TENTATIVAS) {
        stopPolling();
        setModalState("qr_expired");
        return;
      }
      try {
        const data = await getWhatsAppQrCode(instancia);
        if (data.status === "open") {
          stopPolling();
          setModalState("success");
          invalidarConexoes();
          return;
        }
        if (data.qr_code) setQrCode(data.qr_code);
      } catch {
        // ignora erros de rede durante polling
      }
    }, 3000);
  }, [stopPolling, invalidarConexoes]);

  const connectMut = useMutation({
    mutationFn: ({ instancia, nome }: { instancia: string; nome?: string }) =>
      connectWhatsApp(instancia, nome),
    onSuccess: (data) => {
      setInstanciaAtiva(data.instancia);
      setQrCode(data.qr_code);
      setModalState("qr");
      startPolling(data.instancia);
      invalidarConexoes();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const disconnectMut = useMutation({
    mutationFn: (instancia: string) => disconnectWhatsApp(instancia),
    onSuccess: () => {
      toast.success("WhatsApp desconectado.");
      invalidarConexoes();
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setEmAcao(null),
  });

  const deleteMut = useMutation({
    mutationFn: (instancia: string) => deleteWhatsAppInstance(instancia),
    onSuccess: () => {
      toast.success("Conexão removida.");
      invalidarConexoes();
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setEmAcao(null),
  });

  const handleCriar = () => {
    const instancia = instanceName.trim() || paraInstancia(nomeConexao);
    if (!instancia) return;

    if (conexoes.some((c) => c.instancia === instancia)) {
      toast.error("Já existe uma conexão com esse identificador. Escolha outro nome.");
      return;
    }
    connectMut.mutate({ instancia, nome: nomeConexao.trim() || instancia });
  };

  /** Reabre o QR de uma conexão que já existe (caiu ou nunca foi escaneada). */
  const handleReconectar = (conexao: ConexaoWhatsApp) => {
    if (!isAdmin) {
      toast.info("Apenas administradores podem configurar conexões.");
      return;
    }
    setEmAcao(conexao.instancia);
    connectMut.mutate(
      { instancia: conexao.instancia, nome: conexao.nome },
      { onSettled: () => setEmAcao(null) },
    );
  };

  const handleRegenerate = () => {
    if (!instanciaAtiva) return;
    stopPolling();
    connectMut.mutate({ instancia: instanciaAtiva });
  };

  const handleCloseQrModal = () => {
    stopPolling();
    setModalState("none");
  };

  const abrirAdicionar = () => {
    if (!isAdmin) {
      toast.info("Apenas administradores podem configurar conexões.");
      return;
    }
    setNomeConexao("");
    setInstanceName("");
    setModalState("connect_form");
  };

  const termo = busca.trim().toLowerCase();
  const visiveis = conexoes.filter(
    (c) =>
      termo === "" ||
      c.nome.toLowerCase().includes(termo) ||
      c.instancia.toLowerCase().includes(termo) ||
      (c.numero ?? "").includes(termo),
  );

  const conectadas = conexoes.filter((c) => c.conectado).length;

  return (
    <AppShell title="Conexões">
      {/* Cabeçalho: voltar + título + intro */}
      <div className="relative">
        <Link
          to="/configuracoes"
          className="absolute left-0 top-0 size-9 rounded-lg ring-1 ring-zinc-200 bg-white grid place-items-center text-zinc-600 hover:bg-zinc-50 transition"
          title="Voltar"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <div className="text-center max-w-3xl mx-auto px-12">
          <h2 className="text-2xl font-bold text-zinc-900">Conexões</h2>
          <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
            Gerencie os números de WhatsApp conectados ao sistema. Conecte
            quantos aparelhos precisar — todos ficam disponíveis para as
            confirmações e os disparos automáticos.
          </p>
        </div>
      </div>

      {/* Toolbar: busca + contagem + filtros */}
      <div className="flex items-center gap-3 max-w-5xl mx-auto w-full">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar por nome"
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
          />
        </div>
        {conexoes.length > 0 && (
          <span className="text-sm text-zinc-500 tabular-nums">
            {conectadas} de {conexoes.length} conectada{conexoes.length > 1 ? "s" : ""}
          </span>
        )}
        <button
          type="button"
          onClick={() => toast.info("Filtros estarão disponíveis em breve. 🔒")}
          className="ml-auto flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition"
        >
          <SlidersHorizontal className="size-4" /> Filtros
        </button>
      </div>

      {/* Lista de conexões + card grande de adicionar */}
      <div className="max-w-5xl mx-auto w-full">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-zinc-500 py-16">
            <RefreshCw className="size-4 animate-spin" /> Verificando conexões...
          </div>
        ) : data && !data.configurado ? (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg max-w-md mx-auto">
            <AlertTriangle className="size-4 text-red-500 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-red-700">Servidor não configurado</p>
              <p className="text-red-600 mt-0.5">
                O servidor não está configurado para WhatsApp. Contate o suporte técnico.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-6">
            {visiveis.map((conexao) => {
              const ocupado = emAcao === conexao.instancia;
              return (
                <div
                  key={conexao.instancia}
                  className="w-[380px] bg-white rounded-2xl ring-1 ring-black/5 shadow-sm p-6 flex flex-col gap-4"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`size-11 rounded-xl grid place-items-center shrink-0 ${
                        conexao.conectado
                          ? "bg-emerald-50 text-emerald-500"
                          : "bg-zinc-100 text-zinc-400"
                      }`}
                    >
                      <MessageCircle className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-zinc-900 truncate" title={conexao.nome}>
                        {conexao.nome}
                      </p>
                      <StatusBadge status={conexao.status} />
                    </div>
                  </div>

                  <div className="text-sm text-zinc-600 space-y-0.5">
                    {conexao.numero && (
                      <p>
                        <span className="text-zinc-500">Número: </span>
                        {formatPhone(conexao.numero)}
                      </p>
                    )}
                    {conexao.nome !== conexao.instancia && (
                      <p className="text-xs text-zinc-400 truncate" title={conexao.instancia}>
                        {conexao.instancia}
                      </p>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="mt-auto flex gap-2">
                      {conexao.conectado ? (
                        <button
                          onClick={() => setConfirmacao({ tipo: "desconectar", conexao })}
                          disabled={ocupado}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition disabled:opacity-60"
                        >
                          {ocupado ? (
                            <RefreshCw className="size-3.5 animate-spin" />
                          ) : (
                            <Power className="size-3.5" />
                          )}
                          Desconectar
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReconectar(conexao)}
                          disabled={ocupado}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:opacity-90 transition disabled:opacity-60"
                        >
                          {ocupado ? (
                            <RefreshCw className="size-3.5 animate-spin" />
                          ) : (
                            <QrCode className="size-3.5" />
                          )}
                          Conectar
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmacao({ tipo: "excluir", conexao })}
                        disabled={ocupado}
                        title="Excluir conexão"
                        className="px-3 py-2 text-zinc-500 bg-zinc-50 rounded-lg hover:bg-zinc-100 hover:text-red-600 transition disabled:opacity-60"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Nenhum resultado para a busca (mas existem conexões) */}
            {visiveis.length === 0 && conexoes.length > 0 && (
              <p className="w-full text-center text-sm text-zinc-500 py-8">
                Nenhuma conexão encontrada para "{busca.trim()}".
              </p>
            )}

            {/* Card grande: Adicionar Conexão */}
            <button
              type="button"
              onClick={abrirAdicionar}
              className="w-[380px] min-h-[220px] rounded-2xl border-2 border-dashed border-brand/40 bg-white grid place-items-center hover:bg-brand/5 hover:border-brand/60 transition group"
            >
              <span className="flex items-center gap-2 px-5 py-3 rounded-xl bg-brand text-white font-semibold shadow-sm group-hover:opacity-90 transition">
                <Plus className="size-5" /> Adicionar Conexão
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ── Modal: Formulário de conexão ── */}
      <Dialog open={modalState === "connect_form"} onOpenChange={(open) => !open && setModalState("none")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Conexão</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">Nome da conexão</label>
              <input
                type="text"
                value={nomeConexao}
                onChange={(e) => setNomeConexao(e.target.value)}
                placeholder="Ex.: WhatsApp Ofertas SP"
                autoFocus
                className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
              <p className="text-xs text-zinc-500">
                Como esta conexão aparece nas telas do sistema.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">Identificador na Evolution</label>
              <input
                type="text"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                placeholder={paraInstancia(nomeConexao) || "whatsapp-ofertas-sp"}
                className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
              <p className="text-xs text-zinc-500">
                Deixe em branco para gerar a partir do nome. Precisa ser único —
                letras, números e hífens.
              </p>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setModalState("none")} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleCriar}
              disabled={
                !(instanceName.trim() || paraInstancia(nomeConexao)) || connectMut.isPending
              }
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {connectMut.isPending && <RefreshCw className="size-3.5 animate-spin" />}
              Conectar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: QR code / Expirado ── */}
      <Dialog open={modalState === "qr" || modalState === "qr_expired"} onOpenChange={(open) => !open && handleCloseQrModal()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{modalState === "qr" ? "Escaneie o QR Code" : "QR Code Expirado"}</DialogTitle>
          </DialogHeader>
          {modalState === "qr" ? (
            <div className="space-y-4 py-2">
              <ol className="text-sm text-zinc-600 space-y-1 list-decimal list-inside">
                <li>Abra o WhatsApp no celular</li>
                <li>Toque em Menu (⋮) → Aparelhos conectados</li>
                <li>Toque em "Conectar um aparelho"</li>
                <li>Aponte a câmera para o QR code abaixo</li>
              </ol>
              <div className="flex justify-center">
                {qrCode ? (
                  <img src={qrCode} alt="QR Code WhatsApp" className="size-52 rounded-lg border border-zinc-200" />
                ) : (
                  <div className="size-52 rounded-lg border border-zinc-100 bg-zinc-50 grid place-items-center">
                    <RefreshCw className="size-6 animate-spin text-zinc-300" />
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>⏱ QR code expira em 2 minutos</span>
                  <span className="font-mono font-medium tabular-nums">{formatTime(countdown)}</span>
                </div>
                <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                  <div className="h-full bg-brand rounded-full transition-[width] duration-1000" style={{ width: `${(countdown / 120) * 100}%` }} />
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center space-y-3">
              <XCircle className="size-12 text-zinc-300 mx-auto" />
              <div>
                <p className="font-medium text-zinc-800">QR Code expirado</p>
                <p className="text-sm text-zinc-500 mt-1">O código expirou. Gere um novo para tentar novamente.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <button onClick={handleCloseQrModal} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleRegenerate}
              disabled={connectMut.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {connectMut.isPending && <RefreshCw className="size-3.5 animate-spin" />}
              Gerar novo QR
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Sucesso ── */}
      <Dialog open={modalState === "success"} onOpenChange={(open) => !open && setModalState("none")}>
        <DialogContent className="max-w-sm">
          <div className="py-6 text-center space-y-4">
            <CheckCircle2 className="size-16 text-emerald-500 mx-auto" />
            <div>
              <p className="text-lg font-semibold text-zinc-900">WhatsApp Conectado!</p>
              <p className="text-sm text-zinc-500 mt-1">
                As reuniões agendadas já passarão a receber confirmação automática 5h antes via WhatsApp.
              </p>
            </div>
            <button onClick={() => setModalState("none")} className="px-6 py-2 text-sm font-medium text-white bg-brand rounded-md hover:opacity-90 transition-opacity">
              Fechar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── AlertDialog: Confirmar desconexão / exclusão ── */}
      <AlertDialog open={confirmacao !== null} onOpenChange={(open) => !open && setConfirmacao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmacao?.tipo === "excluir"
                ? `Excluir "${confirmacao.conexao.nome}"?`
                : `Desconectar "${confirmacao?.conexao.nome}"?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmacao?.tipo === "excluir"
                ? "A conexão sai da Evolution API e do sistema. Para usar este número de novo será preciso cadastrar e escanear o QR outra vez."
                : "Este número deixa de enviar confirmações e disparos. As outras conexões continuam funcionando."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmacao) return;
                const { tipo, conexao } = confirmacao;
                setConfirmacao(null);
                setEmAcao(conexao.instancia);
                if (tipo === "excluir") deleteMut.mutate(conexao.instancia);
                else disconnectMut.mutate(conexao.instancia);
              }}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {confirmacao?.tipo === "excluir" ? "Excluir" : "Desconectar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
