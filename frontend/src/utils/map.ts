/**
 * The maps (delivery pin and parlour settings): MapLibre with OpenFreeMap's free vector tiles
 * (no key, commercial use allowed; attribution is shown on the map), recoloured to a calm
 * delivery-app look: light grey ground, blue-grey roads, white 3D buildings, green parks.
 * MapLibre is only downloaded when a map is first opened.
 */
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';

export type MapLib = typeof import('maplibre-gl');
type LngLat = { lat: number; lng: number };

let lib: Promise<MapLib> | null = null;
export function loadMapLib(): Promise<MapLib> {
  if (!lib) {
    lib = Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')])
      .then(([m]) => ((m as unknown as { default?: MapLib }).default ?? m) as MapLib)
      .catch((err) => {
        lib = null;
        throw err;
      });
  }
  return lib;
}

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const COLORS = {
  ground: '#f3f3f1',
  road: '#c5d1dd',
  roadEdge: '#b4c2cf',
  path: '#d6dee6',
  rail: '#cfcfcf',
  building: '#ececec',
  buildingTop: '#fbfbfb',
  park: '#bfe7c5',
  green: '#d5ecd3',
  water: '#a9d3f2',
  label: '#5f6b77',
  place: '#3c4043',
};

/** Liberty's layers, recoloured (layer ids are matched loosely so small style updates still work) */
function restyle(style: StyleSpecification): StyleSpecification {
  // Soft light, so the 3D buildings have pale sides like the rest of the map
  style.light = { anchor: 'viewport', color: '#ffffff', intensity: 0.15 };
  for (const layer of style.layers) {
    const paint = ((layer as { paint?: Record<string, unknown> }).paint ??= {});
    const src = (layer as { 'source-layer'?: string })['source-layer'] ?? '';
    const id = layer.id;
    if (layer.type === 'background') paint['background-color'] = COLORS.ground;
    else if (layer.type === 'fill' && src === 'landuse') {
      // Neighbourhoods, schools etc. blend into the ground; pitches and cemeteries stay a soft green
      paint['fill-color'] = /pitch|track|cemetery/.test(id) ? COLORS.green : COLORS.ground;
      paint['fill-opacity'] = /pitch|track|cemetery/.test(id) ? 0.8 : 0;
    } else if (layer.type === 'fill' && src === 'park') {
      paint['fill-color'] = COLORS.park;
      paint['fill-opacity'] = 0.85;
      paint['fill-outline-color'] = COLORS.park;
    } else if (layer.type === 'line' && src === 'park') paint['line-opacity'] = 0;
    else if (layer.type === 'fill' && src === 'landcover' && /wood|grass/.test(id)) {
      paint['fill-color'] = COLORS.green;
      paint['fill-opacity'] = 0.55;
    } else if (src === 'water' && layer.type === 'fill') paint['fill-color'] = COLORS.water;
    else if (src === 'waterway' && layer.type === 'line') paint['line-color'] = COLORS.water;
    else if (layer.type === 'line' && src === 'transportation') {
      if (/rail/.test(id)) paint['line-color'] = COLORS.rail;
      else if (/path|pedestrian/.test(id)) paint['line-color'] = COLORS.path;
      else paint['line-color'] = /casing/.test(id) ? COLORS.roadEdge : COLORS.road;
    } else if (layer.type === 'fill' && src === 'building') {
      paint['fill-color'] = COLORS.building;
      paint['fill-outline-color'] = '#dcdcdc';
    } else if (layer.type === 'fill-extrusion') {
      paint['fill-extrusion-color'] = COLORS.buildingTop;
      paint['fill-extrusion-opacity'] = 0.9;
    } else if (layer.type === 'symbol' && src === 'transportation_name' && !/shield/.test(id)) {
      paint['text-color'] = COLORS.label;
      paint['text-halo-color'] = '#ffffff';
    } else if (layer.type === 'symbol' && src === 'poi') paint['text-color'] = COLORS.label;
    else if (layer.type === 'symbol' && src === 'place') paint['text-color'] = COLORS.place;
  }
  return style;
}

