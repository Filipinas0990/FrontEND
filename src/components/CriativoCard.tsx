import { ImageIcon } from "lucide-react";

// Layout = o design (elementos). Enquadramento = a proporção (formato).
export type LayoutCriativo = "azul" | "banner";
export type Enquadramento = "4:5" | "1:1" | "9:16";

const ASPECTO: Record<Enquadramento, string> = {
  "4:5":  "aspect-[4/5]",
  "1:1":  "aspect-square",
  "9:16": "aspect-[9/16]",
};

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

function Imagem({ imagem, nome, className }: { imagem?: string | null; nome: string; className?: string }) {
  return imagem
    ? <img src={imagem} alt={nome} className={className} />
    : <div className={`grid place-items-center bg-zinc-100 ${className}`}><ImageIcon className="size-8 text-zinc-300" /></div>;
}

// ── Modelo 3: Banner Oferta ────────────────────────────────────────────────────
function ModeloBanner({ nome, preco, precoDe, imagem, titulo, subtitulo }: CriativoDados) {
  // Caixa vermelha: bloco de 38% do card, menos o px-[4%] dos dois lados.
  // Os três números andam juntos com o w-[38%] lá embaixo: encolher a caixa sem
  // baixar `utilCqw` e `maxCqw` faz o preço transbordar de novo.
  const tamanho = tamanhoQueCabe(valorPreco(preco), 0.60, 35, 17.5);
  return (
    <>
      <Imagem imagem={imagem} nome={nome} className="absolute inset-0 size-full object-cover" />

      {/* Título (faixa azul no topo) */}
      <div className="absolute top-[3.5%] left-[5%] right-[5%]">
        <div className="rounded-full py-[2.5%] px-[4%] text-center"
             style={{ background: NAVY, border: "0.85cqw solid #fff", boxShadow: "0 1.1cqw 3.3cqw rgba(0,0,0,.18)" }}>
          <span className="block text-white font-black uppercase leading-none tracking-tight"
                style={{ fontSize: "13cqw" }}>
            {titulo || "FECHA MÊS"}
          </span>
        </div>
      </div>

      {/* Subtítulo / datas (pílula branca) */}
      <div className="absolute top-[15%] left-[15%] right-[15%]">
        <div className="rounded-full py-[1.4%] px-[3%] text-center bg-white"
             style={{ boxShadow: "0 0.8cqw 2.2cqw rgba(0,0,0,.14)" }}>
          <span className="block font-black uppercase leading-none tracking-tight"
                style={{ color: VERM, fontSize: "6cqw" }}>
            {subtitulo || "DIAS 00 A 00"}
          </span>
        </div>
      </div>

      {/* Preço (bloco embaixo-direita) */}
      <div className="absolute bottom-[3.5%] right-[3.5%] w-[38%] flex flex-col items-center">
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
      </div>

      {/* Rodapé vermelho/azul */}
      <div className="absolute bottom-0 left-0 right-0 flex" style={{ height: "1.6%" }}>
        <div className="w-1/2" style={{ background: VERM }} />
        <div className="w-1/2" style={{ background: NAVY }} />
      </div>
    </>
  );
}

// ── Modelos 1 e 2: foto + pílula de preço azul + barra da farmácia ────────────
function ModeloAzul({ nome, preco, precoDe, imagem, localizacao }: CriativoDados) {
  const farmacia = localizacao || "Sua Farmácia";
  // Pílula de 52% do card menos o px-[4%]; o prefixo aqui é o "POR R$" inteiro.
  // Os três números acompanham o w-[52%] abaixo — ver a nota do ModeloBanner.
  const tamanho = tamanhoQueCabe(valorPreco(preco), 3.7, 46, 7.4);
  return (
    <>
      <Imagem imagem={imagem} nome={nome} className="absolute inset-0 size-full object-cover" />

      {/* Pílula de preço no topo */}
      <div className="absolute top-[3.5%] left-[4%] w-[52%]">
        <div className="px-[4%] py-[3%] text-center" style={estiloAzul}>
          {precoDe && (
            <span className="block text-white font-bold uppercase leading-none line-through"
                  style={{ fontSize: "4.2cqw", opacity: 0.85, marginBottom: "2.5%" }}>
              De R${valorPreco(precoDe)}
            </span>
          )}
          <span className="block text-white font-black uppercase leading-none tracking-tight whitespace-nowrap"
                style={{ fontSize: `${tamanho.toFixed(2)}cqw` }}>
            POR R${valorPreco(preco)}
          </span>
        </div>
      </div>

      {/* Barra inferior: farmácia */}
      <div className="absolute bottom-[3%] left-[6%] right-[6%]">
        <div className="flex items-center justify-center px-[5%] py-[2.8%]" style={estiloAzul}>
          <span className="text-white font-black uppercase leading-tight tracking-tight break-words text-center"
                style={{ fontSize: "5.4cqw" }}>
            {farmacia}
          </span>
        </div>
      </div>
    </>
  );
}

/**
 * Criativo de oferta. `layout` define o design (azul | banner) e
 * `enquadramento` define a proporção (4:5 | 1:1 | 9:16).
 */
export function CriativoCard(props: CriativoDados) {
  return (
    <div
      className={`relative w-full ${ASPECTO[props.enquadramento]} rounded-xl overflow-hidden bg-zinc-200`}
      style={{ containerType: "inline-size" }}
    >
      {props.layout === "banner" ? <ModeloBanner {...props} /> : <ModeloAzul {...props} />}
    </div>
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
        subtitulo="DIAS 29 A 31"
      />
    </div>
  );
}
