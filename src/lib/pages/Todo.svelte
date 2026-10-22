<script lang="ts">
  import { Check, Circle, CircleCheck, Bell, ListChecks, Trash2, Plus } from '@lucide/svelte';
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
    <div class="count"><b>{todo.doneToday}</b><span>/{todo.totalToday}</span></div>
    <small>{L('Tugas selesai hari ini', 'Tasks done today')}</small>
    <div class="field">
      <input type="text" bind:value={text} placeholder={L('Tugas baru, mis. PR jam 7', 'New task, e.g. call at 5pm')} onkeydown={(e) => e.key === 'Enter' && add()} />
      <button class="plus" aria-label={L('Tambah tugas', 'Add task')} disabled={!text.trim()} onclick={add}><Plus size={14} strokeWidth={2.8} /></button>
    </div>
    <div class="chips">
      {#each options as o, i}
        <button class:sel={choice === i} onclick={() => (choice = choice === i ? null : i)}>{o.label}</button>
      {/each}
    </div>
    {#if remind}<span class="rem"><Bell size={10} fill="currentColor" /> {L('Diingatkan ', 'Reminder ')}{when(remind.getTime())}</span>{/if}
  </div>

  <div class="list">
    {#if todo.items.length === 0}
      <div class="empty"><ListChecks size={22} /><span>{L('Belum ada tugas. Tulis di kiri, tekan Enter.', 'No tasks yet. Type on the left and press Enter.')}</span></div>
    {/if}
    {#each todo.sorted as t (t.id)}
      <div class="item" class:done={t.done}>
        <button class="chk" aria-label={t.done ? L('Batal selesai', 'Mark as not done') : L('Selesai', 'Mark as done')} onclick={() => todo.toggle(t.id)}>
          {#if t.done}<CircleCheck size={15} />{:else}<Circle size={15} />{/if}
        </button>
        <span class="txt">{t.text}</span>
        {#if t.due}
          <span class="when" class:late={!t.done && t.due < ticker.now}>{when(t.due)}</span>
        {:else if t.done}<span class="when">{L('selesai', 'done')}</span>{/if}
        <button class="del" aria-label={L('Hapus', 'Delete')} onclick={() => todo.remove(t.id)}><Trash2 size={11} /></button>
      </div>
    {/each}
  </div>
</div>

<style>
  .todo { display: flex; gap: 18px; height: 100%; }
  .left { width: 230px; flex: none; display: flex; flex-direction: column; gap: 6px; }
  .count { display: flex; align-items: baseline; gap: 2px; }
  .count b { font-size: 34px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .count span { font-size: 17px; font-weight: 600; color: rgba(255, 255, 255, .5); }
  small { font-size: 11px; color: rgba(255, 255, 255, .55); }
  .field { display: flex; gap: 6px; align-items: center; }
  .field input { flex: 1; min-width: 0; height: 28px; padding: 0 8px; border: 1px solid transparent; border-radius: 9px; background: rgba(255, 255, 255, .07); color: #fff; font-size: 11.5px; outline: none; }
  .field input:focus { background: rgba(255, 255, 255, .1); border-color: color-mix(in srgb, var(--accent) 70%, transparent); }
  .plus { width: 28px; height: 28px; border: 0; border-radius: 50%; background: var(--accent); color: #0b0a1a; display: grid; place-items: center; cursor: pointer; flex: none; }
  .plus:disabled { opacity: .35; cursor: default; }
  .chips { display: flex; gap: 4px; }
  .chips button { border: 0; border-radius: 99px; padding: 4px 6px; font-size: 10px; font-weight: 600; white-space: nowrap; background: rgba(255, 255, 255, .08); color: #fff; cursor: pointer; }
  .chips button.sel { background: var(--accent); color: #0b0a1a; }
  .rem { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; color: var(--accent); }
  .list { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; overflow-y: auto; align-content: start; }
  .list::-webkit-scrollbar { width: 0; }
  .empty { display: flex; align-items: center; gap: 8px; color: rgba(255, 255, 255, .4); font-size: 11.5px; }
  .item { display: flex; align-items: center; gap: 8px; padding: 6px 9px; border-radius: 9px; background: rgba(255, 255, 255, .06); flex: none; }
  .item:hover { background: rgba(255, 255, 255, .1); }
  .chk { border: 0; background: none; padding: 0; color: rgba(255, 255, 255, .5); cursor: pointer; display: grid; }
  .done .chk { color: #5fd38d; }
  .txt { flex: 1; min-width: 0; font-size: 11.5px; font-weight: 500; color: rgba(255, 255, 255, .95); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .done .txt { text-decoration: line-through; color: rgba(255, 255, 255, .4); }
  .when { font-size: 10px; font-weight: 500; font-variant-numeric: tabular-nums; color: rgba(255, 255, 255, .5); white-space: nowrap; }
  .done .when { color: rgba(255, 255, 255, .3); }
  .when.late { color: #ff9f43; }
  .del { border: 0; background: none; color: rgba(255, 255, 255, .6); cursor: pointer; display: none; padding: 0; }
  .item:hover .del { display: grid; }
</style>
