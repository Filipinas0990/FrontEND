import { useEffect, useMemo, useRef, useState } from "react";
import {
  X, RotateCcw, Move, Image as ImageIcon, Tag, Type, PanelBottom, Grid3x3, Check,
} from "lucide-react";
import { CriativoCard, type CriativoDados, type LayoutCriativo, type Enquadramento } from "@/components/CriativoCard";
import {
  AJUSTE_ZERO, ajusteNeutro, arredondar, prender, pecasAjustadas,
  type AjusteElemento, type AjustesCriativo, type AlvoCriativo,
} from "@/lib/ajustesCriativo";

/**
 * Tela grande de ajuste fino do criativo.
 *
 * A prévia da lista é pequena demais para acertar posição no olho: aqui o
 * criativo aparece do tamanho da tela, cada peça é arrastável e os mesmos
 * números aparecem em campo — arrastar resolve o grosso, seta e campo resolvem
 * o milímetro. Tudo é % da largura do criativo, então o que se vê aqui é o que
 * sai no PNG de 1080px e no disparo.
 */

const PROPORCAO: Record<Enquadramento, number> = {
  "4:5": 4 / 5,
  "1:1": 1,
  "9:16": 9 / 16,
};

/** Só o que cada modelo realmente desenha — peça que não existe não vira botão. */
const ELEMENTOS: Record<LayoutCriativo, { alvo: AlvoCriativo; rotulo: string; icone: typeof Move }[]> = {
  azul: [
    { alvo: "foto",   rotulo: "Foto do produto",   icone: ImageIcon },
    { alvo: "preco",  rotulo: "Caixa de preço",    icone: Tag },
    { alvo: "rodape", rotulo: "Barra da farmácia", icone: PanelBottom },
  ],
  banner: [
    { alvo: "foto",      rotulo: "Foto do produto",  icone: ImageIcon },
    { alvo: "titulo",    rotulo: "Faixa do título",  icone: Type },
    { alvo: "subtitulo", rotulo: "Pílula das datas", icone: Type },
    { alvo: "preco",     rotulo: "Bloco de preço",   icone: Tag },
  ],
  destaque: [
    { alvo: "foto",   rotulo: "Foto do produto",           icone: ImageIcon },
    { alvo: "preco",  rotulo: "Caixa de preço",            icone: Tag },
    { alvo: "rodape", rotulo: "Rodapé (farmácia e data)",  icone: PanelBottom },
  ],
  vermelho: [
    { alvo: "foto",   rotulo: "Foto do produto",   icone: ImageIcon },
    { alvo: "titulo", rotulo: "Faixa da farmácia", icone: Type },
    { alvo: "preco",  rotulo: "Caixa de preço",    icone: Tag },
    { alvo: "rodape", rotulo: "Tarja do aviso",    icone: PanelBottom },
  ],
};

const LIMITE_POS = 80;    // % da largura — além disso a peça já saiu da arte
const ESCALA_MIN = 0.4;
const ESCALA_MAX = 2.5;

/**
 * Campo numérico com passo nos botões — o teclado dá o valor exato.
 *
 * O texto é estado próprio, e só volta a seguir o número quando o campo perde
 * o foco: campo controlado direto pelo número não deixa digitar "-" nem "1,"
 * (não viram número, a tecla some) e reescreve o que se está digitando a cada
 * arredondamento.
 */
function Campo({ rotulo, valor, passo, min, max, sufixo, onChange }: {
  rotulo: string;
  valor: number;
  passo: number;
  min: number;
  max: number;
  sufixo: string;
  onChange: (v: number) => void;
}) {
  const [texto, setTexto] = useState(String(valor));
  const focado = useRef(false);

  useEffect(() => {
    if (!focado.current) setTexto(String(valor));
  }, [valor]);

  return (
    <div>
      <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-1">
        {rotulo}
      </label>
      <div className="flex items-stretch rounded-lg ring-1 ring-zinc-200 overflow-hidden bg-white">
        <button
          type="button"
          onClick={() => onChange(prender(arredondar(valor - passo), min, max))}
          className="px-2.5 text-zinc-500 hover:bg-zinc-100 text-sm font-semibold"
        >
          −
        </button>
        <div className="flex-1 flex items-center justify-center gap-0.5 border-x border-zinc-200">
          <input
            type="number"
            value={texto}
            step={passo}
            onFocus={() => { focado.current = true; }}
            onBlur={() => { focado.current = false; setTexto(String(valor)); }}
            onChange={(e) => {
              setTexto(e.target.value);
              const n = Number(e.target.value);
              if (e.target.value.trim() !== "" && !Number.isNaN(n)) {
                onChange(prender(arredondar(n), min, max));
              }
            }}
            className="w-14 py-1.5 text-center text-sm text-zinc-800 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-[11px] text-zinc-400 pr-1">{sufixo}</span>
        </div>
        <button
          type="button"
          onClick={() => onChange(prender(arredondar(valor + passo), min, max))}
          className="px-2.5 text-zinc-500 hover:bg-zinc-100 text-sm font-semibold"
        >
          +
        </button>
      </div>
    </div>
  );
}

