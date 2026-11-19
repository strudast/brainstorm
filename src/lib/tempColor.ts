/** Shared temperature colour scale: −20°C (blue) → 40°C (red). */
export function tempHue(t: number) {
  const x = Math.min(1, Math.max(0, (t + 20) / 60));
  return 220 - x * 220;
}

export const tempColor = (t: number) => `hsl(${tempHue(t)} 80% 58%)`;

export function tempRgb(t: number): [number, number, number] {
  const h = tempHue(t) / 360;
  const s = 0.8;
  const l = 0.58;
  const q = l + s - l * s;
  const p = 2 * l - q;
  const f = (k: number) => {
    let x = h + k;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [f(1 / 3), f(0), f(-1 / 3)].map((v) => Math.round(v * 255)) as [number, number, number];
}
