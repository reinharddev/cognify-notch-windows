<script lang="ts">
  import Input from '../ui/Input.svelte';
  import { FilePlus, Pin, Search, StickyNote } from '@lucide/svelte';
  import { hub, currentOrNext } from '../hub.svelte';
  import { ticker } from '../store.svelte';
  import { timeText } from '../relative';
  import { L } from '../i18n';

  // Halaman Cognify (hanya ada selagi terhubung): pelajaran hari ini, dokumen, Alat, cari, dan aksi cepat.
  let q = $state('');
  let timer = 0;
  const data = $derived(hub.data);
  const slot = $derived(data ? currentOrNext(data.lessons, ticker.now) : null);
  const docs = $derived(data ? [...data.pinned.map((d) => ({ ...d, pin: true })), ...data.recent.map((d) => ({ ...d, pin: false }))] : []);
  const left = (ms: number) => {
    const m = Math.max(0, Math.ceil((ms - ticker.now) / 60000));
    return m < 60 ? `${m} ${L('mnt', 'min')}` : `${Math.floor(m / 60)}${L('j', 'h')} ${m % 60}${L('m', 'm')}`;
  };
  const onInput = () => {
    window.clearTimeout(timer);
    if (!q.trim()) { void hub.search(''); return; }
    timer = window.setTimeout(() => void hub.search(q), 300);
  };
  const open = (id: string) => void hub.open(id);
</script>

<div class="three">
  <div class="card scroll">
    <div class="lb">{L('Pelajaran hari ini', "Today's lessons")}</div>
    {#if slot}
      <div class="lesson">
        <span class="one">{slot.lesson.title}</span>
        <small>{timeText(new Date(slot.lesson.start))} - {timeText(new Date(slot.lesson.end))}{slot.lesson.room ? ` · ${slot.lesson.room}` : ''}</small>
        <small class="when">{slot.ongoing ? L(`Selesai ${left(Date.parse(slot.lesson.end))} lagi`, `Ends in ${left(Date.parse(slot.lesson.end))}`) : L(`Mulai ${left(Date.parse(slot.lesson.start))} lagi`, `Starts in ${left(Date.parse(slot.lesson.start))}`)}</small>
      </div>
    {:else}<span class="ph">{L('Pelajaran hari ini sudah habis.', 'No more lessons today.')}</span>{/if}
    <div class="acts">
      <button class="btn" onclick={() => void hub.newDoc()}><FilePlus size={12} /> {L('Dokumen', 'Doc')}</button>
      <button class="btn" onclick={() => void hub.newSticky()}><StickyNote size={12} /> {L('Catatan', 'Notes')}</button>
    </div>
  </div>

  <div class="card scroll">
    <div class="lb">{L('Cari catatan', 'Search notes')}</div>
    <label class="find">
      <Input bare bind:value={q} oninput={onInput} placeholder={L('Ketik kata kunci', 'Type a keyword')} aria-label={L('Cari dokumen', 'Search documents')}
        onkeydown={(e) => { if (e.ctrlKey || e.metaKey) e.stopPropagation(); }} />
      <Search size={13} />
    </label>
    {#if q.trim() && (hub.searching || hub.hits)}
      {#if hub.searching}<span class="ph">{L('Mencari…', 'Searching…')}</span>
      {:else if hub.hits?.length === 0}<span class="ph">{L('Tidak ketemu.', 'No results.')}</span>
      {:else}{#each hub.hits ?? [] as h (h.id)}<button class="li doc" onclick={() => open(h.id)}><span class="one">{h.title}</span></button>{/each}{/if}
    {:else}
      {#each docs as d (d.id)}<button class="li doc" onclick={() => open(d.id)}>{#if d.pin}<Pin size={11} />{/if}<span class="one">{d.title}</span></button>
      {:else}<span class="ph">{L('Belum ada.', 'None yet.')}</span>{/each}
    {/if}
  </div>

  <div class="card scroll">
    <div class="lb">{L('Alat', 'Tools')}</div>
    <div class="tools">
      {#each data?.tools ?? [] as t (t.id)}<button class="btn" onclick={() => void hub.tool(t.id)}><span class="one">{t.name}</span></button>
      {:else}<span class="ph">{L('Belum ada.', 'None yet.')}</span>{/each}
    </div>
  </div>
</div>

<style>
  .three { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; height: 164px; }
  .card { gap: 6px; }
  .lb { margin: 2px 4px 0; flex: none; }
  .lesson { display: flex; flex-direction: column; flex: none; min-width: 0; padding: 4px 8px; border-radius: 12px; background: var(--soft); font-size: 12px; }
  .when { color: var(--hi); }
  .acts { display: flex; gap: 4px; }
  .find { display: flex; align-items: center; gap: 6px; height: 30px; flex: none; padding: 0 10px 0 12px; border-radius: 99px; background: rgba(0, 0, 0, .6); border: 1px solid rgba(255, 255, 255, .09); color: var(--muted); }
  .find:focus-within { border-color: var(--accent); }
  .find :global(input) { flex: 1; min-width: 0; color: var(--ink, #fff); font-size: 11px; }
  .doc { border: 0; color: inherit; font: inherit; font-size: 11px; text-align: left; cursor: pointer; }
  .doc:hover { background: rgba(255, 255, 255, .12); }
  .tools { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 6px; }
  .tools .btn { height: 32px; width: 100%; padding: 0 6px; }
  .ph { padding: 0 4px; font-size: 11.5px; color: var(--muted); }
</style>
