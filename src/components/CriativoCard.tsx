import { createContext, useContext, useMemo, useRef } from "react";
import { ImageIcon, ShoppingCart, CalendarDays } from "lucide-react";
import {
  AJUSTE_ZERO, ajusteNeutro,
  type AjusteElemento, type AjustesCriativo, type AlvoCriativo,
} from "@/lib/ajustesCriativo";

export type { AjusteElemento, AjustesCriativo, AlvoCriativo };

// Layout = o design (elementos). Enquadramento = a proporção (formato).
export type LayoutCriativo = "azul" | "banner" | "destaque" | "vermelho";
export type Enquadramento = "4:5" | "1:1" | "9:16";

const ASPECTO: Record<Enquadramento, string> = {
  "4:5":  "aspect-[4/5]",
  "1:1":  "aspect-square",
  "9:16": "aspect-[9/16]",
};

/** Ligada só pela tela de edição: seleção, contorno e arrasto dos elementos. */
export interface EdicaoCriativo {
  selecionado: AlvoCriativo | null;
  onSelecionar: (alvo: AlvoCriativo) => void;
  /** Deltas já convertidos para % da largura do criativo. */
  onMover: (alvo: AlvoCriativo, dx: number, dy: number) => void;
}

export interface CriativoDados {
  nome: string;
  preco: string;
  /** Preço "de" (riscado) — quando a oferta é DE/POR. Vazio = só o preço. */
  precoDe?: string;
  imagem?: string | null;
  localizacao: string;      // nome da farmácia / localização (barra inferior — layout azul)
  layout: LayoutCriativo;
  enquadramento: Enquadramento;
  titulo?: string;          // título do topo (layout banner) — ex: "FECHA MÊS"
  subtitulo?: string;       // datas/subtítulo (layout banner) — ex: "DIAS 29 A 31"
  /** Ajuste fino feito na tela de edição. Ausente = arte no lugar padrão. */
  ajustes?: AjustesCriativo;
}

/**
 * REGRA DO CRIATIVO: todo tamanho aqui é proporcional à largura do card (`cqw`).
 *
 * O card é renderizado com ~235px na preview e com 1080px na hora de exportar o
 * PNG. Enquanto as caixas e faixas eram em `%`, os textos usavam
 * `clamp(min_px, Xcqw, MAX_px)` — e no export TODOS batiam no teto em px: o
 * título saía com 66% do tamanho certo, o preço do layout azul com 48%. Daí a
 * preview ficar correta e o PNG sair com o texto encolhido dentro de caixas do
 * tamanho normal.
 *
 * Por isso não entra px em nada que componha o desenho: nem fonte, nem borda,
 * nem sombra, nem raio. Só `cqw`, `%` e `em`. Assim a miniatura, a preview e o
 * PNG de 1080px são a mesma arte em escalas diferentes.
 */

// ── Azul da referência (modelos 1 e 2, com brilho) ────────────────────────────
const AZUL_GRADIENTE = "linear-gradient(180deg, #3f74dd 0%, #0a2c78 100%)";
const AZUL_BORDA = "0.6cqw solid rgba(205, 226, 255, 0.95)";
const AZUL_BRILHO = "0 0 5cqw rgba(90, 150, 255, 0.75), inset 0 0.3cqw 0 rgba(255,255,255,0.28)";

const estiloAzul: React.CSSProperties = {
  background: AZUL_GRADIENTE,
  border: AZUL_BORDA,
  boxShadow: AZUL_BRILHO,
  borderRadius: "10cqw",
};

// ── Cores do Modelo 3 (Banner Oferta) ─────────────────────────────────────────
const NAVY = "#1f3f9e";
const VERM = "#d61f27";

// Mostra só o valor (sem "R$"); vazio vira "0,00"
function valorPreco(preco: string): string {
  const v = preco.replace(/r\$\s*/i, "").replace(/—/g, "").trim();
  return v || "0,00";
}

