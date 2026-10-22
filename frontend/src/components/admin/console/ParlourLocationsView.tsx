/**
 * Settings → Locations & delivery (super admin): where each parlour is on the map and how far it
 * delivers. Customers whose pin is further away can only choose pickup; the backend checks the same.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { BranchId } from '../../../types';
import { AMORE_BRANCHES } from '../../../data/iceCreamData';
import { api, ApiError } from '../../../api';
import { refreshParlourZones, type ParlourZone } from '../../../utils/branchLocation';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { createAmoreMap, drawParlours, whenMapReady, type MapLib } from '../../../utils/map';
import { Button, cx, inputClass, useConsoleUi } from './ui';
import { timeAgo } from './orderMeta';

type Parlour = ParlourZone & { updatedAt?: string; updatedBy?: string };

const SHORT: Record<BranchId, string> = { akurana: 'Akurana', colombo: 'Colombo', arugambay: 'Arugam Bay' };
const fullName = (id: BranchId) => `Amore ${AMORE_BRANCHES.find((b) => b.id === id)?.name ?? SHORT[id]}`;
const formatCoords = (p: { lat: number; lng: number }) => `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`;
// "7.3639, 80.6175" as copied from Google Maps (also takes a space between them)
const parseCoords = (text: string) => {
  const m = text.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
};
const same = (a: ParlourZone, b: ParlourZone) => a.lat === b.lat && a.lng === b.lng && a.radiusKm === b.radiusKm;

// The draggable pin for the chosen parlour
const pinElement = () => {
  const el = document.createElement('div');
  el.innerHTML =
    '<div style="width:34px;height:34px;border-radius:50% 50% 50% 0;background:#8C102A;border:3px solid #fff;transform:rotate(-45deg);box-shadow:0 4px 12px rgba(0,0,0,.3);cursor:grab"></div>';
  return el;
};

export const ParlourLocationsView: React.FC = () => {
  const { toast } = useConsoleUi();
  const [saved, setSaved] = useState<Record<BranchId, Parlour> | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<BranchId, ParlourZone>>>({});
  const [sel, setSel] = useState<BranchId>('akurana');
  const [locText, setLocText] = useState('');
  const [busy, setBusy] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const mapBox = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const libRef = useRef<MapLib | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const selRef = useRef(sel);
  selRef.current = sel;

  useEffect(() => {
    api<{ parlours: Record<BranchId, Parlour> }>('/parlours')
      .then((r) => setSaved(r.parlours))
      .catch(() => toast('Could not load the parlour locations', 'error'));
  }, []);

  const current: ParlourZone | null = saved ? drafts[sel] ?? saved[sel] : null;
  const dirty = Boolean(saved && drafts[sel] && !same(drafts[sel]!, saved[sel]));
  const change = (patch: Partial<ParlourZone>) => {
    if (!current) return;
    setDrafts((d) => ({ ...d, [sel]: { ...current, ...patch } }));
  };

  // Show the chosen parlour's numbers when switching or after the pin moves
  useEffect(() => {
    if (current) setLocText(formatCoords(current));
  }, [sel, saved, current?.lat, current?.lng]);

  // The map, built once: tap it or drag the pin to move the chosen parlour
  useEffect(() => {
    if (!saved || !mapBox.current || mapRef.current) return;
    let cancelled = false;
    const start = drafts[sel] ?? saved[sel];
    createAmoreMap(mapBox.current, start, 11.5)
      .then(({ map, maplibre }) => {
        if (cancelled) return map.remove();
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-left');
        const marker = new maplibre.Marker({ element: pinElement(), draggable: true, anchor: 'bottom' }).setLngLat([start.lng, start.lat]).addTo(map);
        const moveTo = (lat: number, lng: number) =>
          setDrafts((d) => {
            const id = selRef.current;
            const base = d[id] ?? saved[id];
            return { ...d, [id]: { ...base, lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 } };
          });
        marker.on('dragend', () => {
          const p = marker.getLngLat();
          moveTo(p.lat, p.lng);
        });
        map.on('click', (e) => moveTo(e.lngLat.lat, e.lngLat.lng));
        markerRef.current = marker;
        mapRef.current = map;
        libRef.current = maplibre;
        whenMapReady(map, () => !cancelled && setMapReady(true));
      })
      .catch(() => setMapError('The map could not load. You can still type the location below.'));
    return () => {
      cancelled = true;
    };
  }, [saved]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
    },
    []
  );

  // Redraw every parlour's dot and delivery circle, and put the pin on the chosen one
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!saved || !mapReady || !map || !lib) return;
    const all = (Object.keys(saved) as BranchId[]).map((id) => ({ id, name: fullName(id), ...(drafts[id] ?? saved[id]), highlight: id === sel }));
    drawParlours(map, lib, all);
    if (current) markerRef.current?.setLngLat([current.lng, current.lat]);
  }, [saved, drafts, sel, mapReady]);

  // Switching parlour brings it into view
  useEffect(() => {
    if (current && mapRef.current) mapRef.current.easeTo({ center: [current.lng, current.lat], zoom: 11.5, duration: 700 });
  }, [sel]);

  const save = async () => {
    if (!current || !dirty) return;
    setBusy(true);
    try {
      const r = await api<{ parlours: Record<BranchId, Parlour> }>(`/parlours/${sel}`, { method: 'PUT', body: current, as: 'admin' });
      setSaved(r.parlours);
      setDrafts((d) => ({ ...d, [sel]: undefined }));
      refreshParlourZones();
      toast(`${fullName(sel)} saved — delivers within ${current.radiusKm} km`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!saved || !current) return <p className="text-sm text-[#8A7970]">Loading the parlour locations…</p>;

  const radiusInput = (v: number) => change({ radiusKm: Math.min(50, Math.max(0.5, Math.round(v * 10) / 10)) });
  const info = saved[sel];

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1" role="tablist" aria-label="Parlour">
        {(Object.keys(saved) as BranchId[]).map((id) => {
          const changed = drafts[id] && !same(drafts[id]!, saved[id]);
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={sel === id}
              onClick={() => setSel(id)}
              className={cx(
                'h-9 px-3.5 rounded-full text-sm font-semibold whitespace-nowrap cursor-pointer border transition-colors',
                sel === id ? 'bg-[#81001E] text-white border-[#81001E]' : 'bg-white text-[#5C4D44] border-[#E2D8CA] hover:border-[#C9B9A4]'
              )}
            >
              {SHORT[id]}
              <span className={sel === id ? 'text-white/75' : 'text-[#A8988B]'}> · {(drafts[id] ?? saved[id]).radiusKm} km</span>
              {changed && <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-amber-400 align-middle" title="Not saved yet" />}
            </button>
          );
        })}
      </div>

      <div className="relative rounded-xl overflow-hidden border border-[#EAE2D6] bg-[#F2F0EC]">
        <div ref={mapBox} className="amore-map h-[22rem]" />
        <p className="absolute top-3 left-14 right-3 z-[500] pointer-events-none">
          <span className="inline-block px-3 py-1.5 rounded-full bg-white/95 text-xs font-semibold text-[#3D2C24] shadow-[0_2px_10px_rgba(0,0,0,0.12)]">
            Drag the pin or tap the map to move {fullName(sel)}
          </span>
        </p>
        {mapError && <p className="absolute inset-x-3 bottom-3 z-[500] text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{mapError}</p>}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm font-semibold text-[#3D2C24] mb-1.5">Location (latitude, longitude)</span>
          <input
            value={locText}
            onChange={(e) => {
              setLocText(e.target.value);
              const c = parseCoords(e.target.value);
              if (c) change(c);
            }}
            inputMode="decimal"
            spellCheck={false}
            className={cx(inputClass, 'font-mono', !parseCoords(locText) && 'border-red-300')}
            aria-label={`${SHORT[sel]} location`}
          />
          <span className="block text-xs text-[#8A7970] mt-1.5">
            From Google Maps: press and hold (or right-click) the parlour, then copy the numbers that appear and paste them here.
          </span>
        </label>

        <div>
          <span className="block text-sm font-semibold text-[#3D2C24] mb-1.5">Delivers within</span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" aria-label="Half a km less" onClick={() => radiusInput(current.radiusKm - 0.5)} icon={<Minus className="w-4 h-4" />} />
            <div className="relative w-28">
              <input
                type="number"
                min={0.5}
                max={50}
                step={0.5}
                value={current.radiusKm}
                onChange={(e) => e.target.value !== '' && radiusInput(Number(e.target.value))}
                className={cx(inputClass, 'pr-10 text-center font-semibold tabular-nums')}
                aria-label={`${SHORT[sel]} delivery distance in km`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#8A7970]">km</span>
            </div>
            <Button variant="secondary" aria-label="Half a km more" onClick={() => radiusInput(current.radiusKm + 0.5)} icon={<Plus className="w-4 h-4" />} />
          </div>
          <input
            type="range"
            min={1}
            max={20}
            step={0.5}
            value={Math.min(20, current.radiusKm)}
            onChange={(e) => radiusInput(Number(e.target.value))}
            className="w-full mt-3 accent-[#81001E] cursor-pointer"
            aria-label={`${SHORT[sel]} delivery distance slider`}
          />
          <span className="block text-xs text-[#8A7970] mt-1">
            Customers further than {current.radiusKm} km from this parlour can’t choose delivery; they’re offered pickup instead.
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#F0E8DC]">
        <p className="text-xs text-[#8A7970] flex-1 min-w-48">
          {info.updatedAt ? `Last changed ${timeAgo(info.updatedAt)}${info.updatedBy ? ` by ${info.updatedBy}` : ''}.` : 'Using the starting location — check it is right.'}
        </p>
        {dirty && (
          <Button variant="ghost" icon={<RotateCcw className="w-4 h-4" />} onClick={() => setDrafts((d) => ({ ...d, [sel]: undefined }))}>
            Undo changes
          </Button>
        )}
        <Button variant="primary" onClick={save} disabled={!dirty || busy || !parseCoords(locText)}>
          {busy ? 'Saving…' : `Save ${SHORT[sel]}`}
        </Button>
      </div>
    </div>
  );
};
