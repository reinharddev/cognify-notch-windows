<script lang="ts">
  import { weather } from '../weather.svelte';
  import { ticker } from '../store.svelte';
  import { skyPosition, skyWeather, weatherLabel, smooth01, moonPhase } from '../sky';
  import { L } from '../i18n';

  // Halaman Langit: jam besar, kota dan cuaca (kiri), setengah lingkaran lintasan matahari/bulan (kanan).
  const ms = $derived(weather.clockOverride ?? ticker.now);
  const sun = $derived(weather.now?.sun ?? null);
  const pos = $derived(skyPosition(ms, sun));
  const kind = $derived(weather.now ? skyWeather(weather.now.code) : null);
  const hm = (t: number) => {
    const d = new Date(t + (sun ? sun.offset * 1000 : -new Date(t).getTimezoneOffset() * 60_000));
    return `${String(d.getUTCHours()).padStart(2, '0')}.${String(d.getUTCMinutes()).padStart(2, '0')}`;
  };

  // Busur lingkaran dangkal: lebar 280, tinggi 40; bulat mulus di puncak, menyentuh cakrawala dengan sudut kecil.
  const CX = 160, BASE = 108, RX = 140, RY = 40;
  const RC = (RX * RX + RY * RY) / (2 * RY), HALF = Math.asin(RX / RC);
  const pt = (p: number) => { const phi = -HALF + 2 * HALF * p; return [CX + RC * Math.sin(phi), BASE + RC - RY - RC * Math.cos(phi)]; };
  const track = (to: number) => {
    let d = '';
    for (let k = 0; k <= 90; k++) { const [x, y] = pt((to * k) / 90); d += `${k ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }
    return d;
  };
  const dot = $derived(pt(pos.progress));

  // Matahari: makin dekat cakrawala makin oranye. Bulan: bentuk terang dari fase sebenarnya.
  const mixc = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
  const warm = $derived(1 - smooth01(pos.horizon / 90));
  const sunTint = $derived(mixc([255, 242, 189], [255, 148, 61], warm));
  const sunCore = $derived(mixc([255, 252, 235], [255, 219, 153], warm));
  const R = 10;
  const moon = $derived.by(() => {
    const phase = moonPhase(ms), k = Math.cos(2 * Math.PI * phase), side = (phase < 0.5 ? 1 : -1) * ((weather.observer?.lat ?? 0) < 0 ? -1 : 1), n = 36;
    const pts: string[] = [];
    for (let i = 0; i <= n; i++) { const th = -Math.PI / 2 + (Math.PI * i) / n; pts.push(`${(side * R * Math.cos(th)).toFixed(2)},${(R * Math.sin(th)).toFixed(2)}`); }
    for (let i = 0; i <= n; i++) { const th = Math.PI / 2 - (Math.PI * i) / n; pts.push(`${(side * R * k * Math.cos(th)).toFixed(2)},${(R * Math.sin(th)).toFixed(2)}`); }
    return pts.join(' ');
  });
</script>

<div class="sky">
  <div class="info">
    <span class="big">{hm(ms)}</span>
    {#if weather.now && kind}
      <span class="cond">{weather.now.temp}° · {weatherLabel(kind)}</span>
      <span class="place">{weather.now.place}</span>
    {:else}
      <span class="place">{weather.problem || L('Nyalakan Cuaca dan isi kota di Pengaturan untuk matahari dan cuaca asli (sementara 06.00 sampai 18.00).', 'Turn on Weather and enter a city in Settings for real sun times and weather (6 am to 6 pm for now).')}</span>
    {/if}
  </div>
  <svg viewBox="0 0 320 138" aria-hidden="true">
    <line x1="8" y1={BASE} x2="312" y2={BASE} stroke="currentColor" stroke-opacity=".55" stroke-width="1" />
    <path d={track(1)} fill="none" stroke="currentColor" stroke-opacity=".28" stroke-width="3" stroke-linecap="round" />
    <path d={track(pos.progress)} fill="none" stroke="currentColor" stroke-opacity=".85" stroke-width="3" stroke-linecap="round" />
    <defs>
      <radialGradient id="sunHalo"><stop offset="0.15" stop-color={sunTint} stop-opacity=".5" /><stop offset="1" stop-color={sunTint} stop-opacity="0" /></radialGradient>
      <radialGradient id="sunDisc" cx="35%" cy="35%" r="75%"><stop offset="0" stop-color={sunCore} /><stop offset="1" stop-color={sunTint} /></radialGradient>
      <radialGradient id="moonHalo"><stop offset="0.15" stop-color="rgb(199,214,255)" stop-opacity=".32" /><stop offset="1" stop-color="rgb(199,214,255)" stop-opacity="0" /></radialGradient>
    </defs>
    {#if pos.isDay}
      <g transform="translate({dot[0]} {dot[1]})">
        <circle r="26" fill="url(#sunHalo)" />
        <g stroke={sunTint} stroke-width="1.8" stroke-linecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="52s" repeatCount="indefinite" />
          {#each Array(12) as _, i}<line class="ray" style:animation-delay="{-i * 0.25}s" x1="13.5" y1="0" x2="17.7" y2="0" transform="rotate({i * 30})" />{/each}
        </g>
        <circle r="9" fill="url(#sunDisc)" />
      </g>
    {:else}
      <g transform="translate({dot[0]} {dot[1]})">
        <circle r="24" fill="url(#moonHalo)" />
        <circle r={R} fill="rgba(168,184,230,.3)" />
        <polygon points={moon} fill="#f5f7ff" />
      </g>
    {/if}
    <text x={CX - RX} y={BASE + 18} text-anchor="middle">↑ {sun ? hm(sun.sunrise) : '06.00'}</text>
    <text x={CX + RX} y={BASE + 18} text-anchor="middle">↓ {sun ? hm(sun.sunset) : '18.00'}</text>
  </svg>
</div>

<style>
  .sky { display: flex; align-items: center; gap: 20px; height: 100%; }
  .info { width: 210px; display: flex; flex-direction: column; gap: 4px; }
  .big { font-size: 46px; font-weight: 300; line-height: 1.05; font-variant-numeric: tabular-nums; letter-spacing: -.01em; }
  .cond { font-size: 12.5px; font-weight: 600; }
  .place { font-size: 10.5px; color: color-mix(in srgb, currentColor 75%, transparent); display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .ray { animation: pulse 2.6s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
  svg { flex: 1; min-width: 0; height: 138px; }
  text { font-size: 11px; font-weight: 600; fill: currentColor; fill-opacity: .85; }
</style>
