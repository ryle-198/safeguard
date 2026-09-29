/**
 * Web geocoding via OpenStreetMap Nominatim (free, no API key).
 *
 * Usage policy: max ~1 request/second, no search-as-you-type, and requests
 * must identify the app (browsers send a Referer automatically). Fine for
 * button-press searches and debounced map moves. If web becomes a real
 * product, swap this file for a paid geocoder (Google, Mapbox, etc.) and
 * nothing else needs to change.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

// Bias forward-geocoding to South Africa. Set to undefined for worldwide.
const COUNTRY_CODES: string | undefined = 'za';

export interface GeocodeResult {
  lat: number;
  lng: number;
  label: string;
}

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    q: query,
  });
  if (COUNTRY_CODES) params.set('countrycodes', COUNTRY_CODES);

  const res = await fetch(`${NOMINATIM_URL}/search?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);

  const json = await res.json();
  if (!Array.isArray(json) || json.length === 0) return null;

  return {
    lat: parseFloat(json[0].lat),
    lng: parseFloat(json[0].lon),
    label: json[0].display_name,
  };
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    zoom: '18',
    lat: String(lat),
    lon: String(lng),
  });

  const res = await fetch(`${NOMINATIM_URL}/reverse?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Reverse geocoding failed (${res.status})`);

  const json = await res.json();
  return typeof json?.display_name === 'string' ? json.display_name : null;
}