import { useState, useEffect, useRef, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { getUser } from "@/lib/auth"
import {
  getWhatsAppStatus,
  connectWhatsApp,
  getWhatsAppQrCode,
  disconnectWhatsApp,
  type WhatsAppStatus,
} from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type ModalState = "none" | "connect_form" | "qr" | "qr_expired" | "success"

const MAX_TENTATIVAS = 40 // 40 × 3 s = 2 min

function formatPhone(num: string) {
  const d = num.replace(/\D/g, "")
  if (d.length === 13) return `+${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 9)}-${d.slice(9)}`
  if (d.length === 12) return `+${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 8)}-${d.slice(8)}`
  return `+${d}`
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, "0")}`
}

function StatusBadge({ status }: { status: WhatsAppStatus["status"] }) {
  const map = {
    open:       { color: "#10B981", label: "Conectado" },
    connecting: { color: "#F59E0B", label: "Conectando..." },
    close:      { color: "#6B7280", label: "Desconectado" },
  }
  const { color, label } = map[status]
  return (
    <span className="flex items-center gap-1.5 font-medium text-sm">
      <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

export function WhatsAppSection() {
  const qc = useQueryClient()
  const user = getUser()
  const isAdmin = user?.is_admin === true

  const { data: statusData, isLoading } = useQuery({
    queryKey: ["whatsapp-status"],
    queryFn: getWhatsAppStatus,
    staleTime: 30_000,
    retry: false,
  })

  const [modalState, setModalState] = useState<ModalState>("none")
  const [instanceName, setInstanceName] = useState("pharmaflow")
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(120)
  const [disconnectConfirm, setDisconnectConfirm] = useState(false)

  const pollingRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const tentativasRef = useRef(0)

  const stopPolling = useCallback(() => {
    if (pollingRef.current)   { clearInterval(pollingRef.current);   pollingRef.current   = null }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
  }, [])

  useEffect(() => () => stopPolling(), [stopPolling])

  const startPolling = useCallback(() => {
    stopPolling()
    tentativasRef.current = 0
    setCountdown(120)

    countdownRef.current = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1))
    }, 1000)

    pollingRef.current = setInterval(async () => {
      tentativasRef.current++

      if (tentativasRef.current > MAX_TENTATIVAS) {
        stopPolling()
        setModalState("qr_expired")
        return
      }

      try {
        const data = await getWhatsAppQrCode()
        if (data.status === "open") {
          stopPolling()
          setModalState("success")
          qc.invalidateQueries({ queryKey: ["whatsapp-status"] })
          return
        }
        if (data.qr_code) setQrCode(data.qr_code)
      } catch {
        // ignora erros de rede durante polling
      }
    }, 3000)
  }, [stopPolling, qc])

  const connectMut = useMutation({
    mutationFn: (name: string) => connectWhatsApp(name),
    onSuccess: (data) => {
      setQrCode(data.qr_code)
      setModalState("qr")
      startPolling()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const disconnectMut = useMutation({
    mutationFn: disconnectWhatsApp,
    onSuccess: () => {
      toast.success("WhatsApp desconectado.")
      qc.invalidateQueries({ queryKey: ["whatsapp-status"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleConnect = () => {
    if (!instanceName.trim()) return
    connectMut.mutate(instanceName.trim())
  }

  const handleRegenerate = () => {
    stopPolling()
    connectMut.mutate(instanceName.trim())
  }

  const handleCloseQrModal = () => {
    stopPolling()
    setModalState("none")
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500 py-2">
        <RefreshCw className="size-4 animate-spin" />
        Verificando conexão...
      </div>
    )
  }

  if (!statusData) return null

  if (!statusData.configurado) {
    return (
      <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
        <AlertTriangle className="size-4 text-red-500 mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-red-700">Servidor não configurado</p>
          <p className="text-red-600 mt-0.5">
            O servidor não está configurado para WhatsApp. Contate o suporte técnico.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          Status: <StatusBadge status={statusData.status} />
        </div>

        {statusData.conectado ? (
          <>
            {statusData.numero && (
              <p className="text-sm text-zinc-600">
                <span className="text-zinc-500">Número: </span>
                {formatPhone(statusData.numero)}
              </p>
            )}
            {statusData.instancia && (
              <p className="text-sm text-zinc-600">
                <span className="text-zinc-500">Instância: </span>
                {statusData.instancia}
              </p>
            )}

            <p className="text-sm text-zinc-500">
              O número de WhatsApp é configurado individualmente em cada reunião agendada.
            </p>

            {isAdmin && (
              <button
                onClick={() => setDisconnectConfirm(true)}
                disabled={disconnectMut.isPending}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-md hover:bg-red-600 transition-colors disabled:opacity-60"
              >
                {disconnectMut.isPending && <RefreshCw className="size-3.5 animate-spin" />}
                Desconectar
              </button>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-zinc-500">
              Conecte um número de WhatsApp para enviar confirmações automáticas 5 horas antes de cada reunião agendada.
            </p>

            {isAdmin ? (
              <button
                onClick={() => setModalState("connect_form")}
                className="px-4 py-2 text-sm font-medium text-white bg-brand rounded-md hover:opacity-90 transition-opacity"
              >
                Conectar WhatsApp
              </button>
            ) : (
              <p className="text-xs text-zinc-400">Apenas administradores podem configurar o WhatsApp.</p>
            )}
          </>
        )}
      </div>

      {/* ── Modal: Formulário de conexão ── */}
      <Dialog
        open={modalState === "connect_form"}
        onOpenChange={(open) => !open && setModalState("none")}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">Nome da instância</label>
              <input
                type="text"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                placeholder="pharmaflow"
                className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
              <p className="text-xs text-zinc-500">
                Identificador único na Evolution API. Use letras, números e hífens.
              </p>
            </div>
          </div>

          <DialogFooter>
            <button
              onClick={() => setModalState("none")}
              className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConnect}
              disabled={!instanceName.trim() || connectMut.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {connectMut.isPending && <RefreshCw className="size-3.5 animate-spin" />}
              Conectar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: QR code / Expirado ── */}
      <Dialog
        open={modalState === "qr" || modalState === "qr_expired"}
        onOpenChange={(open) => !open && handleCloseQrModal()}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {modalState === "qr" ? "Escaneie o QR Code" : "QR Code Expirado"}
            </DialogTitle>
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
                  <img
                    src={qrCode}
                    alt="QR Code WhatsApp"
                    className="size-52 rounded-lg border border-zinc-200"
                  />
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
                  <div
                    className="h-full bg-brand rounded-full transition-[width] duration-1000"
                    style={{ width: `${(countdown / 120) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center space-y-3">
              <XCircle className="size-12 text-zinc-300 mx-auto" />
              <div>
                <p className="font-medium text-zinc-800">QR Code expirado</p>
                <p className="text-sm text-zinc-500 mt-1">
                  O código expirou. Gere um novo para tentar novamente.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <button
              onClick={handleCloseQrModal}
              className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
            >
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
      <Dialog
        open={modalState === "success"}
        onOpenChange={(open) => !open && setModalState("none")}
      >
        <DialogContent className="max-w-sm">
          <div className="py-6 text-center space-y-4">
            <CheckCircle2 className="size-16 text-emerald-500 mx-auto" />
            <div>
              <p className="text-lg font-semibold text-zinc-900">WhatsApp Conectado!</p>
              <p className="text-sm text-zinc-500 mt-1">
                As reuniões agendadas já passarão a receber confirmação automática 5h antes via WhatsApp.
              </p>
            </div>
            <button
              onClick={() => setModalState("none")}
              className="px-6 py-2 text-sm font-medium text-white bg-brand rounded-md hover:opacity-90 transition-opacity"
            >
              Fechar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── AlertDialog: Confirmar desconexão ── */}
      <AlertDialog open={disconnectConfirm} onOpenChange={setDisconnectConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar WhatsApp?</AlertDialogTitle>
            <AlertDialogDescription>
              As farmácias deixarão de receber confirmações automáticas de reunião via WhatsApp.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDisconnectConfirm(false)
                disconnectMut.mutate()
              }}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
