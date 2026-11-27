<script lang="ts">
  import Input from '../ui/Input.svelte';
  import { Bell, Check, ListChecks, Plus, Trash2 } from '@lucide/svelte';
  import { todo } from '../state.svelte';
  import { parseDue } from '../due';
  import { L } from '../i18n';
  import { ticker } from '../store.svelte';
  import { relativeLong } from '../relative';

  // Susunan sama dengan Mac: kiri jumlah selesai hari ini, kolom tugas baru, dan pilihan waktu cepat; kanan daftar.
  let text = $state('');
  let choice = $state<number | null>(null);

  const at = (hour: number, tomorrow = false) => {
    const d = new Date();
    if (tomorrow) d.setDate(d.getDate() + 1);
    d.setHours(hour, 0, 0, 0);
    if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
    return d;
  };
  const options = [
    { label: L('+30 mnt', '+30 min'), date: () => new Date(Date.now() + 30 * 60_000) },
    { label: L('+1 jam', '+1 h'), date: () => new Date(Date.now() + 3600_000) },
    { label: L('19.00', '7 PM'), date: () => at(19) },
    { label: L('Besok 07', 'Tmrw 7'), date: () => at(7, true) },
  ];
  const due = $derived(choice === null ? null : options[choice].date());
  const parsed = $derived(parseDue(text));
  const remind = $derived(due ?? parsed);

  const add = () => { if (!text.trim()) return; todo.add(text, due ?? undefined); text = ''; choice = null; };

  const when = (t: number) => relativeLong(t, false, ticker.now);
</script>

<div class="todo">
  <div class="left">
    <div class="count"><b>{todo.doneToday}</b><span>/ {todo.totalToday}</span></div>
    <small>{L('Tugas selesai hari ini', 'Tasks done today')}</small>
    <div class="field">
      <Input bare bind:value={text} placeholder={L('Tugas baru, mis. PR jam 7', 'New task, e.g. call at 5pm')} aria-label={L('Tugas baru', 'New task')} onkeydown={(e) => e.key === 'Enter' && add()} />
      <button class="round on" aria-label={L('Tambah tugas', 'Add task')} disabled={!text.trim()} onclick={add}><Plus size={14} strokeWidth={2.8} /></button>
    </div>
    <div class="chips">
      {#each options as o, i}<button class="btn" class:on={choice === i} aria-pressed={choice === i} onclick={() => (choice = choice === i ? null : i)}>{o.label}</button>{/each}
    </div>
    {#if remind}<span class="rem"><Bell size={10} fill="currentColor" /> {L('Diingatkan ', 'Reminder ')}{when(remind.getTime())}</span>{/if}
  </div>

  <div class="card scroll tasks">
    {#if todo.items.length === 0}
      <div class="empty"><ListChecks size={20} /><span>{L('Belum ada tugas. Tulis di kiri, lalu tekan Enter.', 'No tasks yet. Type one on the left and press Enter.')}</span></div>
    {/if}
    {#each todo.sorted as t, i (t.id)}
      <div class="task" class:done={t.done}>
        <button class="box" aria-label={t.done ? L('Batal selesai', 'Mark as not done') : L('Selesai', 'Mark as done')} onclick={() => todo.toggle(t.id)}>
          {#if t.done}<Check size={11} strokeWidth={3.2} />{/if}
        </button>
        <span class="grow one">{t.text}</span>
        {#if t.done}<span class="tag">{L('selesai', 'done')}</span>
        {:else if i === 0}<span class="tag hot">{t.due ? when(t.due) : L('Sekarang', 'Current')}</span>
        {:else if t.due}<span class="tag" class:late={t.due < ticker.now}>{when(t.due)}</span>{/if}
        <button class="icon del" aria-label={L('Hapus', 'Delete')} onclick={() => todo.remove(t.id)}><Trash2 size={11} /></button>
      </div>
    {/each}
  </div>
</div>

<style>
  .todo { display: grid; grid-template-columns: 190px minmax(0, 1fr); gap: 12px; height: 164px; padding-left: 8px; }
  .left { display: flex; flex-direction: column; min-width: 0; }
  .count b { font-size: 30px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.15; }
  .count span { margin-left: 4px; font-size: 13px; color: var(--muted); }
  .field { display: flex; align-items: center; gap: 6px; height: 34px; flex: none; margin: 6px 0; padding: 0 3px 0 12px; border-radius: 99px; background: rgba(0, 0, 0, .6); border: 1px solid rgba(255, 255, 255, .09); }
  .field:focus-within { border-color: var(--accent); }
  .field :global(input) { flex: 1; min-width: 0; color: var(--ink, #fff); font-size: 11px; }
  .chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .chips .btn { height: 22px; padding: 0 9px; }
  .rem { display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; font-size: 10px; color: var(--hi); }
  .tasks { gap: 4px; }
  .empty { display: flex; align-items: center; gap: 8px; padding: 4px 8px; color: var(--muted); font-size: 11.5px; }
  .task { display: flex; align-items: center; gap: 8px; height: 34px; flex: none; padding: 0 8px; border-radius: 12px; background: rgba(255, 255, 255, .06); font-size: 12px; }
  .box { display: grid; place-items: center; flex: none; width: 18px; height: 18px; padding: 0; border-radius: 50%; border: 1.5px solid #8e8e93; background: none; cursor: pointer; }
  .done .box { background: #30d158; border-color: #30d158; color: #000; }
  .done .grow { color: var(--muted); text-decoration: line-through; }
  .tag { font-size: 10px; color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .tag.late { color: #ff9f43; }
  .tag.hot { color: #ffb340; background: rgba(255, 159, 10, .18); padding: 2px 8px; border-radius: 99px; font-weight: 600; }
  .del { display: none; }
  .task:hover .del, .del:focus-visible { display: grid; }
</style>
