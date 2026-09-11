import { useEffect, useRef, useState } from "react";
import type { Circle, Map as MapaLeaflet, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Mapa do raio de segmentação, no espírito do Gerenciador de Anúncios do Meta:
 * um pino no centro da cidade e o círculo do raio escolhido.
 *
 * É só visualização — o Meta segmenta pela "key" da cidade + raio em km
 * (`geo_locations.cities`), que é exatamente o que o círculo desenha. Por isso o
 * pino não é arrastável: mover o centro não mudaria o público de fato.
 *
 * Tiles do OpenStreetMap (sem chave de API). O Leaflet é carregado sob demanda
 * porque ele mexe em `window` no import e a rota pode renderizar no servidor.
 */
export default function MapaRaio({
  lat, lon, raioKm, rotulo,
}: {
  lat: number;
  lon: number;
  raioKm: number;
  rotulo: string;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapa      = useRef<MapaLeaflet | null>(null);
  const circulo   = useRef<Circle | null>(null);
  const pino      = useRef<Marker | null>(null);
  const [pronto, setPronto] = useState(false);

  // Monta o mapa uma vez. As props entram no efeito seguinte.
  useEffect(() => {
    let cancelado = false;

    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelado || !container.current || mapa.current) return;

      const m = L.map(container.current, {
        zoomControl:     true,
        scrollWheelZoom: false,   // a página rola por cima do mapa sem prender o scroll
        attributionControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);

      circulo.current = L.circle([lat, lon], {
        radius:    raioKm * 1000,
        className: "mapa-raio-circulo",
        weight:    2,
        fillOpacity: 0.15,
      }).addTo(m);

      pino.current = L.marker([lat, lon], {
        keyboard: false,
        icon: L.divIcon({
          className: "",
          iconSize:  [18, 18],
          iconAnchor: [9, 9],
          html:
            '<span style="display:block;width:18px;height:18px;border-radius:9999px;' +
            'background:var(--brand);border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>',
        }),
      }).addTo(m);

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
    // Só na montagem: cidade e raio são aplicados no efeito abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cidade ou raio mudou: reposiciona e reenquadra para o círculo caber inteiro.
  useEffect(() => {
    const m = mapa.current;
    if (!pronto || !m || !circulo.current || !pino.current) return;

    circulo.current.setLatLng([lat, lon]);
    circulo.current.setRadius(raioKm * 1000);
    pino.current.setLatLng([lat, lon]);
    m.fitBounds(circulo.current.getBounds(), { padding: [18, 18], animate: false });
  }, [lat, lon, raioKm, pronto]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-zinc-200">
      <div ref={container} className="h-56 w-full bg-zinc-100" />
      <div className="pointer-events-none absolute top-2 left-2 z-[500] rounded-lg bg-white/95 border border-zinc-200 shadow-sm px-2.5 py-1.5">
        <p className="text-[11px] font-semibold text-zinc-800 leading-tight">{rotulo}</p>
        <p className="text-[10px] text-zinc-500 leading-tight">Raio de {raioKm} km</p>
      </div>
    </div>
  );
}
