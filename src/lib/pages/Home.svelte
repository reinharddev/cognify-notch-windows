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
  <div class="agenda">
    <span class="label">{agenda.enabled ? L('Agenda', 'Agenda') : L('Berikutnya', 'Up next')}</span>
    {#if !agenda.enabled}
      <span class="ph"><CalendarDays size={12} /> {L('Tambahkan kalender (tautan ICS atau Cognify) di Pengaturan', 'Add a calendar (ICS link or Cognify) in Settings')}</span>
    {:else if rows.length === 0}
      <span class="ph"><ShieldCheck size={12} /> {agenda.problem || L('Tidak ada acara hari ini & besok', 'Nothing today or tomorrow')}</span>
    {:else}
      {#each rows as e (e.id)}
        {@const join = agenda.joinable(e, ticker.now)}
        <div class="ev">
          <span class="bar" class:soon={soon(e)}></span>
          <span class="txt"><b>{e.title}</b><small>{e.calendar ?? ''}</small></span>
          {#if join}
            <button class="pill" onclick={() => cmd('open_target', { target: e.meeting })}><Video size={11} /> {L('Gabung', 'Join')}</button>
          {:else}
            <span class="when" class:soon={soon(e)}>{relativeLong(e.start, e.allDay, ticker.now)}</span>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
  <QuickNote />
</div>

<style>
  .home { display: flex; gap: 14px; height: 100%; }
  .agenda { width: 318px; flex: none; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .label { padding-left: 6px; margin-bottom: 2px; font-size: 9.5px; letter-spacing: .06em; font-weight: 600; text-transform: uppercase; color: rgba(255, 255, 255, .42); }
  .ph { display: inline-flex; align-items: center; gap: 8px; padding: 4px 0 0 6px; font-size: 11.5px; color: rgba(255, 255, 255, .5); }
  .ev { display: flex; align-items: center; gap: 9px; padding: 2px 6px; border-radius: 9px; }
  .ev:hover { background: rgba(255, 255, 255, .08); }
  .bar { width: 4px; height: 24px; margin: 0 10px; border-radius: 2px; background: var(--accent); flex: none; }
  .bar.soon { background: #ff9f0a; }
  .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .txt b { font-size: 12px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .txt small { font-size: 10.5px; color: rgba(255, 255, 255, .5); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .when { font-size: 10.5px; font-weight: 500; font-variant-numeric: tabular-nums; color: rgba(255, 255, 255, .6); white-space: nowrap; }
  .when.soon { color: #ff9f0a; }
  .pill { display: inline-flex; align-items: center; gap: 4px; border: 0; border-radius: 99px; padding: 4px 10px; font-size: 11px; font-weight: 600; color: #fff; background: color-mix(in srgb, var(--accent) 90%, transparent); cursor: pointer; }
</style>
