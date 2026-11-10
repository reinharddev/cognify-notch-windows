<script lang="ts">
  import { FilePlus, Search, StickyNote } from '@lucide/svelte';
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

<div class="col" style="height:100%">
  <div class="row">
    <label class="find"><Search size={12} />
      <input type="text" bind:value={q} oninput={onInput} placeholder={L('Cari dokumen di Cognify…', 'Search documents in Cognify…')} aria-label={L('Cari dokumen', 'Search documents')}
        onkeydown={(e) => { if (e.ctrlKey || e.metaKey) e.stopPropagation(); }} />
    </label>
    <button class="btn" onclick={() => void hub.newDoc()}><FilePlus size={12} /> {L('Dokumen', 'Doc')}</button>
    <button class="btn" onclick={() => void hub.newSticky()}><StickyNote size={12} /> {L('Catatan melayang', 'Sticky')}</button>
  </div>
  {#if q.trim() && (hub.searching || hub.hits)}
    <div class="list">
      {#if hub.searching}<span class="ph">{L('Mencari…', 'Searching…')}</span>
      {:else if hub.hits?.length === 0}<span class="ph">{L('Tidak ada hasil.', 'No results.')}</span>
      {:else}{#each hub.hits ?? [] as h (h.id)}
        <button class="item" onclick={() => open(h.id)}><span class="t">{h.title}</span>{#if h.snippet}<small>{h.snippet}</small>{/if}</button>
      {/each}{/if}
    </div>
  {:else}
    <div class="cols">
      <section>
        <span class="label">{L('Hari ini', 'Today')}</span>
        {#if slot}
          <div class="lesson">
            <span class="t">{slot.lesson.title}</span>
            <small>{timeText(new Date(slot.lesson.start))} - {timeText(new Date(slot.lesson.end))}{slot.lesson.room ? ` · ${slot.lesson.room}` : ''}</small>
            <small class="when">{slot.ongoing ? L(`Selesai ${left(Date.parse(slot.lesson.end))} lagi`, `Ends in ${left(Date.parse(slot.lesson.end))}`) : L(`Mulai ${left(Date.parse(slot.lesson.start))} lagi`, `Starts in ${left(Date.parse(slot.lesson.start))}`)}</small>
          </div>
        {:else}<span class="ph">{L('Tidak ada pelajaran lagi.', 'No more lessons today.')}</span>{/if}
      </section>
      <section>
        <span class="label">{L('Dokumen', 'Documents')}</span>
        <div class="list">
          {#each docs as d (d.id)}<button class="item" onclick={() => open(d.id)}><span class="t">{d.pin ? '★ ' : ''}{d.title}</span></button>
          {:else}<span class="ph">{L('Belum ada.', 'None yet.')}</span>{/each}
        </div>
      </section>
      <section>
        <span class="label">{L('Alat', 'Tools')}</span>
        <div class="list">
          {#each data?.tools ?? [] as t (t.id)}<button class="item" onclick={() => void hub.tool(t.id)}><span class="t">{t.name}</span></button>
          {:else}<span class="ph">{L('Belum ada.', 'None yet.')}</span>{/each}
        </div>
      </section>
    </div>
  {/if}
</div>

<style>
  .find { flex: 1; display: flex; align-items: center; gap: 6px; padding: 0 10px; height: 26px; border-radius: 99px; background: rgba(255, 255, 255, .08); color: rgba(255, 255, 255, .45); }
  .find:focus-within { background: rgba(255, 255, 255, .12); }
  .find input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: #fff; font: inherit; font-size: 11.5px; }
  .btn { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
  .cols { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; min-height: 0; flex: 1; }
  section { display: flex; flex-direction: column; gap: 5px; min-width: 0; min-height: 0; }
  .label { padding-left: 6px; font-size: 9.5px; letter-spacing: .06em; font-weight: 600; text-transform: uppercase; color: rgba(255, 255, 255, .42); }
  .list { display: flex; flex-direction: column; gap: 4px; overflow-y: auto; min-height: 0; }
  .list::-webkit-scrollbar { width: 0; }
  .item { display: flex; flex-direction: column; gap: 1px; text-align: left; border: 0; border-radius: 8px; padding: 5px 9px; background: rgba(255, 255, 255, .06); color: inherit; font: inherit; cursor: pointer; flex: none; }
  .item:hover { background: rgba(255, 255, 255, .12); }
  .t { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  small { font-size: 10px; color: rgba(255, 255, 255, .5); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lesson { display: flex; flex-direction: column; gap: 2px; padding: 7px 10px; border-radius: 9px; background: rgba(255, 255, 255, .07); }
  .when { color: var(--accent); font-weight: 600; }
  .ph { padding-left: 6px; font-size: 11.5px; color: rgba(255, 255, 255, .5); }
</style>
