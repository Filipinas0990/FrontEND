import { useEffect, useRef, useState } from "react";
import { X, Check, ChevronDown } from "lucide-react";
import { normalizarCategoria } from "@/lib/categorias";

export interface OpcaoCategoria {
  /** O que é gravado/filtrado. Pode ser um sentinela como "__recentes__". */
  valor: string;
  /** O que aparece na lista e no campo depois de escolhido. */
  rotulo: string;
}

/**
 * Campo de categoria: abre a lista INTEIRA no clique, filtra conforme se
 * digita, e (opcionalmente) deixa criar uma categoria nova.
 *
 * Por que não é um `<input list>` com `<datalist>`, que seria uma linha: os
 * navegadores só abrem a lista do datalist depois que o usuário digita alguma
 * coisa, e alguns nem isso. Quem clica no campo esperando ver o que existe não
 * vê nada e conclui que precisa inventar uma categoria.
 *
 * E não é um `<select>` porque no modal de upload a categoria nova precisa
 * nascer digitando, sem passar por cadastro.
 *
 * Usado em dois modos:
 *   • criação (modal de imagens) — `permitirNova`, texto vira categoria
 *   • filtro (passo 3 do disparo) — só escolhe o que existe
 */
export function CampoCategoria({
  valor, onChange, opcoes, permitirNova = false,
  rotuloVazio = "Todas as categorias",
  placeholder = "Clique para ver as categorias",
  id, className = "",
}: {
  valor: string;
  onChange: (v: string) => void;
  opcoes: OpcaoCategoria[];
  permitirNova?: boolean;
  rotuloVazio?: string;
  placeholder?: string;
  id?: string;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  // Texto digitado enquanto a lista está aberta. `null` = mostrando o rótulo
  // do que está escolhido. Sem essa separação, escolher "Recentes" escreveria
  // o sentinela "__recentes__" dentro do campo.
  const [digitando, setDigitando] = useState<string | null>(null);
  const caixa = useRef<HTMLDivElement>(null);

  // Clique fora fecha. O modal já para a propagação do clique, então sem isto
  // a lista ficaria aberta para sempre.
  useEffect(() => {
    if (!aberto) return;
    function aoClicar(e: MouseEvent) {
      if (!caixa.current?.contains(e.target as Node)) { setAberto(false); setDigitando(null); }
    }
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, [aberto]);

  const escolhida = opcoes.find((o) => normalizarCategoria(o.valor) === normalizarCategoria(valor));
  const textoCampo = digitando ?? (escolhida?.rotulo ?? valor);

  const busca = (digitando ?? "").trim();
  const filtradas = busca
    ? opcoes.filter((o) => normalizarCategoria(o.rotulo).includes(normalizarCategoria(busca)))
    : opcoes;
  const jaExiste = opcoes.some((o) => normalizarCategoria(o.rotulo) === normalizarCategoria(busca));

  function escolher(v: string) {
    onChange(v);
    setDigitando(null);
    setAberto(false);
  }

  return (
    <div ref={caixa} className={`relative ${className}`}>
      <div className="relative">
        <input
          id={id}
          value={textoCampo}
          onChange={(e) => { setDigitando(e.target.value); setAberto(true); }}
          onFocus={() => setAberto(true)}
          onClick={() => setAberto(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setAberto(false); setDigitando(null); }
            // Enter confirma o texto digitado como categoria nova
            if (e.key === "Enter" && permitirNova && busca && !jaExiste) {
              e.preventDefault();
              escolher(busca);
            }
          }}
          maxLength={60}
          autoComplete="off"
          role="combobox"
          aria-expanded={aberto}
          placeholder={placeholder}
          className="w-full pl-3 pr-16 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
          {(valor || digitando) && (
            <button
              type="button"
              onClick={() => escolher("")}
              className="size-7 grid place-items-center text-zinc-400 hover:text-zinc-700 transition"
              title="Limpar"
            >
              <X className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => { setAberto((a) => !a); setDigitando(null); }}
            className="size-7 grid place-items-center text-zinc-400 hover:text-zinc-700 transition"
            aria-label={aberto ? "Fechar lista" : "Ver todas as categorias"}
          >
            <ChevronDown className={`size-4 transition ${aberto ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {aberto && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-zinc-200 rounded-lg shadow-lg py-1"
        >
          <li>
            <button
              type="button"
              onClick={() => escolher("")}
              className="w-full text-left px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-50 transition"
            >
              {rotuloVazio}
            </button>
          </li>

          {filtradas.map((o) => {
            const ativa = normalizarCategoria(o.valor) === normalizarCategoria(valor);
            return (
              <li key={o.valor}>
                <button
                  type="button"
                  role="option"
                  aria-selected={ativa}
                  onClick={() => escolher(o.valor)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition ${
                    ativa ? "bg-brand/10 text-brand font-medium" : "text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  <span className="truncate">{o.rotulo}</span>
                  {ativa && <Check className="size-3.5 shrink-0" />}
                </button>
              </li>
            );
          })}

          {/* Só oferece criar quando não bate com nenhuma existente — senão o
              gestor cria uma segunda "Higiene e Beleza" achando que é nova. */}
          {permitirNova && busca && !jaExiste && (
            <li className="border-t border-zinc-100 mt-1 pt-1">
              <button
                type="button"
                onClick={() => escolher(busca)}
                className="w-full text-left px-3 py-2 text-sm text-brand font-medium hover:bg-brand/5 transition"
              >
                Criar “{busca}”
              </button>
            </li>
          )}

          {filtradas.length === 0 && !permitirNova && (
            <li className="px-3 py-2 text-xs text-zinc-400">Nenhuma categoria encontrada.</li>
          )}
          {opcoes.length === 0 && permitirNova && (
            <li className="px-3 py-2 text-xs text-zinc-400">
              Nenhuma categoria ainda — digite para criar a primeira.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