let styleJson: Promise<StyleSpecification> | null = null;
/** The recoloured map style (fetched once per visit) */
export function amoreMapStyle(): Promise<StyleSpecification> {
  if (!styleJson) {
    styleJson = fetch(STYLE_URL)
      .then((r) => {
        if (!r.ok) throw new Error('map style');
        return r.json();
      })
      .then(restyle)
      .catch((err) => {
        styleJson = null;
        throw err;
      });
  }
  return styleJson;
}

/** A map ready for Amore: no rotating or tilting, attribution tucked into a small button */
export async function createAmoreMap(container: HTMLElement, center: LngLat, zoom: number): Promise<{ map: MapLibreMap; maplibre: MapLib }> {
  const [maplibre, style] = await Promise.all([loadMapLib(), amoreMapStyle()]);
  const map = new maplibre.Map({
    container,
    style,
    center: [center.lng, center.lat],
    zoom,
    maxZoom: 19,
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
  });
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();
  map.addControl(new maplibre.AttributionControl({ compact: true }), 'bottom-left');
  // Start with the credits folded into their small (i) button
  map.once('load', () => container.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'));
  return { map, maplibre };
}

/** A ring of points `radiusKm` around a centre (for the delivery areas) */
function circleRing(c: LngLat, radiusKm: number, steps = 96): [number, number][] {
  const ring: [number, number][] = [];
  const dLat = radiusKm / 110.574;
  const dLng = radiusKm / (111.32 * Math.cos((c.lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([c.lng + dLng * Math.cos(a), c.lat + dLat * Math.sin(a)]);
  }
  return ring;
}

export interface ParlourOnMap extends LngLat {
  id: string;
  name: string;
  radiusKm: number;
  highlight?: boolean;
}

/**
 * Draws each parlour as a dot with its name, and its delivery area as a dashed circle.
 * Call again with new values to redraw; returns nothing to clean up beyond the map itself.
 */
export function drawParlours(map: MapLibreMap, maplibre: MapLib, parlours: ParlourOnMap[]) {
  const data = {
    type: 'FeatureCollection' as const,
    features: parlours.map((p) => ({
      type: 'Feature' as const,
      properties: { highlight: p.highlight ? 1 : 0 },
      geometry: { type: 'Polygon' as const, coordinates: [circleRing(p, p.radiusKm)] },
    })),
  };
  const source = map.getSource('amore-parlour-areas') as { setData?: (d: typeof data) => void } | undefined;
  if (source?.setData) source.setData(data);
  else {
    map.addSource('amore-parlour-areas', { type: 'geojson', data });
    map.addLayer({
      id: 'amore-parlour-area-fill',
      type: 'fill',
      source: 'amore-parlour-areas',
      // Faint, so the streets inside keep their own colours
      paint: { 'fill-color': '#8C102A', 'fill-opacity': ['case', ['==', ['get', 'highlight'], 1], 0.06, 0.02] },
    });
    map.addLayer({
      id: 'amore-parlour-area-line',
      type: 'line',
      source: 'amore-parlour-areas',
      paint: {
        'line-color': '#8C102A',
        'line-opacity': ['case', ['==', ['get', 'highlight'], 1], 0.9, 0.55],
        'line-width': ['case', ['==', ['get', 'highlight'], 1], 2.5, 1.5],
        'line-dasharray': [3, 3],
      },
    });
  }

  // Dots with names (HTML markers, so they look the same as the rest of the site)
  const holder = map as MapLibreMap & { _amoreParlourMarkers?: { remove: () => void }[] };
  holder._amoreParlourMarkers?.forEach((m) => m.remove());
  holder._amoreParlourMarkers = parlours.map((p) => {
    const el = document.createElement('div');
    el.className = 'amore-parlour-marker';
    el.innerHTML = '<span class="amore-parlour-dot"></span><span class="amore-parlour-name"></span>';
    (el.querySelector('.amore-parlour-name') as HTMLElement).textContent = p.name;
    return new maplibre.Marker({ element: el, anchor: 'left', offset: [-9, 0] }).setLngLat([p.lng, p.lat]).addTo(map);
  });
}

/** Runs `fn` once the map's style has loaded (straight away if it already has) */
export function whenMapReady(map: MapLibreMap, fn: () => void) {
  if (map.isStyleLoaded()) fn();
  else map.once('load', fn);
}
