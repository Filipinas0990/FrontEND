import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { KeyRound, Lock, X } from "lucide-react";

interface Pedido {
  acao: string;
  resolver: (senha: string | null) => void;
}

/**
 * Toda ação no Banco de Imagens pede a senha definida no servidor. O hook
 * devolve `pedirSenha`, que abre o diálogo e resolve com a senha digitada (ou
 * null se cancelar), e o elemento do diálogo para a tela renderizar.
 *
 * A senha NÃO é guardada: cada ação pergunta de novo. Quem confere é o backend.
 *
 *   const { pedirSenha, dialogoSenha } = useSenhaBanco();
 *   const senha = await pedirSenha("Excluir Rexona V8");
 *   if (!senha) return;
 */
export function useSenhaBanco(): {
  pedirSenha: (acao: string) => Promise<string | null>;
  dialogoSenha: ReactNode;
} {
  const [pedido, setPedido] = useState<Pedido | null>(null);

  const pedirSenha = useCallback(
    (acao: string) =>
      new Promise<string | null>((resolver) => {
        setPedido({ acao, resolver });
      }),
    [],
  );

  function responder(senha: string | null) {
    pedido?.resolver(senha);
    setPedido(null);
  }

  return {
    pedirSenha,
    dialogoSenha: pedido ? (
      <SenhaBancoDialog acao={pedido.acao} onConfirmar={responder} onCancelar={() => responder(null)} />
    ) : null,
  };
}

function SenhaBancoDialog({
  acao,
  onConfirmar,
  onCancelar,
}: {
  acao: string;
  onConfirmar: (senha: string) => void;
  onCancelar: () => void;
}) {
  const [senha, setSenha] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // Não deixa o Esc vazar para o modal de baixo (a lupa também fecha no Esc).
        e.stopImmediatePropagation();
        onCancelar();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancelar]);

  return (
    // z-[60]: precisa ficar por cima dos modais do banco (lupa e upload são z-50).
    <div
      className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
      onClick={onCancelar}
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-senha-banco"
    >
      <form
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (senha) onConfirmar(senha);
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="size-10 rounded-xl bg-brand/10 text-brand grid place-items-center shrink-0">
            <Lock className="size-5" />
          </div>
          <button
            type="button"
            onClick={onCancelar}
            className="size-8 rounded-lg grid place-items-center text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
            aria-label="Cancelar"
          >
            <X className="size-5" />
          </button>
        </div>

        <h2 id="titulo-senha-banco" className="mt-4 text-base font-bold text-zinc-900">
          Senha do Banco de Imagens
        </h2>
        <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
          Confirme a senha para: <span className="font-semibold text-zinc-700">{acao}</span>
        </p>

        <div className="relative mt-4">
          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
          <input
            ref={inputRef}
            type="password"
            autoComplete="off"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha"
            className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
          />
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancelar}
            className="flex-1 py-2.5 text-sm font-medium text-zinc-600 rounded-lg ring-1 ring-zinc-200 hover:bg-zinc-50 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!senha}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-brand rounded-lg hover:bg-brand/90 disabled:opacity-40 transition"
          >
            Confirmar
          </button>
        </div>
      </form>
    </div>
  );
}
