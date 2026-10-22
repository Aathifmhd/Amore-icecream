import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AlertCircle, ArrowLeft, LocateFixed, Loader2, MapPin, Search, Store } from 'lucide-react';
import { BranchId } from '../types';
import { AMORE_BRANCHES } from '../data/iceCreamData';
import { BRANCH_COORDS, DELIVERY_RADIUS_KM, deliveryCheck } from '../utils/branchLocation';

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAddress?: string;
  initialCity?: string;
  initialCoords?: { lat: number; lng: number };
  /** Where the map starts when there is no pin yet and the phone can't find the customer */
  fallbackBranch?: BranchId;
  /** The parlour that delivers, when it is already fixed (editing a placed order); else the nearest */
  deliverFrom?: BranchId;
  /** Offered when the pin is too far for delivery: switch the order to pickup from this parlour */
  onChoosePickup?: (branch: BranchId) => void;
  onSelectLocation: (location: {
    address: string;
    city: string;
    coords: { lat: number; lng: number };
  }) => void;
}

declare global {
  interface Window {
    L: any;
  }
}

type Coords = { lat: number; lng: number };

/** "Deegala Road, Akurana" + "Kandy" from an OpenStreetMap (Nominatim) address */
function describeAddress(data: any): { address: string; city: string } | null {
  const a = data?.address;
  if (!a) return null;
  const street = [a.house_number, a.road || a.pedestrian || a.footway || a.path].filter(Boolean).join(' ');
  const locality = a.suburb || a.neighbourhood || a.quarter || a.village || a.hamlet || '';
  // "Kandy District" reads as "Kandy"
  const city = String(a.town || a.city || a.municipality || a.county || a.state_district || a.village || '').replace(/ District$/, '');
  const parts = [street, locality].filter((p, i, all) => p && p !== city && all.indexOf(p) === i);
  const address = parts.join(', ') || String(data.display_name || '').split(',').slice(0, 2).join(',').trim();
  return { address, city };
}

/**
 * Full-screen map with a fixed pin in the middle: the customer moves the map until the pin
 * sits on their door, then confirms. Opens on their current location when the phone allows it.
 */
