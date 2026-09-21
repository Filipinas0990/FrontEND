import { useEffect, useRef, useState } from "react";
import type { Circle, LatLngBoundsLiteral, Map as MapaLeaflet, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Mapa da segmentação geográfica, no espírito do Gerenciador de Anúncios do Meta:
 * um pino no centro da cidade e o círculo do raio escolhido.
 *
 * Sem cidade (`centro = null`) o mapa mostra o Brasil inteiro, que é exatamente
 * como a campanha sai nesse caso — o gestor vê a área desde o começo, antes de
 * escolher qualquer coisa. Escolheu a cidade, o mapa voa até ela.
 *
 * É só visualização — o Meta segmenta pela "key" da cidade + raio em km
 * (`geo_locations.cities`), que é o que o círculo desenha. Por isso o pino não é
 * arrastável: mover o centro não mudaria o público de fato.
 *
 * Tiles do CARTO Voyager (sem chave de API): mesmo mapa do OpenStreetMap, com
 * desenho mais limpo e claro, que deixa o círculo da marca em evidência. O
 * Leaflet é carregado sob demanda porque ele mexe em `window` no import e a rota
 * pode renderizar no servidor.
 */

/** Caixa que enquadra o Brasil inteiro (sul/oeste → norte/leste). */
const BRASIL: LatLngBoundsLiteral = [[-33.9, -74.0], [5.3, -34.7]];

/** Raio pequeno enquadra num zoom absurdo de rua; o teto mantém o bairro à vista. */
const ZOOM_MAXIMO = 14;

const semAnimacao = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

export default function MapaRaio({
  centro, raioKm, rotulo, sublinha, carregando = false,
}: {
  centro: { lat: number; lon: number } | null;   // null = Brasil inteiro
  raioKm: number;
  rotulo: string;
  sublinha: string;
  carregando?: boolean;                          // geocodificação em andamento
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapa      = useRef<MapaLeaflet | null>(null);
  const circulo   = useRef<Circle | null>(null);
  const halo      = useRef<Circle | null>(null);
  const pino      = useRef<Marker | null>(null);
  const centroAnterior = useRef<string | null>(null);
  // Enquadrar também dispara `moveend`. Sem essa marca, todo reenquadramento
  // nosso seria lido como "o gestor mexeu" e acenderia o botão Centralizar.
  const movendoSozinho = useRef(false);
  const [pronto, setPronto] = useState(false);
  const [saiuDoLugar, setSaiuDoLugar] = useState(false);

  // Monta o mapa uma vez. Cidade e raio entram no efeito seguinte.
  useEffect(() => {
    let cancelado = false;

    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelado || !container.current || mapa.current) return;

      // Vista inicial antes de qualquer camada: sem ela o Leaflet quebra ao
      // adicionar o círculo ("layerPointToLatLng of undefined").
      const m = L.map(container.current, {
        zoomControl:     false,   // recriado à direita, para não cobrir o rótulo
        scrollWheelZoom: false,   // a página rola por cima do mapa sem prender o scroll
        attributionControl: true,
      }).fitBounds(BRASIL);

      L.control.zoom({ position: "topright" }).addTo(m);
      L.control.scale({ position: "bottomleft", imperial: false }).addTo(m);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        detectRetina: true,   // telas de notebook bom não ficam com o mapa borrado
        subdomains: "abcd",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
          '&copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(m);

      // Nascem fora do mapa: só entram quando existe cidade escolhida.
      // O halo é o disco cheio; o círculo por cima é só o contorno tracejado,
      // que marca a borda do raio sem escurecer o mapa inteiro.
      halo.current = L.circle([0, 0], {
        radius:      1000,
        className:   "mapa-raio-halo",
        interactive: false,
        stroke:      false,
        fillOpacity: 0.14,
      });

      circulo.current = L.circle([0, 0], {
        radius:      1000,
        className:   "mapa-raio-circulo",
        interactive: false,
        weight:      2,
        dashArray:   "6 6",
        fill:        false,
      });

      pino.current = L.marker([0, 0], {
        keyboard: false,
        icon: L.divIcon({
          className: "",
          iconSize:  [22, 22],
          iconAnchor: [11, 11],
          html: '<span class="mapa-raio-pino"><i></i></span>',
        }),
      });

      // O gestor arrastou ou deu zoom: oferece o "centralizar" em vez de puxar
      // o mapa de volta sozinho no meio da exploração dele.
      // `moveend` fecha arrasto e zoom de uma vez, e sai só uma vez por gesto.
      m.on("moveend", () => {
        if (movendoSozinho.current) { movendoSozinho.current = false; return; }
        setSaiuDoLugar(true);
      });

      mapa.current = m;
      setPronto(true);
    })();

    return () => {
      cancelado = true;
      mapa.current?.remove();
      mapa.current = null;
      circulo.current = null;
      halo.current = null;
      pino.current = null;
      centroAnterior.current = null;
      setPronto(false);
    };
    // Só na montagem: as props são aplicadas no efeito abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cidade ou raio mudou: reposiciona e reenquadra.
  useEffect(() => {
    const m = mapa.current;
    if (!pronto || !m || !circulo.current || !halo.current || !pino.current) return;

    // A caixa pode ter mudado de tamanho desde a última pintura; sem isso o
    // Leaflet enquadra com a medida antiga e a área sai cortada.
    movendoSozinho.current = true;
    m.invalidateSize({ animate: false });

    const marca = centro ? `${centro.lat},${centro.lon}` : null;
    const trocouDeCidade = marca !== centroAnterior.current;
    centroAnterior.current = marca;

    if (!centro) {
      circulo.current.remove();
      halo.current.remove();
      pino.current.remove();
      movendoSozinho.current = true;
      m.fitBounds(BRASIL, { animate: false });
      setSaiuDoLugar(false);
      return;
    }

    const ponto: [number, number] = [centro.lat, centro.lon];
    const metros = raioKm * 1000;

    halo.current.setLatLng(ponto).setRadius(metros).addTo(m);
    circulo.current.setLatLng(ponto).setRadius(metros).addTo(m);
    pino.current.setLatLng(ponto).addTo(m);

    const caixa = circulo.current.getBounds();
    const enquadre = { padding: [28, 28] as [number, number], maxZoom: ZOOM_MAXIMO };

    // Cidade nova: voa até ela, para o gestor ver para onde o mapa foi.
    // Só o raio mudou (slider sendo arrastado): reenquadra na hora, sem animar.
    movendoSozinho.current = true;
    if (trocouDeCidade && !semAnimacao()) {
      m.flyToBounds(caixa, { ...enquadre, duration: 0.9 });
    } else {
      m.fitBounds(caixa, { ...enquadre, animate: false });
    }
    setSaiuDoLugar(false);
  }, [centro, raioKm, pronto]);

  function centralizar() {
    const m = mapa.current;
    if (!m) return;
    const caixa = centro && circulo.current ? circulo.current.getBounds() : BRASIL;
    movendoSozinho.current = true;
    m.flyToBounds(caixa, {
      padding: [28, 28],
      maxZoom: ZOOM_MAXIMO,
      animate:  !semAnimacao(),
      duration: 0.6,
    });
    setSaiuDoLugar(false);
  }

  // `isolate z-0` prende os z-index internos do Leaflet (as panes vão até 800),
  // senão eles passam por cima do dropdown de busca da cidade.
  return (
    <div className="relative isolate z-0 rounded-xl overflow-hidden border border-zinc-200 shadow-sm">
      <div ref={container} className="h-72 w-full bg-zinc-100" />

      {/* Rótulo do que está desenhado: cidade + raio, ou "Brasil inteiro". */}
      <div className="pointer-events-none absolute top-2 left-2 z-[500] max-w-[62%] rounded-lg bg-white/95 backdrop-blur-sm border border-zinc-200 shadow-sm px-2.5 py-1.5">
        <p className="text-[11px] font-semibold text-zinc-800 leading-tight">{rotulo}</p>
        <p className="text-[10px] text-zinc-500 leading-tight">{sublinha}</p>
      </div>

      {/* Só aparece depois que o gestor mexeu no mapa. */}
      {saiuDoLugar && (
        <button
          type="button"
          onClick={centralizar}
          className="absolute bottom-2 right-2 z-[500] rounded-lg bg-white/95 backdrop-blur-sm border border-zinc-200 shadow-sm px-2.5 py-1.5 text-[11px] font-medium text-zinc-700 hover:text-brand hover:border-brand/40 transition"
        >
          Centralizar
        </button>
      )}

      {/* Véu discreto enquanto a cidade é localizada: o mapa antigo continua
          visível por baixo, então não pisca entre uma cidade e outra. */}
      {carregando && (
        <div className="pointer-events-none absolute inset-0 z-[600] grid place-items-center bg-white/45 backdrop-blur-[1px]">
          <span className="flex items-center gap-2 rounded-full bg-white border border-zinc-200 shadow-sm px-3 py-1.5 text-[11px] font-medium text-zinc-600">
            <span className="size-3 rounded-full border-2 border-zinc-300 border-t-brand animate-spin" />
            Localizando no mapa...
          </span>
        </div>
      )}
    </div>
  );
}
