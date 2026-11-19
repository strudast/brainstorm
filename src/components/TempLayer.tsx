import { useMemo } from 'react';
import { ImageOverlay } from 'react-leaflet';
import { GRID } from '../api/openMeteo';
import type { TempGrid } from '../api/openMeteo';
import { tempRgb } from '../lib/tempColor';

const SOUTH = GRID.lats[0];
const NORTH = GRID.lats[GRID.lats.length - 1];
const W = 720;
const H = 420;

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const invMercY = (y: number) => (360 / Math.PI) * Math.atan(Math.exp(y)) - 90;

/**
 * Renders the coarse 15°×20° grid as a smooth heat map.
 * Each pixel is mapped back through the Mercator projection (the overlay is stretched in
 * projected space), then bilinearly interpolated between the four surrounding grid points.
 */
function renderGrid(grid: TempGrid): string {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const yN = mercY(NORTH);
  const yS = mercY(SOUTH);
  const nLon = GRID.lons.length;

  for (let py = 0; py < H; py++) {
    const lat = invMercY(yN - ((yN - yS) * (py + 0.5)) / H);
    const fi = Math.min(GRID.lats.length - 1.0001, Math.max(0, (lat - SOUTH) / 15));
    const i0 = Math.floor(fi);
    const ti = fi - i0;
    for (let px = 0; px < W; px++) {
      const lon = -180 + (360 * (px + 0.5)) / W;
      const fj = (lon + 180) / 20;
      const j0 = Math.floor(fj) % nLon;
      const j1 = (j0 + 1) % nLon; // wraps across the antimeridian
      const tj = fj - Math.floor(fj);
      const r0 = grid.temps[i0];
      const r1 = grid.temps[i0 + 1];
      const t =
        (r0[j0] * (1 - tj) + r0[j1] * tj) * (1 - ti) + //
        (r1[j0] * (1 - tj) + r1[j1] * tj) * ti;
      const [r, g, b] = tempRgb(t);
      const k = (py * W + px) * 4;
      img.data[k] = r;
      img.data[k + 1] = g;
      img.data[k + 2] = b;
      img.data[k + 3] = 90;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

export function TempLayer({ grid }: { grid: TempGrid }) {
  const url = useMemo(() => renderGrid(grid), [grid]);
  return (
    <ImageOverlay
      url={url}
      bounds={[
        [SOUTH, -180],
        [NORTH, 180],
      ]}
      className="temp-layer"
      interactive={false}
    />
  );
}

export function TempLegend() {
  return (
    <div className="legend" aria-hidden>
      <span>−20°</span>
      <i />
      <span>40°</span>
    </div>
  );
}
