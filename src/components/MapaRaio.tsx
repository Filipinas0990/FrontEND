import { useEffect, useRef, useState } from "react";
import type { Circle, LatLngBoundsLiteral, Map as MapaLeaflet, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Mapa da segmentação geográfica, no espírito do Gerenciador de Anúncios do Meta:
 * um pino no centro da cidade e o círculo do raio escolhido.
 *
 * Sem cidade (`centro = null`) o mapa mostra o Brasil inteiro, que é exatamente
 * como a campanha sai nesse caso — o gestor vê a área desde o começo, antes de
 * escolher qualquer coisa.
 *
 * É só visualização — o Meta segmenta pela "key" da cidade + raio em km
 * (`geo_locations.cities`), que é o que o círculo desenha. Por isso o pino não é
 * arrastável: mover o centro não mudaria o público de fato.
 *
 * Tiles do OpenStreetMap (sem chave de API). O Leaflet é carregado sob demanda
 * porque ele mexe em `window` no import e a rota pode renderizar no servidor.
 */

/** Caixa que enquadra o Brasil inteiro (sul/oeste → norte/leste). */
const BRASIL: LatLngBoundsLiteral = [[-33.9, -74.0], [5.3, -34.7]];

export default function MapaRaio({
  centro, raioKm, rotulo, sublinha,
}: {
  centro: { lat: number; lon: number } | null;   // null = Brasil inteiro
  raioKm: number;
  rotulo: string;
  sublinha: string;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapa      = useRef<MapaLeaflet | null>(null);
  const circulo   = useRef<Circle | null>(null);
  const pino      = useRef<Marker | null>(null);
  const [pronto, setPronto] = useState(false);

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

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);

      // Nascem fora do mapa: só entram quando existe cidade escolhida.
      circulo.current = L.circle([0, 0], {
        radius:      1000,
        className:   "mapa-raio-circulo",
        weight:      2,
        fillOpacity: 0.15,
      });

      pino.current = L.marker([0, 0], {
        keyboard: false,
        icon: L.divIcon({
          className: "",
          iconSize:  [18, 18],
          iconAnchor: [9, 9],
          html:
            '<span style="display:block;width:18px;height:18px;border-radius:9999px;' +
            'background:var(--brand);border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>',
        }),
      });

      mapa.current = m;
      setPronto(true);
    })();

    return () => {
      cancelado = true;
      mapa.current?.remove();
      mapa.current = null;
      circulo.current = null;
      pino.current = null;
      setPronto(false);
    };
    // Só na montagem: as props são aplicadas no efeito abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cidade ou raio mudou: reposiciona e reenquadra.
  useEffect(() => {
    const m = mapa.current;
    if (!pronto || !m || !circulo.current || !pino.current) return;

    // A caixa muda de altura entre os dois estados; sem isso o Leaflet enquadra
    // com a altura antiga e o Brasil sai cortado.
    m.invalidateSize({ animate: false });

    if (!centro) {
      circulo.current.remove();
      pino.current.remove();
      m.fitBounds(BRASIL, { animate: false });
      return;
    }

    const ponto: [number, number] = [centro.lat, centro.lon];
    circulo.current.setLatLng(ponto).setRadius(raioKm * 1000).addTo(m);
    pino.current.setLatLng(ponto).addTo(m);
    m.fitBounds(circulo.current.getBounds(), { padding: [18, 18], animate: false });
  }, [centro, raioKm, pronto]);

  // `isolate z-0` prende os z-index internos do Leaflet (as panes vão até 800),
  // senão eles passam por cima do dropdown de busca da cidade.
  return (
    <div className="relative isolate z-0 rounded-xl overflow-hidden border border-zinc-200">
      {/* Brasil inteiro precisa de mais altura para caber sem cortar o país;
          com o círculo da cidade, a caixa mais baixa já enquadra bem. */}
      <div ref={container} className={`${centro ? "h-56" : "h-72"} w-full bg-zinc-100`} />
      <div className="pointer-events-none absolute top-2 left-2 z-[500] max-w-[60%] rounded-lg bg-white/95 border border-zinc-200 shadow-sm px-2.5 py-1.5">
        <p className="text-[11px] font-semibold text-zinc-800 leading-tight">{rotulo}</p>
        <p className="text-[10px] text-zinc-500 leading-tight">{sublinha}</p>
      </div>
    </div>
  );
}
