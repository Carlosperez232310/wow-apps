// Leaflet wrapper: zone maps (0-100 map coords) and continent overviews on self-rendered images.
/* global L */
import { esc } from './util.js';

export class MapView {
  constructor(el, zonesData, { onZoneClick } = {}) {
    this.Z = zonesData;
    this.byUi = new Map(zonesData.zones.map(z => [z.uiMapId, z]));
    this.cont = new Map(zonesData.continents.map(c => [c.uiMapId, c]));
    this.onZoneClick = onZoneClick;
    this.map = L.map(el, { crs: L.CRS.Simple, minZoom: -2, maxZoom: 3, zoomSnap: 0.25, attributionControl: true,
      zoomControl: true, maxBoundsViscosity: 0.8 });
    this.map.attributionControl.setPrefix('Leaflet · map art generated from spawn data');
    this.layer = L.layerGroup().addTo(this.map);
    this.labels = L.layerGroup().addTo(this.map);
    this.current = null;
  }
  isContinent(id) { return this.cont.has(id); }
  size(id) {
    if (this.cont.has(id)) { const c = this.cont.get(id); return c.size; }
    return this.Z.zoneSize;
  }
  show(uiMapId) {
    if (this.current === uiMapId) return;
    this.current = uiMapId;
    if (this.img) this.img.remove();
    this.labels.clearLayers();
    const [w, hgt] = this.size(uiMapId);
    const bounds = [[0, 0], [hgt, w]];
    const src = this.cont.has(uiMapId) ? this.cont.get(uiMapId).image : (this.byUi.get(uiMapId) || {}).image;
    if (src) this.img = L.imageOverlay(src, bounds, { className: 'mapimg' }).addTo(this.map);
    this.map.setMaxBounds([[-hgt * 0.3, -w * 0.3], [hgt * 1.3, w * 1.3]]);
    this.map.fitBounds(bounds, { animate: false });
    if (this.cont.has(uiMapId)) this.drawZoneLabels(uiMapId);
  }
  drawZoneLabels(cid) {
    for (const z of this.Z.zones) {
      if (z.parent !== cid || !z.rect || !z.image) continue;
      const cx = (z.rect[0] + z.rect[2]) / 2 * 100, cy = (z.rect[1] + z.rect[3]) / 2 * 100;
      const ll = this.toLatLng(cid, cx, cy, true);
      const m = L.marker(ll, { opacity: 0, interactive: true, keyboard: false, icon: L.divIcon({ className: '', html: '' }) })
        .bindTooltip(esc(z.name), { permanent: true, direction: 'center', className: 'zlabel' });
      m.on('click', () => this.onZoneClick && this.onZoneClick(z.uiMapId));
      this.labels.addLayer(m);
    }
  }
  /** x,y are zone map % for zone `ui`; returns LatLng on the current map or null if not shown there. */
  project(ui, x, y) {
    if (x == null || ui == null) return null;
    if (ui === this.current) return this.toLatLng(ui, x, y);
    if (this.cont.has(this.current)) {
      const z = this.byUi.get(ui);
      if (!z || z.parent !== this.current || !z.rect) return null;
      const fx = (z.rect[0] + (z.rect[2] - z.rect[0]) * x / 100) * 100;
      const fy = (z.rect[1] + (z.rect[3] - z.rect[1]) * y / 100) * 100;
      return this.toLatLng(this.current, fx, fy, true);
    }
    return null;
  }
  toLatLng(id, x, y, continentFrac = false) {
    const [w, hgt] = this.size(id);
    if (continentFrac) {
      const c = this.cont.get(id), [l, t, r, b] = c.crop;
      const px = ((x / 100) - l) / (r - l) * w, py = ((y / 100) - t) / (b - t) * hgt;
      return [hgt - py, px];
    }
    return [hgt - y / 100 * hgt, x / 100 * w];
  }
  clear() { this.layer.clearLayers(); }
  marker(ll, { color, cls = '', html = '', popup, onClick, title }) {
    const icon = L.divIcon({ className: '', iconSize: [18, 18], iconAnchor: [9, 9],
      html: `<div class="mk ${cls}" style="background:${color}" title="${esc(title || '')}">${html}</div>` });
    const m = L.marker(ll, { icon, keyboard: false, riseOnHover: true });
    if (popup) m.bindPopup(popup, { maxWidth: 300 });
    if (onClick) m.on('click', onClick);
    this.layer.addLayer(m);
    return m;
  }
  invalidate() { setTimeout(() => this.map.invalidateSize(), 50); }
}
