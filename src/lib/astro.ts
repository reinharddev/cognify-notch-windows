import { STARS, LINES, NAMES } from './skyData';
import { smooth01 } from './sky';

// Bintang, rasi, dan planet nyata untuk langit malam, dihitung lokal dari lokasi dan waktu.
const parse = (s: string) => s.split(';').map((r) => r.split(',').map(Number));
const stars = parse(STARS);                                // [ra, dec, mag]
const lines = LINES.split('|').map(parse);                 // polyline [ra, dec]
const names = NAMES.split(';').map((r) => { const p = r.split(','); return { name: p[0], ra: +p[1], dec: +p[2] }; });
const rad = Math.PI / 180;

export interface Sight { lat: number; lst: number; ms: number }
export const sightAt = (lat: number, lon: number, ms: number): Sight => {
  const jd = ms / 86_400_000 + 2_440_587.5;
  return { lat, lst: (280.46061837 + 360.98564736629 * (jd - 2_451_545.0) + lon) % 360, ms };
};

/** Tinggi dan arah (0 = utara, 90 = timur) dalam derajat. */
function altAz(s: Sight, ra: number, dec: number) {
  const d = dec * rad, h = (s.lst - ra) * rad, p = s.lat * rad;
  const alt = Math.asin(Math.max(-1, Math.min(1, Math.sin(d) * Math.sin(p) + Math.cos(d) * Math.cos(p) * Math.cos(h))));
  const az = Math.atan2(-Math.cos(d) * Math.sin(h), Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.cos(h) * Math.sin(p));
  return { alt: alt / rad, az: (az / rad + 360) % 360 };
}

/** Layar menghadap selatan di belahan utara dan utara di belahan selatan, lebar pandang 150 derajat. */
const point = (s: Sight, a: { alt: number; az: number }, w: number, h: number) => {
  const d = ((a.az - (s.lat >= 0 ? 180 : 0) + 540) % 360) - 180;
  return { x: w / 2 + (d / 150) * w, y: h * (0.66 - (a.alt / 62) * 0.62) };
};

const kepler = (M: number, e: number) => { let E = M + e * Math.sin(M) * (1 + e * Math.cos(M)); for (let i = 0; i < 4; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); return E; };
function helio(N: number, i: number, w: number, a: number, e: number, M: number) {
  const E = kepler(((M % 360) + 360) % 360 * rad, e), xv = a * (Math.cos(E) - e), yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const u = Math.atan2(yv, xv) + w * rad, r = Math.hypot(xv, yv);
  return [r * (Math.cos(N * rad) * Math.cos(u) - Math.sin(N * rad) * Math.sin(u) * Math.cos(i * rad)),
          r * (Math.sin(N * rad) * Math.cos(u) + Math.cos(N * rad) * Math.sin(u) * Math.cos(i * rad)),
          r * Math.sin(u) * Math.sin(i * rad)];
}

