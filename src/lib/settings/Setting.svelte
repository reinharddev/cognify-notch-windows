<script lang="ts">
  // Satu baris pengaturan: judul, keterangan, dan kontrol di kanan. Dengan `toggle`, baris menjadi saklar
  // dan seluruh barisnya bisa diklik. `why` menjelaskan kenapa baris dimatikan, supaya tidak ada pilihan
  // yang diam-diam tidak bisa dipakai.
  import type { Snippet } from 'svelte';
  import Switch from './Switch.svelte';

  let { title, desc = '', why = '', disabled = false, toggle = false, checked = $bindable(false), onchange, stack = false, sub = false, children }: {
    title: string; desc?: string; why?: string; disabled?: boolean; toggle?: boolean; checked?: boolean;
    onchange?: (v: boolean) => void; stack?: boolean; sub?: boolean; children?: Snippet;
  } = $props();
</script>

{#if toggle}
  <label class="set" class:disabled class:sub>
    <span class="txt"><b>{title}</b>{#if desc}<small>{desc}</small>{/if}{#if disabled && why}<small class="why">{why}</small>{/if}</span>
    <Switch bind:checked {disabled} label={title} {onchange} />
  </label>
{:else}
  <div class="set" class:disabled class:stack class:sub>
    <span class="txt"><b>{title}</b>{#if desc}<small>{desc}</small>{/if}{#if disabled && why}<small class="why">{why}</small>{/if}</span>
    {#if children}<div class="ctl">{@render children()}</div>{/if}
  </div>
{/if}

<style>
  .set { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 16px; min-height: 48px; border-top: 1px solid rgba(255, 255, 255, .06); }
  .set:first-child { border-top: 0; }
  .set.sub { padding-left: 34px; background: rgba(255, 255, 255, .025); }
  label.set { cursor: pointer; }
  label.set:hover { background: rgba(255, 255, 255, .03); }
  label.set.disabled { cursor: not-allowed; }
  .set.stack { flex-direction: column; align-items: stretch; gap: 10px; }
  .txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  b { font-weight: 600; font-size: 13px; }
  small { font-size: 12px; line-height: 1.4; color: var(--dim); }
  small.why { color: var(--warn); }
  .ctl { display: flex; align-items: center; gap: 8px; flex: none; max-width: 100%; }
  .stack .ctl { flex: 1; flex-wrap: wrap; }
  .disabled .txt b, .disabled .txt small:not(.why), .disabled .ctl { opacity: .45; }
  .disabled .ctl { pointer-events: none; }
</style>
