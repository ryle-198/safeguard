/**
 * Leaflet needs its stylesheet or tiles render scrambled. Metro's CSS support
 * varies by Expo SDK version, so this injects a <link> tag once instead.
 * Keep the version in sync with the `leaflet` version in package.json.
 */
const LEAFLET_CSS_ID = 'leaflet-css';
const LEAFLET_CSS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

export function ensureLeafletCss(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(LEAFLET_CSS_ID)) return;

  const link = document.createElement('link');
  link.id = LEAFLET_CSS_ID;
  link.rel = 'stylesheet';
  link.href = LEAFLET_CSS_URL;
  document.head.appendChild(link);
}