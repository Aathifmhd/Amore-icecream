declare global {
  interface Window {
    L: any;
  }
}

let loading: Promise<any> | null = null;

/** Leaflet (the map library) is only downloaded when a map is first opened. */
export function loadLeaflet(): Promise<any> {
  if (window.L) return Promise.resolve(window.L);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => resolve(window.L);
      script.onerror = () => {
        loading = null;
        reject(new Error('The map could not load'));
      };
      document.body.appendChild(script);
    });
  }
  return loading;
}

/** Draws each parlour as a dot with its name, and its delivery area as a dashed circle. */
export function drawParlours(
  L: any,
  layer: any,
  parlours: { id: string; name: string; lat: number; lng: number; radiusKm: number; highlight?: boolean }[]
) {
  layer.clearLayers();
  for (const p of parlours) {
    L.circle([p.lat, p.lng], {
      radius: p.radiusKm * 1000,
      color: '#8C102A',
      weight: p.highlight ? 2.5 : 1.5,
      opacity: p.highlight ? 0.9 : 0.55,
      dashArray: '6 6',
      fillColor: '#8C102A',
      fillOpacity: p.highlight ? 0.1 : 0.05,
      interactive: false,
    }).addTo(layer);
    L.circleMarker([p.lat, p.lng], {
      radius: 7,
      color: '#ffffff',
      weight: 3,
      fillColor: '#8C102A',
      fillOpacity: 1,
      interactive: false,
    })
      .bindTooltip(p.name, { permanent: true, direction: 'right', offset: [10, 0], className: 'amore-parlour-label' })
      .addTo(layer);
  }
}