interface Props {
  dados: CriativoDados;
  /** Rótulo do cabeçalho — o nome do produto. */
  titulo: string;
  onSalvar: (ajustes: AjustesCriativo) => void;
  onFechar: () => void;
}

export function EditorCriativoModal({ dados, titulo, onSalvar, onFechar }: Props) {
  const elementos = ELEMENTOS[dados.layout] ?? ELEMENTOS.azul;

  const [ajustes, setAjustes] = useState<AjustesCriativo>(dados.ajustes ?? {});
  const [selecionado, setSelecionado] = useState<AlvoCriativo>(elementos[0].alvo);
  const [grade, setGrade] = useState(false);

  const atual = ajustes[selecionado] ?? AJUSTE_ZERO;

  const mudar = (alvo: AlvoCriativo, campo: Partial<AjusteElemento>) =>
    setAjustes((a) => ({ ...a, [alvo]: { ...(a[alvo] ?? AJUSTE_ZERO), ...campo } }));

  const empurrar = (alvo: AlvoCriativo, dx: number, dy: number) =>
    setAjustes((a) => {
      const base = a[alvo] ?? AJUSTE_ZERO;
      return {
        ...a,
        [alvo]: {
          ...base,
          x: prender(arredondar(base.x + dx), -LIMITE_POS, LIMITE_POS),
          y: prender(arredondar(base.y + dy), -LIMITE_POS, LIMITE_POS),
        },
      };
    });

  const edicao = useMemo(
    () => ({
      selecionado,
      onSelecionar: (alvo: AlvoCriativo) => setSelecionado(alvo),
      onMover: (alvo: AlvoCriativo, dx: number, dy: number) => empurrar(alvo, dx, dy),
    }),
    [selecionado],
  );

  // Teclado: seta empurra 0,2% (2px no PNG) e com Shift 1%; + e − mudam o
  // tamanho. É por isso que a tela existe — mouse não acerta esse passo.
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") { onFechar(); return; }
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA")) return;

      const passo = e.shiftKey ? 1 : 0.2;
      const setas: Record<string, [number, number]> = {
        ArrowLeft:  [-passo, 0],
        ArrowRight: [passo, 0],
        ArrowUp:    [0, -passo],
        ArrowDown:  [0, passo],
      };
      if (setas[e.key]) {
        e.preventDefault();
        empurrar(selecionado, ...setas[e.key]);
        return;
      }
      if (e.key === "+" || e.key === "=" || e.key === "-" || e.key === "_") {
        e.preventDefault();
        const d = e.key === "-" || e.key === "_" ? -0.02 : 0.02;
        const base = ajustes[selecionado] ?? AJUSTE_ZERO;
        mudar(selecionado, { escala: prender(Number((base.escala + d).toFixed(2)), ESCALA_MIN, ESCALA_MAX) });
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [selecionado, ajustes, onFechar]);

  const mexidos = pecasAjustadas(ajustes);

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-900/80 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Ajustar a arte de ${titulo}`}
    >
      <div className="bg-zinc-50 rounded-2xl shadow-2xl w-full max-w-6xl h-full max-h-[95vh] flex flex-col overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 bg-white border-b border-zinc-200">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900 truncate">Ajustar a arte</p>
            <p className="text-[11px] text-zinc-500 truncate">{titulo}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setGrade((g) => !g)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg ring-1 transition ${
                grade ? "bg-zinc-900 text-white ring-zinc-900" : "bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
              }`}
              title="Linhas de apoio para alinhar no olho"
            >
              <Grid3x3 className="size-3.5" /> Guias
            </button>
            <button
              type="button"
              onClick={onFechar}
              className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
              aria-label="Fechar"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          {/* Palco */}
          <div className="flex-1 min-h-0 grid place-items-center p-4 sm:p-8 overflow-auto bg-[radial-gradient(circle_at_1px_1px,#d4d4d8_1px,transparent_0)] [background-size:16px_16px]">
            <div
              className="relative shadow-xl select-none"
              style={{ height: "min(72vh, 44rem)", aspectRatio: PROPORCAO[dados.enquadramento] }}
            >
              <CriativoCard {...dados} ajustes={ajustes} edicao={edicao} />

              {/* Guias: só na edição, nunca no PNG */}
              {grade && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(to_right,#fbbf24_1px,transparent_1px),linear-gradient(to_bottom,#fbbf24_1px,transparent_1px)] [background-size:10%_8%]" />
                  <div className="absolute left-1/2 inset-y-0 w-px bg-amber-400" />
                  <div className="absolute top-1/2 inset-x-0 h-px bg-amber-400" />
                </div>
              )}
            </div>
          </div>

          {/* Painel */}
          <div className="w-full md:w-80 shrink-0 bg-white border-t md:border-t-0 md:border-l border-zinc-200 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                  Elemento
                </p>
                <div className="space-y-1">
                  {elementos.map(({ alvo, rotulo, icone: Icone }) => {
                    const ativo = selecionado === alvo;
                    const mexido = !ajusteNeutro(ajustes[alvo] ?? AJUSTE_ZERO);
                    return (
                      <button
                        key={alvo}
                        type="button"
                        onClick={() => setSelecionado(alvo)}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition ring-1 ${
                          ativo
                            ? "bg-brand/5 text-brand ring-brand/30"
                            : "bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
                        }`}
                      >
                        <Icone className="size-3.5 shrink-0" />
                        <span className="truncate">{rotulo}</span>
                        {mexido && <span className="ml-auto size-1.5 rounded-full bg-brand shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-zinc-100 pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Campo
                    rotulo="Esquerda / direita"
                    valor={atual.x}
                    passo={0.5}
                    min={-LIMITE_POS}
                    max={LIMITE_POS}
                    sufixo="%"
                    onChange={(v) => mudar(selecionado, { x: v })}
                  />
                  <Campo
                    rotulo="Cima / baixo"
                    valor={atual.y}
                    passo={0.5}
                    min={-LIMITE_POS}
                    max={LIMITE_POS}
                    sufixo="%"
                    onChange={(v) => mudar(selecionado, { y: v })}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">
                      Tamanho
                    </label>
                    <span className="text-[11px] font-semibold text-zinc-700">
                      {Math.round(atual.escala * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={ESCALA_MIN}
                    max={ESCALA_MAX}
                    step={0.01}
                    value={atual.escala}
                    onChange={(e) => mudar(selecionado, { escala: Number(e.target.value) })}
                    className="w-full accent-brand"
                  />
                  <div className="flex gap-1.5 mt-1.5">
                    {[0.75, 0.9, 1, 1.25].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => mudar(selecionado, { escala: v })}
                        className={`flex-1 py-1 text-[11px] font-semibold rounded-md ring-1 transition ${
                          Math.abs(atual.escala - v) < 0.005
                            ? "bg-zinc-900 text-white ring-zinc-900"
                            : "bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
                        }`}
                      >
                        {Math.round(v * 100)}%
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAjustes((a) => ({ ...a, [selecionado]: AJUSTE_ZERO }))}
                  disabled={ajusteNeutro(atual)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg ring-1 ring-zinc-200 text-zinc-600 bg-white hover:bg-zinc-50 disabled:opacity-40 transition"
                >
                  <RotateCcw className="size-3.5" /> Voltar este ao padrão
                </button>
              </div>

              <div className="border-t border-zinc-100 pt-3">
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Arraste a peça na arte, ou use as <strong>setas</strong> do teclado (0,2% por toque;
                  com <strong>Shift</strong>, 1%). <strong>+</strong> e <strong>−</strong> mudam o tamanho.
                </p>
              </div>
            </div>

            {/* Rodapé do painel */}
            <div className="p-3 border-t border-zinc-200 bg-zinc-50 space-y-2">
              <button
                type="button"
                onClick={() => setAjustes({})}
                disabled={mexidos === 0}
                className="w-full py-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-800 disabled:opacity-40 transition"
              >
                Voltar tudo ao padrão
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onFechar}
                  className="flex-1 py-2 text-xs font-semibold rounded-lg ring-1 ring-zinc-200 text-zinc-700 bg-white hover:bg-zinc-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => onSalvar(ajustes)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg bg-brand hover:bg-brand/90 text-white transition shadow-sm"
                >
                  <Check className="size-3.5" /> Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
