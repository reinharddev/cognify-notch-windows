<script lang="ts">
  import { CalendarDays, ShieldCheck, Video } from '@lucide/svelte';
  import { L } from '../i18n';
  import { ticker } from '../store.svelte';
  import { agenda } from '../agenda.svelte';
  import { relativeLong } from '../relative';
  import { cmd } from '../bridge';
  import QuickNote from '../QuickNote.svelte';

  // Susunan sama dengan Beranda di Mac: agenda 318 lebar di kiri, catatan cepat di kanan.
  const rows = $derived(agenda.events.slice(0, 3));
  const soon = (e: { allDay: boolean; start: number }) => !e.allDay && e.start - ticker.now < 3600_000;
</script>

<div class="home">
  <div class="card scroll">
    <div class="lb">{agenda.enabled ? L('Agenda', 'Agenda') : L('Berikutnya', 'Up next')}</div>
    {#if !agenda.enabled}
      <span class="ph"><CalendarDays size={12} /> {L('Tambahkan kalender (tautan ICS atau Cognify) di Pengaturan', 'Add a calendar in Settings (an ICS link or Cognify)')}</span>
    {:else if rows.length === 0}
      <span class="ph"><ShieldCheck size={12} /> {agenda.problem || L('Hari ini & besok kosong', 'Nothing today or tomorrow')}</span>
    {:else}
      {#each rows as e (e.id)}
        {@const join = agenda.joinable(e, ticker.now)}
        <div class="ev" style:--c={soon(e) ? '#0a84ff' : '#ff375f'}>
          <span class="txt"><b class="one">{e.title}</b><small class="one">{e.calendar ?? ''}</small></span>
          {#if join}
            <button class="btn on" onclick={() => cmd('open_target', { target: e.meeting })}><Video size={11} /> {L('Gabung', 'Join')}</button>
          {:else}
            <span class="chip">{relativeLong(e.start, e.allDay, ticker.now)}</span>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
  <div class="card"><QuickNote /></div>
</div>

<style>
  .home { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; height: 164px; }
  .ph { display: flex; align-items: center; gap: 8px; padding: 0 8px; font-size: 11.5px; color: var(--muted); }
  .ev { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex: none; margin-bottom: 4px; padding: 3px 8px; border-radius: 12px; }
  .ev:hover { background: rgba(255, 255, 255, .06); }
  .txt { position: relative; flex: 1; min-width: 0; padding-left: 12px; }
  .txt::before { content: ''; position: absolute; left: 0; top: 2px; bottom: 2px; width: 4px; border-radius: 99px; background: var(--c); }
  .txt b { font-size: 12.5px; }
</style>