/**
 * Tamanho da fonte do preço, em cqw, para o valor caber na caixa dele.
 *
 * O tamanho era fixo (21cqw no banner) e não olhava o texto: "R$0,00" já
 * transbordava a caixa vermelha, e cada dígito a mais ("1.299,90") empurrava
 * mais para fora — era o defeito ao lado do zero. Aqui o tamanho cai conforme
 * o preço cresce, e nunca passa do que era antes, para o criativo curto
 * continuar com a mesma cara.
 *
 * Larguras medidas no Chromium com a marcação real (dígito 0.572em, vírgula e
 * ponto 0.286em), com ~12% de folga para variação de fonte e arredondamento.
 */
const LARGURA_DIGITO    = 0.64;
const LARGURA_SEPARADOR = 0.32;

function tamanhoQueCabe(
  valor:      string,
  prefixoEm:  number,   // largura do "R$" / "POR R$" que vem antes do número
  utilCqw:    number,   // largura interna da caixa, em % da largura do card
  maxCqw:     number,   // teto: o tamanho que o design já usava
): number {
  let em = prefixoEm;
  for (const ch of valor) {
    em += ch === "," || ch === "." ? LARGURA_SEPARADOR : LARGURA_DIGITO;
  }
  return Math.min(maxCqw, utilCqw / em);
}