export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  onClose,
  initialAddress = '',
  initialCity = '',
  initialCoords,
  fallbackBranch = 'akurana',
  deliverFrom,
  onChoosePickup,
  onSelectLocation,
}) => {
  const [coords, setCoords] = useState<Coords>(initialCoords || BRANCH_COORDS[fallbackBranch]);
  const [address, setAddress] = useState(initialAddress);
  const [city, setCity] = useState(initialCity);
  const [typed, setTyped] = useState(false);
  const [moving, setMoving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(() => typeof window !== 'undefined' && Boolean(window.L));

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const lookupRef = useRef(0);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start from what checkout already has each time the map opens
  useEffect(() => {
    if (!isOpen) return;
    setCoords(initialCoords || BRANCH_COORDS[fallbackBranch]);
    setAddress(initialAddress);
    setCity(initialCity);
    setTyped(false);
    setNotice(null);
  }, [isOpen]);

  // Leaflet is only loaded when someone opens the map
  useEffect(() => {
    if (!isOpen || window.L) return;
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    const existing = document.getElementById('leaflet-js') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => setLeafletLoaded(true));
      return;
    }
    const script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => setLeafletLoaded(true);
    document.body.appendChild(script);
  }, [isOpen]);

  // The street address under the pin (only the latest lookup counts)
  const lookUpAddress = useCallback(async (lat: number, lng: number) => {
    const id = ++lookupRef.current;
    setGeocoding(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: { 'Accept-Language': 'en' },
      });
      if (!res.ok) throw new Error('lookup failed');
      const found = describeAddress(await res.json());
      if (id !== lookupRef.current) return;
      if (found) {
        setAddress(found.address);
        setCity(found.city);
        setTyped(false);
        setNotice(null);
      }
    } catch {
      if (id === lookupRef.current) setNotice('Could not find the street name. Type it in below.');
    } finally {
      if (id === lookupRef.current) setGeocoding(false);
    }
  }, []);

  const findMe = useCallback(() => {
    if (!navigator.geolocation) {
      setNotice('This phone cannot share its location. Move the map to your door.');
      return;
    }
    setLocating(true);
    setNotice(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 18, { animate: true });
      },
      () => {
        setLocating(false);
        setNotice('Could not find you. Move the map so the pin is on your door.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, []);

  // Build the map: the pin stays in the middle and the map moves under it
  useEffect(() => {
    if (!isOpen || !leafletLoaded || !mapContainerRef.current) return;
    const L = window.L;
    const start = initialCoords || BRANCH_COORDS[fallbackBranch];
    const map = L.map(mapContainerRef.current, {
      center: [start.lat, start.lng],
      zoom: initialCoords ? 18 : 15,
      zoomControl: false,
      attributionControl: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    L.control.attribution({ position: 'bottomleft', prefix: false }).addAttribution('© OpenStreetMap').addTo(map);

    map.on('movestart', () => {
      setMoving(true);
      if (lookupTimer.current) clearTimeout(lookupTimer.current);
    });
    map.on('moveend', () => {
      setMoving(false);
      const c = map.getCenter();
      setCoords({ lat: c.lat, lng: c.lng });
      if (lookupTimer.current) clearTimeout(lookupTimer.current);
      lookupTimer.current = setTimeout(() => lookUpAddress(c.lat, c.lng), 450);
    });
    mapRef.current = map;
    // The container has only just been laid out
    const settle = setTimeout(() => map.invalidateSize(), 120);

    if (initialCoords) {
      if (!initialAddress.trim()) lookUpAddress(start.lat, start.lng);
    } else {
      findMe();
      lookUpAddress(start.lat, start.lng);
    }

    return () => {
      clearTimeout(settle);
      if (lookupTimer.current) clearTimeout(lookupTimer.current);
      map.remove();
      mapRef.current = null;
    };
  }, [isOpen, leafletLoaded]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Typing a place and pressing Enter moves the map there
  const searchTyped = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = address.trim();
    if (!q || !typed) return;
    setGeocoding(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=lk&limit=1&q=${encodeURIComponent(q)}`, {
        headers: { 'Accept-Language': 'en' },
      });
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        mapRef.current?.setView([parseFloat(data[0].lat), parseFloat(data[0].lon)], 17, { animate: true });
      } else {
        setNotice('Place not found. Move the map so the pin is on your door.');
      }
    } catch {
      setNotice('Search is not working right now. Move the map instead.');
    } finally {
      setGeocoding(false);
    }
  };

  if (!isOpen) return null;

  const shownAddress = typed || !city || address.includes(city) ? address : [address, city].filter(Boolean).join(', ');
  // Parlours deliver only within DELIVERY_RADIUS_KM
  const range = deliveryCheck(coords, deliverFrom);
  const tooFar = !range.ok && !moving && !locating;
  const rangeBranch = AMORE_BRANCHES.find((b) => b.id === range.branch);
  const canConfirm = Boolean(address.trim()) && !moving && range.ok;
  const confirm = () => {
    if (!canConfirm) return;
    onSelectLocation({ address: address.trim(), city: city.trim(), coords });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex sm:items-center sm:justify-center sm:p-4 bg-black/70 backdrop-blur-xs animate-fadeIn" role="dialog" aria-modal="true" aria-label="Choose your delivery location" onClick={onClose}>
      <div
        className="relative flex flex-col w-full h-[100dvh] sm:h-[min(780px,92vh)] sm:max-w-md bg-white sm:rounded-3xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Map with the pin fixed in the middle */}
        <div className="relative flex-1 min-h-0 bg-[#F2F0EC]">
          <div ref={mapContainerRef} className="amore-pin-map absolute inset-0" />

          <div className="absolute inset-0 pointer-events-none z-[500]">
            <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full transition-transform duration-200 ${moving ? '-mt-3' : ''}`}>
              <div className="flex flex-col items-center">
                <span className="w-11 h-11 rounded-full bg-[#8C102A] shadow-[0_6px_16px_rgba(0,0,0,0.3)] flex items-center justify-center">
                  <span className="w-4 h-4 rounded-full bg-white" />
                </span>
                <span className="w-[3px] h-4 rounded-b-full bg-[#241A18]" />
              </div>
            </div>
            <span className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-1 rounded-full bg-black/30 transition-opacity ${moving ? 'opacity-100' : 'opacity-0'}`} />
            {!moving && (
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 mt-3.5 animate-fadeIn">
                <span className={`relative block px-4 py-2.5 rounded-2xl text-white text-sm font-medium whitespace-nowrap shadow-lg ${tooFar ? 'bg-[#B42318]' : 'bg-[#3A3330]'}`}>
                  <span className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 ${tooFar ? 'bg-[#B42318]' : 'bg-[#3A3330]'}`} />
                  <span className="relative">{locating ? 'Finding your location…' : tooFar ? 'We can’t deliver here' : 'Your selected location'}</span>
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Back to checkout"
            className="absolute top-[max(1rem,env(safe-area-inset-top))] left-4 z-[600] w-12 h-12 rounded-full bg-white text-[#241A18] shadow-[0_2px_12px_rgba(0,0,0,0.18)] flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          <button
            type="button"
            onClick={findMe}
            disabled={locating}
            aria-label="Go to my current location"
            className="absolute bottom-4 right-4 z-[600] w-14 h-14 rounded-full bg-white text-[#241A18] shadow-[0_2px_12px_rgba(0,0,0,0.18)] flex items-center justify-center cursor-pointer active:scale-95 transition-transform disabled:opacity-80"
          >
            {locating ? <Loader2 className="w-6 h-6 animate-spin text-[#8C102A]" /> : <LocateFixed className="w-6 h-6" />}
          </button>

          {notice && (
            <p className="absolute top-[max(1rem,env(safe-area-inset-top))] left-20 right-4 z-[600] px-3.5 py-2.5 rounded-2xl bg-white/95 text-[#3D2C24] text-xs font-medium shadow-[0_2px_12px_rgba(0,0,0,0.15)]">
              {notice}
            </p>
          )}
        </div>

        {/* Confirm sheet */}
        <div className="shrink-0 bg-white px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-6px_20px_rgba(0,0,0,0.06)] relative z-[700]">
          <h2 className="text-2xl font-bold text-[#241A18] tracking-tight">Confirm your location</h2>
          <p className="text-sm text-[#6E5D54] mt-1">Press “Confirm” if this location is correct</p>

          <form onSubmit={searchTyped} className="mt-4">
            <label className="flex items-center gap-3 px-4 h-14 rounded-2xl border border-[#DDD3C6] bg-white focus-within:border-[#8C102A] focus-within:ring-2 focus-within:ring-[#8C102A]/15">
              <span className="w-7 h-7 rounded-full bg-[#8C102A]/10 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-[#8C102A]" />
              </span>
              <input
                value={shownAddress}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setCity('');
                  setTyped(true);
                }}
                placeholder={geocoding ? 'Finding the street…' : 'Type your street or area'}
                aria-label="Delivery address"
                enterKeyHint="search"
                className="flex-1 min-w-0 bg-transparent text-base text-[#241A18] placeholder:text-[#A8988B] outline-hidden truncate"
              />
              {geocoding ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#8C102A] shrink-0" />
              ) : (
                typed &&
                address.trim() && (
                  <button type="submit" aria-label="Find this place on the map" className="p-1 -mr-1 text-[#8C102A] cursor-pointer shrink-0">
                    <Search className="w-5 h-5" />
                  </button>
                )
              )}
            </label>
          </form>

          {tooFar && (
            <div role="alert" className="mt-3 p-3.5 rounded-2xl bg-red-50 border border-red-200">
              <p className="flex items-center gap-2 text-sm font-bold text-red-800">
                <AlertCircle className="w-4 h-4 shrink-0" />
                We can’t deliver to this location
              </p>
              <p className="text-xs text-red-800/90 mt-1 leading-relaxed">
                {deliverFrom
                  ? `Amore ${rangeBranch?.name} delivers within ${DELIVERY_RADIUS_KM} km, and this pin is ${range.km.toFixed(1)} km away.`
                  : `We deliver within ${DELIVERY_RADIUS_KM} km of our parlours. The nearest, Amore ${rangeBranch?.name}, is ${range.km.toFixed(1)} km from this pin.`}{' '}
                {onChoosePickup ? 'You can pick up your order from the parlour instead.' : 'Move the pin closer, or cancel and order for parlour pickup.'}
              </p>
              {onChoosePickup && (
                <button
                  type="button"
                  onClick={() => {
                    onChoosePickup(range.branch);
                    onClose();
                  }}
                  className="mt-3 w-full h-11 rounded-xl bg-white border border-red-200 text-[#8C102A] text-sm font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-red-50/40"
                >
                  <Store className="w-4 h-4" />
                  Pick up from Amore {rangeBranch?.name}
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={confirm}
            disabled={!canConfirm}
            className="mt-4 w-full h-14 rounded-full bg-[#8C102A] hover:bg-[#A31634] text-white text-base font-bold shadow-md transition-colors cursor-pointer active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};