/** Planet terang dengan unsur orbit sederhana (galat sekitar satu derajat, cukup untuk dilukis). */
function planets(ms: number) {
  const d = ms / 86_400_000 + 2_440_587.5 - 2_451_543.5;
  const sun = helio(0, 0, 282.9404 + 4.70935e-5 * d, 1, 0.016709 - 1.151e-9 * d, 356.0470 + 0.9856002585 * d);
  const ecl = (23.4393 - 3.563e-7 * d) * rad;
  const defs: [number, number, number, number, number, number, number, string][] = [
    [48.3313 + 3.24587e-5 * d, 7.0047 + 5e-8 * d, 29.1241 + 1.01444e-5 * d, 0.387098, 0.205635 + 5.59e-10 * d, 168.6562 + 4.0923344368 * d, 0, '209,204,199'],
    [76.6799 + 2.4659e-5 * d, 3.3946 + 2.75e-8 * d, 54.891 + 1.38374e-5 * d, 0.72333, 0.006773 - 1.302e-9 * d, 48.0052 + 1.6021302244 * d, -4, '255,245,209'],
    [49.5574 + 2.11081e-5 * d, 1.8497 - 1.78e-8 * d, 286.5016 + 2.92961e-5 * d, 1.523688, 0.093405 + 2.516e-9 * d, 18.6021 + 0.5240207766 * d, 0.5, '255,158,107'],
    [100.4542 + 2.76854e-5 * d, 1.303 - 1.557e-7 * d, 273.8777 + 1.64505e-5 * d, 5.20256, 0.048498 + 4.469e-9 * d, 19.895 + 0.0830853001 * d, -2.2, '255,237,204'],
    [113.6634 + 2.3898e-5 * d, 2.4886 - 1.081e-7 * d, 339.3939 + 2.97661e-5 * d, 9.55475, 0.055546 - 9.499e-9 * d, 316.967 + 0.0334442282 * d, 0.8, '245,230,184'],
  ];
  return defs.map(([N, i, w, a, e, M, mag, color]) => {
    const h = helio(N, i, w, a, e, M), x = h[0] + sun[0], y = h[1] + sun[1], z = h[2];
    const ye = y * Math.cos(ecl) - z * Math.sin(ecl), ze = y * Math.sin(ecl) + z * Math.cos(ecl);
    return { ra: (Math.atan2(ye, x) / rad + 360) % 360, dec: Math.atan2(ze, Math.hypot(x, ye)) / rad, mag, color };
  });
}

const rnd = (i: number, k: number) => { const v = Math.sin(i * 131 + k * 17 + 1.7) * 43758.5453; return v - Math.floor(v); };

/** Bintang, garis rasi, nama rasi, dan planet pada posisi sebenarnya untuk lokasi dan waktu pengamat. */
export function drawChart(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, alpha: number, s: Sight) {
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.15})`; ctx.lineWidth = 0.6; ctx.beginPath();
  for (const line of lines) {
    let prev: { x: number; y: number } | null = null;
    for (const [ra, dec] of line) {
      const a = altAz(s, ra, dec), p = point(s, a, w, h);
      if (prev && a.alt > 1 && Math.abs(p.x - prev.x) < w * 0.5) { ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); }
      prev = a.alt > 1 ? p : null;
    }
  }
  ctx.stroke();
  for (let i = 0; i < stars.length; i++) {
    const [ra, dec, mag] = stars[i], a = altAz(s, ra, dec);
    if (a.alt <= -1) continue;
    const p = point(s, a, w, h);
    if (p.x < -4 || p.x > w + 4) continue;
    const tw = 0.75 + 0.25 * Math.sin(t * (0.8 + rnd(i, 3)) + rnd(i, 4) * 6), r = Math.min(2.4, 0.55 + (4.7 - mag) * 0.42);
    ctx.fillStyle = `rgba(255,255,255,${alpha * tw * smooth01(a.alt / 6) * (0.55 + 0.45 * Math.min(1, (5 - mag) / 3))})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, r / 2, 0, Math.PI * 2); ctx.fill();
  }
  for (const pl of planets(s.ms)) {
    const a = altAz(s, pl.ra, pl.dec);
    if (a.alt <= 0) continue;
    const p = point(s, a, w, h), r = 1.8 + Math.min(1.4, Math.max(0, 1 - pl.mag) * 0.4), al = Math.min(1, alpha * 1.3) * smooth01(a.alt / 6);
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.2);
    g.addColorStop(0, `rgba(${pl.color},${0.35 * al})`); g.addColorStop(1, `rgba(${pl.color},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(${pl.color},${al})`; ctx.beginPath(); ctx.arc(p.x, p.y, r / 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.font = '500 7.5px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const n of names) {
    const a = altAz(s, n.ra, n.dec);
    if (a.alt <= 14) continue;
    const p = point(s, a, w, h);
    if (p.x < 24 || p.x > w - 24) continue;
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.26 * smooth01((a.alt - 14) / 8)})`; ctx.fillText(n.name, p.x, p.y);
  }
}
