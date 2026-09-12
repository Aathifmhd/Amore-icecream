import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  MapPin,
  Navigation,
  Check,
  Compass,
  AlertCircle,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAddress?: string;
  initialCity?: string;
  initialCoords?: { lat: number; lng: number };
  onSelectLocation: (location: {
    address: string;
    city: string;
    coords: { lat: number; lng: number };
  }) => void;
}

// Sri Lanka Branch Defaults
const BRANCH_DEFAULTS = {
  colombo: { lat: 6.8835, lng: 79.8569, name: 'Colombo Marine Drive', city: 'Colombo' },
  akurana: { lat: 7.3639, lng: 80.6175, name: 'Akurana Flagship', city: 'Akurana' },
  arugambay: { lat: 6.8427, lng: 81.8344, name: 'Arugam Bay Surf', city: 'Arugam Bay' },
};

declare global {
  interface Window {
    L: any;
  }
}

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  onClose,
  initialAddress = '',
  initialCity = '',
  initialCoords,
  onSelectLocation,
}) => {
  const [coords, setCoords] = useState<{ lat: number; lng: number }>(
    initialCoords || { lat: BRANCH_DEFAULTS.colombo.lat, lng: BRANCH_DEFAULTS.colombo.lng }
  );
  const [address, setAddress] = useState(initialAddress);
  const [city, setCity] = useState(initialCity);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);

  // Load Leaflet dynamically
  useEffect(() => {
    if (!isOpen) return;

    if (window.L) {
      setLeafletLoaded(true);
      return;
    }

    // Check if stylesheet is already attached
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Load Leaflet script
    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => {
        setLeafletLoaded(true);
      };
      document.body.appendChild(script);
    } else {
      const existing = document.getElementById('leaflet-js') as HTMLScriptElement;
      if (existing) {
        existing.addEventListener('load', () => setLeafletLoaded(true));
      }
    }
  }, [isOpen]);

  // Reverse geocode coordinates to street address and city
  const reverseGeocode = async (lat: number, lng: number) => {
    setIsGeocoding(true);
    setStatusMessage('Resolving street address from pin...');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en',
          },
        }
      );
      if (!res.ok) throw new Error('Geocoding service unavailable');
      const data = await res.json();

      if (data && data.address) {
        const addr = data.address;
        const road = addr.road || addr.street || addr.neighbourhood || addr.suburb || '';
        const houseNo = addr.house_number ? `${addr.house_number}, ` : '';
        const suburb = addr.suburb || addr.neighbourhood || '';
        const resolvedCity =
          addr.city || addr.town || addr.municipality || addr.village || addr.county || 'Colombo';

        let formattedStreet = '';
        if (road && suburb && road !== suburb) {
          formattedStreet = `${houseNo}${road}, ${suburb}`;
        } else if (road) {
          formattedStreet = `${houseNo}${road}`;
        } else {
          formattedStreet = data.display_name?.split(',').slice(0, 2).join(',') || 'Delivery Address';
        }

        setAddress(formattedStreet.trim());
        setCity(resolvedCity.trim());
        setStatusMessage(`Location identified: ${resolvedCity}`);
      }
    } catch (err) {
      console.warn('Reverse geocoding error:', err);
      setStatusMessage('Pin placed. You can adjust the street address details manually below.');
    } finally {
      setIsGeocoding(false);
    }
  };

  // Forward geocode search query to coordinates
  const handleSearchLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsGeocoding(true);
    setStatusMessage(`Searching for "${searchQuery}"...`);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery + ', Sri Lanka'
        )}&limit=1`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        updatePinPosition(lat, lng, true);
        reverseGeocode(lat, lng);
      } else {
        setStatusMessage('Location not found. Try dragging the pin on the map.');
      }
    } catch (err) {
      console.warn('Geocoding search error:', err);
      setStatusMessage('Search error. Please move the pin on the map.');
    } finally {
      setIsGeocoding(false);
    }
  };

  // Browser GPS detection
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsDetecting(true);
    setStatusMessage('Accessing GPS satellite coordinates...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsDetecting(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        updatePinPosition(lat, lng, true);
        reverseGeocode(lat, lng);
      },
      (err) => {
        setIsDetecting(false);
        console.warn('Geolocation error:', err);
        setStatusMessage('Could not detect GPS. Please click or drag the pin on the map.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Update pin position on map
  const updatePinPosition = (lat: number, lng: number, recenter = false) => {
    setCoords({ lat, lng });

    if (markerInstanceRef.current) {
      markerInstanceRef.current.setLatLng([lat, lng]);
    }

    if (recenter && mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lng], 16, { animate: true });
    }
  };

  // Initialize map when leaflet is ready and modal is open
  useEffect(() => {
    if (!isOpen || !leafletLoaded || !mapContainerRef.current) return;

    // Delay slightly for container dimension resolution
    const timeout = setTimeout(() => {
      if (!mapContainerRef.current) return;

      // Clean existing instance
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const L = window.L;
      if (!L) return;

      // Create Custom Gelato Pin Icon
      const pinIcon = L.divIcon({
        className: 'amore-custom-map-pin',
        html: `
          <div style="
            width: 38px;
            height: 38px;
            background: #8C102A;
            border: 3px solid #FFF;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 4px 12px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: grab;
          ">
            <span style="transform: rotate(45deg); font-size: 16px;">🍨</span>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 38],
        popupAnchor: [0, -38],
      });

      // Initialize map
      const map = L.map(mapContainerRef.current, {
        center: [coords.lat, coords.lng],
        zoom: 15,
        zoomControl: true,
      });

      // OpenStreetMap Tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Add Draggable Marker
      const marker = L.marker([coords.lat, coords.lng], {
        icon: pinIcon,
        draggable: true,
      }).addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setCoords({ lat: pos.lat, lng: pos.lng });
        reverseGeocode(pos.lat, pos.lng);
      });

      // Click on map to drop/move pin
      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        setCoords({ lat, lng });
        reverseGeocode(lat, lng);
      });

      mapInstanceRef.current = map;
      markerInstanceRef.current = marker;

      // Initial reverse geocode if address empty
      if (!address.trim()) {
        reverseGeocode(coords.lat, coords.lng);
      }
    }, 150);

    return () => {
      clearTimeout(timeout);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, leafletLoaded]);

  // ESC handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirmLocation = () => {
    if (!address.trim()) {
      alert('Please provide or confirm your street address.');
      return;
    }
    onSelectLocation({
      address: address.trim(),
      city: city.trim() || 'Colombo',
      coords,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-fadeIn overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl border border-[#E8DFC8] my-auto flex flex-col max-h-[92vh] animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#FAF7F2] px-5 py-3.5 border-b border-[#E8DFC8] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#8C102A] text-white flex items-center justify-center shadow-xs">
              <MapPin className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h2 className="font-serif-title font-bold text-lg text-[#241A18] leading-tight">
                Pin Your Delivery Address
              </h2>
              <p className="text-[11px] text-[#7A6458]">
                Detect your GPS or drag the gelato pin directly to your doorstep
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center border border-[#E0D5C3] text-[#241A18] cursor-pointer shadow-2xs"
            aria-label="Close location picker"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar & Fast GPS Detection */}
        <div className="p-3 sm:px-4 bg-[#FAF7F2]/60 border-b border-[#E8DFC8] flex flex-col sm:flex-row items-center gap-2 shrink-0">
          <form onSubmit={handleSearchLocation} className="relative flex-1 w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search area (e.g. Marine Drive, Akurana, Galle Road)..."
              className="w-full pl-8 pr-16 py-2 text-xs bg-white rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A]"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-[#8C102A] text-white text-[10px] font-bold rounded-lg hover:bg-[#A31634] cursor-pointer"
            >
              Search
            </button>
          </form>

          {/* Detect GPS Button */}
          <button
            type="button"
            onClick={handleDetectGPS}
            disabled={isDetecting}
            className="w-full sm:w-auto px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
            title="Detect precise GPS location from device"
          >
            {isDetecting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Locating GPS...</span>
              </>
            ) : (
              <>
                <Navigation className="w-3.5 h-3.5 text-emerald-200" />
                <span>Detect My Location</span>
              </>
            )}
          </button>
        </div>

        {/* Branch Presets */}
        <div className="px-4 py-2 bg-[#F6F2E9] border-b border-[#E8DFC8]/60 flex items-center gap-2 overflow-x-auto text-[11px] shrink-0">
          <span className="font-bold text-[#7A6458] whitespace-nowrap">Quick Jump:</span>
          {Object.entries(BRANCH_DEFAULTS).map(([key, b]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                updatePinPosition(b.lat, b.lng, true);
                reverseGeocode(b.lat, b.lng);
              }}
              className="px-2.5 py-0.5 rounded-full bg-white border border-[#D9CBB7] hover:border-[#8C102A] text-[#3D2C24] font-medium whitespace-nowrap transition-colors cursor-pointer shadow-2xs"
            >
              📍 {b.name}
            </button>
          ))}
        </div>

        {/* Map View Area */}
        <div className="relative flex-1 min-h-[260px] sm:min-h-[320px] bg-slate-100">
          <div ref={mapContainerRef} className="w-full h-full min-h-[260px] sm:min-h-[320px]" />

          {/* Hint Overlay */}
          <div className="absolute top-2 left-2 z-20 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-[#D9CBB7] text-[10px] text-[#3D2C24] font-semibold shadow-xs pointer-events-none">
            💡 Click anywhere or drag the 🍨 pin to pinpoint your home
          </div>

          {/* Geocoding status pill */}
          {statusMessage && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 bg-[#241A18]/90 text-white px-3 py-1 rounded-full text-[10px] font-medium shadow-md pointer-events-none whitespace-nowrap flex items-center gap-1.5">
              {isGeocoding && <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-300" />}
              <span>{statusMessage}</span>
            </div>
          )}
        </div>

        {/* Confirmed Address Details Inputs */}
        <div className="p-4 bg-[#FAF7F2] border-t border-[#E8DFC8] space-y-2.5 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase text-[#7A6458] mb-0.5">
                Street Address / House No.
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street address (detected automatically)"
                className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A] font-medium text-[#241A18]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-[#7A6458] mb-0.5">
                City / Area
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-[#D9CBB7] focus:outline-hidden focus:border-[#8C102A] font-medium text-[#241A18]"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1">
            <span className="text-[10px] text-slate-500 font-mono">
              GPS: {coords.lat.toFixed(5)}° N, {coords.lng.toFixed(5)}° E
            </span>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-white border border-[#D9CBB7] text-xs font-bold text-[#5D4E46] hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLocation}
                className="px-5 py-2 rounded-xl bg-[#8C102A] hover:bg-[#A31634] text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirm & Use This Location</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