function Imagem({ imagem, nome, className, style }: {
  imagem?: string | null;
  nome: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return imagem
    ? <img src={imagem} alt={nome} className={className} style={style} />
    : <div className={`grid place-items-center bg-zinc-100 ${className}`} style={style}><ImageIcon className="size-8 text-zinc-300" /></div>;
}

// ── Ajuste fino: contexto, arrasto e os invólucros que movem cada peça ────────
//
// Os modelos não sabem que existe edição: eles só trocam o `<div absolute>` de
// cada bloco por `<Movivel alvo="...">`. O que move o bloco é uma transform em
// `cqw`, pela mesma razão de todo o resto do arquivo ser em cqw — a preview de
// 235px e o PNG de 1080px têm de ser a mesma arte.

const CtxCriativo = createContext<{
  ajustes: AjustesCriativo;
  edicao?: EdicaoCriativo;
  /** Largura do card em px, lida na hora do arrasto (preview e export diferem). */
  largura: () => number;
} | null>(null);

function useAjuste(alvo: AlvoCriativo): AjusteElemento {
  return useContext(CtxCriativo)?.ajustes[alvo] ?? AJUSTE_ZERO;
}

/** `undefined` quando a peça está no lugar padrão — sem transform à toa. */
function transformDe(a: AjusteElemento): string | undefined {
  if (ajusteNeutro(a)) return undefined;
  return `translate(${a.x}cqw, ${a.y}cqw) scale(${a.escala})`;
}

/**
 * Seleção + arrasto de uma peça. Fora da tela de edição devolve objeto vazio,
 * e o criativo sai exatamente como antes.
 *
 * O contorno é o ÚNICO lugar do arquivo com px: ele é interface da edição, não
 * desenho — não entra no PNG, e em cqw ficaria grosso demais na tela grande.
 */
function useEdicao(alvo: AlvoCriativo): {
  style?: React.CSSProperties;
  onPointerDown?: (e: React.PointerEvent<HTMLElement>) => void;
} {
  const ctx = useContext(CtxCriativo);
  const ed = ctx?.edicao;
  if (!ctx || !ed) return {};

  const selecionado = ed.selecionado === alvo;
  return {
    style: {
      cursor: "move",
      touchAction: "none",
      // Tracejado azul-claro na peça ociosa: é a única cor que aparece tanto
      // sobre foto clara quanto sobre as caixas vermelhas e azuis dos modelos.
      outline: selecionado ? "2px solid var(--brand)" : "1px dashed rgba(56, 189, 248, 0.9)",
      outlineOffset: "1px",
    },
    onPointerDown: (e) => {
      // Sem isto, arrastar o preço também arrastaria a foto que está atrás.
      e.stopPropagation();
      e.preventDefault();
      ed.onSelecionar(alvo);

      const largura = ctx.largura();
      if (!largura) return;

      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      let ultimoX = e.clientX;
      let ultimoY = e.clientY;

      const mover = (ev: PointerEvent) => {
        ed.onMover(alvo, ((ev.clientX - ultimoX) / largura) * 100, ((ev.clientY - ultimoY) / largura) * 100);
        ultimoX = ev.clientX;
        ultimoY = ev.clientY;
      };
      const soltar = () => {
        el.removeEventListener("pointermove", mover);
        el.removeEventListener("pointerup", soltar);
        el.removeEventListener("pointercancel", soltar);
      };
      el.addEventListener("pointermove", mover);
      el.addEventListener("pointerup", soltar);
      el.addEventListener("pointercancel", soltar);
    },
  };
}

/** Bloco do desenho que o gestor pode empurrar e redimensionar. */
function Movivel({ alvo, className, style, children }: {
  alvo: AlvoCriativo;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const ajuste = useAjuste(alvo);
  const edicao = useEdicao(alvo);
  return (
    <div
      className={className}
      style={{ ...style, transform: transformDe(ajuste), ...edicao.style }}
      onPointerDown={edicao.onPointerDown}
    >
      {children}
    </div>
  );
}

/**
 * Foto do produto ocupando o criativo inteiro.
 *
 * Aqui a transform vai na <img>, e não no quadro: o quadro é o recorte e tem de
 * ficar parado, senão empurrar a foto deixaria uma faixa vazia na borda. Com
 * escala abaixo de 1 o produto encolhe dentro do criativo e o que sobra é
 * branco — é justamente o que se quer quando a foto é maior que a arte.
 */
function Foto({ imagem, nome }: { imagem?: string | null; nome: string }) {
  const ajuste = useAjuste("foto");
  const edicao = useEdicao("foto");
  return (
    <div
      className="absolute inset-0 overflow-hidden bg-white"
      style={edicao.style}
      onPointerDown={edicao.onPointerDown}
    >
      <Imagem imagem={imagem} nome={nome} className="size-full object-cover" style={{ transform: transformDe(ajuste) }} />
    </div>
  );
}

// ── Modelo 3: Banner Oferta ────────────────────────────────────────────────────
function ModeloBanner({ nome, preco, precoDe, imagem, titulo, subtitulo }: CriativoDados) {
  // Caixa vermelha: bloco de 38% do card, menos o px-[4%] dos dois lados.
  // Os três números andam juntos com o w-[38%] lá embaixo: encolher a caixa sem
  // baixar `utilCqw` e `maxCqw` faz o preço transbordar de novo.
  const tamanho = tamanhoQueCabe(valorPreco(preco), 0.60, 35, 17.5);
  return (
    <>
      <Foto imagem={imagem} nome={nome} />

      {/* Título (faixa azul no topo) */}
      <Movivel alvo="titulo" className="absolute top-[3.5%] left-[5%] right-[5%]">
        <div className="rounded-full py-[2.5%] px-[4%] text-center"
             style={{ background: NAVY, border: "0.85cqw solid #fff", boxShadow: "0 1.1cqw 3.3cqw rgba(0,0,0,.18)" }}>
          <span className="block text-white font-black uppercase leading-none tracking-tight"
                style={{ fontSize: "13cqw" }}>
            {titulo || "FECHA MÊS"}
          </span>
        </div>
      </Movivel>

      {/* Subtítulo / datas (pílula branca) */}
      <Movivel alvo="subtitulo" className="absolute top-[15%] left-[15%] right-[15%]">
        <div className="rounded-full py-[1.4%] px-[3%] text-center bg-white"
             style={{ boxShadow: "0 0.8cqw 2.2cqw rgba(0,0,0,.14)" }}>
          <span className="block font-black uppercase leading-none tracking-tight"
                style={{ color: VERM, fontSize: "6cqw" }}>
            {subtitulo || "DIAS 00 A 00"}
          </span>
        </div>
      </Movivel>

      {/* Preço (bloco embaixo-direita) */}
      <Movivel alvo="preco" className="absolute bottom-[3.5%] right-[3.5%] w-[38%] flex flex-col items-center">
        <div className="rounded-full px-[7%] py-[1.6%] relative z-10"
             style={{ background: NAVY, border: "0.55cqw solid #fff", marginBottom: "-4%" }}>
          <span className="block text-white font-black uppercase leading-none"
                style={{ fontSize: "4.2cqw" }}>
            POR APENAS
          </span>
        </div>
        <div className="w-full px-[4%] pt-[7%] pb-[4%] text-center" style={{ background: VERM, borderRadius: "5cqw" }}>
          {precoDe && (
            <span className="block text-white font-bold uppercase leading-none line-through"
                  style={{ fontSize: "3.8cqw", opacity: 0.9, marginBottom: "1.5%" }}>
              De R${valorPreco(precoDe)}
            </span>
          )}
          <span className="text-white font-black leading-none inline-flex items-start justify-center whitespace-nowrap"
                style={{ fontSize: `${tamanho.toFixed(2)}cqw` }}>
            <span style={{ fontSize: "0.42em" }} className="mt-[0.35em] mr-[0.05em]">R$</span>
            {valorPreco(preco)}
          </span>
        </div>
      </Movivel>

      {/* Rodapé vermelho/azul */}
      <div className="absolute bottom-0 left-0 right-0 flex" style={{ height: "1.6%" }}>
        <div className="w-1/2" style={{ background: VERM }} />
        <div className="w-1/2" style={{ background: NAVY }} />
      </div>
    </>
  );
}

// ── Modelo 4: Destaque ───────────────────────────────────────────────────────
// Foto de fundo inteira, caixa de preço grande no meio, o nome da farmácia em
// duas linhas e a validade da oferta numa faixa no rodapé.
//
// O bloco de baixo é uma PILHA em fluxo normal ancorada no rodapé, não um monte
// de `absolute` com `bottom` em %: a altura dele vem das fontes, que são em cqw
// (proporcionais à largura). Com `bottom` fixo, trocar o enquadramento de 4:5
// para 9:16 abriria um buraco entre o preço e a farmácia — empilhado, o
// espaçamento acompanha a arte em qualquer proporção.
const AMARELO = "#ffd200";
const AZUL_FUNDO = "#0a2c78";

/** O "- - -" amarelo que ladeia os textos do rodapé. */
function TracoAmarelo({ altura = "0.7cqw" }: { altura?: string }) {
  return (
    <div
      className="flex-1"
      style={{
        height: altura,
        backgroundImage: `repeating-linear-gradient(90deg, ${AMARELO} 0 2cqw, transparent 2cqw 4cqw)`,
      }}
    />
  );
}

/** "16,99" -> { inteiro: "16", centavos: "99" }. Sem centavos, devolve tudo em `inteiro`. */
function partesPreco(preco: string): { inteiro: string; centavos: string } {
  const v = valorPreco(preco);
  const m = v.match(/^(.*?)[.,](\d{1,2})$/);
  return m ? { inteiro: m[1], centavos: m[2] } : { inteiro: v, centavos: "" };
}

/**
 * Bloco de preço "POR APENAS" + valor com os centavos elevados.
 *
 * Vive fora dos modelos porque o Padrão e o Destaque mostram o MESMO preço —
 * era para ser a mesma coisa desenhada duas vezes, e duas cópias divergem na
 * primeira correção que alguém fizer só num lado.
 *
 * `utilCqw` é a largura interna de quem chama (a caixa já sem o padding dela) e
 * `maxCqw` é o teto do design daquele modelo: o valor encolhe conforme cresce,
 * senão "1.299,90" vaza a caixa.
 */
function BlocoPreco({
  preco, precoDe, utilCqw, maxCqw, rotuloCqw, deCqw,
}: {
  preco: string;
  precoDe?: string;
  utilCqw: number;
  maxCqw: number;
  rotuloCqw: number;
  deCqw: number;
}) {
  const { inteiro, centavos } = partesPreco(preco);
  // Largura ocupada: "R$" (0.40em) + dígitos + vírgula + centavos (0.55em).
  let em = 0.46;
  for (const ch of inteiro) em += ch === "." ? LARGURA_SEPARADOR : LARGURA_DIGITO;
  if (centavos) em += LARGURA_SEPARADOR + centavos.length * LARGURA_DIGITO * 0.55;
  const tamanho = Math.min(maxCqw, utilCqw / em);

  return (
    <>
      <span className="block text-white font-black uppercase leading-none" style={{ fontSize: `${rotuloCqw}cqw` }}>
        POR APENAS
      </span>
      {precoDe && (
        <span
          className="block text-white font-bold uppercase leading-none line-through"
          style={{ fontSize: `${deCqw}cqw`, opacity: 0.85, marginTop: "2%" }}
        >
          De R${valorPreco(precoDe)}
        </span>
      )}
      <span
        className="text-white font-black leading-none inline-flex items-start justify-center whitespace-nowrap"
        style={{ fontSize: `${tamanho.toFixed(2)}cqw`, marginTop: "2.5%" }}
      >
        <span style={{ fontSize: "0.40em" }} className="mt-[0.85em] mr-[0.06em]">R$</span>
        {inteiro}
        {centavos && (
          <>
            ,<span style={{ fontSize: "0.55em" }}>{centavos}</span>
          </>
        )}
      </span>
    </>
  );
}

/**
 * Quebra o nome da farmácia em duas linhas: "DROGARIA BEM ESTAR" vira
 * "DROGARIA" em cima e "BEM ESTAR" embaixo. Nome de uma palavra só devolve a
 * linha de cima vazia, para quem desenha não abrir um espaço à toa.
 */
function duasLinhas(localizacao?: string): { topo: string; nome: string } {
  const farmacia = (localizacao || "Sua Farmácia").trim();
  const partes = farmacia.split(/\s+/);
  return partes.length > 1
    ? { topo: partes[0], nome: partes.slice(1).join(" ") }
    : { topo: "", nome: farmacia };
}

function ModeloDestaque({ nome, preco, precoDe, imagem, localizacao, subtitulo }: CriativoDados) {
  const { topo: linhaTopo, nome: linhaNome } = duasLinhas(localizacao);
  // Nome comprido tem de encolher, senão vaza a largura do card.
  const fonteNome = Math.min(6.6, 66 / Math.max(linhaNome.length, 7));

  const validade = (subtitulo || "").trim();

  return (
    <>
      <Foto imagem={imagem} nome={nome} />

      {/* Preço no canto de cima — mesma posição, largura e caixa do modelo
          Padrão, de propósito: os dois modelos mostram o preço no mesmo lugar,
          e quem edita um espera achar o outro igual. */}
      <Movivel alvo="preco" className="absolute top-[3.5%] left-[4%] w-[58%]">
        <div className="px-[4%] py-[3%] text-center" style={estiloAzul}>
          <BlocoPreco preco={preco} precoDe={precoDe} utilCqw={52} maxCqw={13} rotuloCqw={4.4} deCqw={3} />
        </div>
      </Movivel>

      {/* O rodapé é o que sobra do modelo: farmácia, arco e validade. Sem a
          caixa de preço aqui, a foto fica livre do meio para cima. */}
      <Movivel alvo="rodape" className="absolute inset-x-0 bottom-0">
        {/* Véu: o rodapé encosta na foto sem corte seco */}
        <div
          className="absolute bottom-full inset-x-0"
          style={{ height: "16cqw", background: "linear-gradient(180deg, rgba(10,44,120,0) 0%, rgba(10,44,120,.8) 100%)" }}
        />

        {/* Farmácia */}
        <div className="px-[7%] pt-[3.5%] pb-[3%]" style={{ background: AZUL_FUNDO }}>
          {linhaTopo && (
            <div className="flex items-center gap-[3%]">
              <TracoAmarelo />
              <span
                className="text-white font-bold uppercase leading-none tracking-wide whitespace-nowrap"
                style={{ fontSize: "4cqw" }}
              >
                {linhaTopo}
              </span>
              <TracoAmarelo />
            </div>
          )}
          <div className="flex items-center justify-center gap-[3%]" style={{ marginTop: linhaTopo ? "1.5%" : 0 }}>
            <span
              className="text-white font-black uppercase leading-none tracking-tight text-center break-words"
              style={{ fontSize: `${fonteNome.toFixed(2)}cqw` }}
            >
              {linhaNome}
            </span>
            <ShoppingCart
              color={AMARELO}
              strokeWidth={2.5}
              style={{ width: "5.6cqw", height: "5.6cqw", flexShrink: 0 }}
            />
          </div>
        </div>

        {/* Arco amarelo */}
        <div style={{ height: "2.2cqw", background: AMARELO, borderRadius: "50% 50% 0 0 / 100% 100% 0 0" }} />

        {/* Validade — sem data preenchida, a faixa não sai */}
        {validade && (
          <div
            className="flex items-center justify-center gap-[2.5%] px-[6%] py-[1.5%]"
            style={{ background: AZUL_FUNDO }}
          >
            <TracoAmarelo altura="0.6cqw" />
            <CalendarDays
              color={AMARELO}
              strokeWidth={2.5}
              style={{ width: "3.4cqw", height: "3.4cqw", flexShrink: 0 }}
            />
            <span
              className="font-black uppercase leading-none whitespace-nowrap"
              style={{ color: AMARELO, fontSize: "2.9cqw" }}
            >
              Oferta válida até {validade}
            </span>
            <TracoAmarelo altura="0.6cqw" />
          </div>
        )}
      </Movivel>
    </>
  );
}

// ── Modelo 5: Vermelho ───────────────────────────────────────────────────────
// Faixa vermelha com a farmácia no topo, foto ocupando o miolo, preço numa
// caixa vermelha embaixo e uma tarja preta com o aviso da oferta no pé.
//
// Ao contrário do Destaque, o preço aqui é UMA linha ("POR R$14,99"): é o que a
// arte de referência faz, e caixa larga e baixa não comporta valor gigante com
// centavos elevados sem estourar a altura.
const VERMELHO_GRADIENTE = "linear-gradient(180deg, #f2353c 0%, #cf1a22 100%)";
const VERMELHO_BRILHO = "0 0 5cqw rgba(242, 60, 68, 0.65), inset 0 0.3cqw 0 rgba(255,255,255,0.25)";

const estiloVermelho: React.CSSProperties = {
  background: VERMELHO_GRADIENTE,
  border: "0.7cqw solid #fff",
  boxShadow: VERMELHO_BRILHO,
  borderRadius: "4.5cqw",
};

function ModeloVermelho({ nome, preco, precoDe, imagem, localizacao, subtitulo }: CriativoDados) {
  const { topo: linhaTopo, nome: linhaNome } = duasLinhas(localizacao);
  // Nome comprido encolhe; o teto é o tamanho da arte de referência.
  const fonteNome = Math.min(7.2, 72 / Math.max(linhaNome.length, 9));
  // Caixa de 68% do card menos o px-[5%] dela; o prefixo é o "POR R$" inteiro.
  const tamanho = tamanhoQueCabe(valorPreco(preco), 3.6, 58, 9);
  const aviso = (subtitulo || "").trim();

  return (
    <>
      <Foto imagem={imagem} nome={nome} />

      {/* Farmácia — faixa do topo */}
      <Movivel alvo="titulo" className="absolute top-[4%] left-[13%] right-[13%]">
        <div className="px-[4%] py-[2.4%] text-center" style={estiloVermelho}>
          {linhaTopo && (
            <span
              className="block text-white font-black uppercase leading-none tracking-tight"
              style={{ fontSize: `${fonteNome.toFixed(2)}cqw` }}
            >
              {linhaTopo}
            </span>
          )}
          <span
            className="block text-white font-black uppercase leading-none tracking-tight break-words"
            style={{ fontSize: `${fonteNome.toFixed(2)}cqw`, marginTop: linhaTopo ? "2%" : 0 }}
          >
            {linhaNome}
          </span>
        </div>
      </Movivel>

      {/* Preço — caixa de baixo. Sobe quando há tarja, para não encostar nela. */}
      <Movivel alvo="preco" className="absolute left-[16%] right-[16%]" style={{ bottom: aviso ? "9%" : "4%" }}>
        <div className="px-[5%] py-[2%] text-center" style={estiloVermelho}>
          {precoDe && (
            <span
              className="block text-white font-bold uppercase leading-none line-through"
              style={{ fontSize: "4cqw", opacity: 0.9, marginBottom: "1.5%" }}
            >
              De R${valorPreco(precoDe)}
            </span>
          )}
          <span
            className="block text-white font-black uppercase leading-none tracking-tight whitespace-nowrap"
            style={{ fontSize: `${tamanho.toFixed(2)}cqw` }}
          >
            POR R${valorPreco(preco)}
          </span>
        </div>
      </Movivel>

      {/* Aviso — tarja preta no pé. Sem texto, a tarja não sai. */}
      {aviso && (
        <Movivel alvo="rodape" className="absolute bottom-0 inset-x-0 bg-black px-[4%] py-[1.3%]">
          <span
            className="block text-white font-bold uppercase leading-tight text-center"
            style={{ fontSize: "2.8cqw" }}
          >
            {aviso}
          </span>
        </Movivel>
      )}
    </>
  );
}

// ── Modelos 1 e 2: foto + pílula de preço azul + barra da farmácia ────────────
function ModeloAzul({ nome, preco, precoDe, imagem, localizacao }: CriativoDados) {
  const farmacia = localizacao || "Sua Farmácia";
  return (
    <>
      <Foto imagem={imagem} nome={nome} />

      {/* Caixa de preço no topo — a MESMA do modelo Destaque (BlocoPreco).
          Cresceu de 52% para 58% do card porque o valor agora é grande: na
          largura antiga, preço de quatro dígitos encolhia até ficar ilegível.
          O `utilCqw` acompanha esse 58% menos o px-[4%] de cada lado. */}
      <Movivel alvo="preco" className="absolute top-[3.5%] left-[4%] w-[58%]">
        <div className="px-[4%] py-[3%] text-center" style={estiloAzul}>
          <BlocoPreco preco={preco} precoDe={precoDe} utilCqw={52} maxCqw={13} rotuloCqw={4.4} deCqw={3} />
        </div>
      </Movivel>

      {/* Barra inferior: farmácia */}
      <Movivel alvo="rodape" className="absolute bottom-[3%] left-[6%] right-[6%]">
        <div className="flex items-center justify-center px-[5%] py-[2.8%]" style={estiloAzul}>
          <span className="text-white font-black uppercase leading-tight tracking-tight break-words text-center"
                style={{ fontSize: "5.4cqw" }}>
            {farmacia}
          </span>
        </div>
      </Movivel>
    </>
  );
}

/**
 * Criativo de oferta. `layout` define o design (azul | banner) e
 * `enquadramento` define a proporção (4:5 | 1:1 | 9:16).
 *
 * `edicao` só é passada pela tela de ajuste fino; a prévia, a miniatura e o
 * export renderizam o mesmo componente sem ela.
 */
export function CriativoCard(props: CriativoDados & { edicao?: EdicaoCriativo }) {
  const raiz = useRef<HTMLDivElement>(null);
  const ctx = useMemo(
    () => ({
      ajustes: props.ajustes ?? {},
      edicao: props.edicao,
      largura: () => raiz.current?.getBoundingClientRect().width ?? 0,
    }),
    [props.ajustes, props.edicao],
  );

  return (
    <CtxCriativo.Provider value={ctx}>
      <div
        ref={raiz}
        className={`relative w-full ${ASPECTO[props.enquadramento]} rounded-xl overflow-hidden bg-zinc-200`}
        style={{ containerType: "inline-size" }}
      >
        {props.layout === "banner"
          ? <ModeloBanner {...props} />
          : props.layout === "destaque"
            ? <ModeloDestaque {...props} />
            : props.layout === "vermelho"
              ? <ModeloVermelho {...props} />
              : <ModeloAzul {...props} />}
      </div>
    </CtxCriativo.Provider>
  );
}

// Miniatura usada nos seletores do modal (layout e enquadramento)
export function ModeloThumb({ layout, enquadramento = "4:5" }: { layout: LayoutCriativo; enquadramento?: Enquadramento }) {
  return (
    <div className="w-full pointer-events-none" style={{ containerType: "inline-size" }}>
      <CriativoCard
        layout={layout}
        enquadramento={enquadramento}
        nome="Produto exemplo"
        preco="9,90"
        imagem={null}
        localizacao="Sua Farmácia"
        titulo="FECHA MÊS"
        subtitulo={
          layout === "destaque" ? "00/00"
          : layout === "vermelho" ? "OFERTA VÁLIDA ATÉ 00/00"
          : "DIAS 29 A 31"
        }
      />
    </div>
  );
}
