<script lang="ts" generics="T extends string | number | boolean">
  // Pilihan tunggal berdampingan. Bila lebar tidak cukup, pilihan turun baris, tidak terpotong.
  let { options, value = $bindable(), disabled = false, label = '', onchange }: {
    options: { value: T; label: string; disabled?: boolean }[]; value: T; disabled?: boolean; label?: string; onchange?: (v: T) => void;
  } = $props();
</script>

<div class="seg" role="radiogroup" aria-label={label}>
  {#each options as o (o.value)}
    <button type="button" role="radio" aria-checked={value === o.value} class:sel={value === o.value} disabled={disabled || o.disabled}
      onclick={() => { value = o.value; onchange?.(o.value); }}>{o.label}</button>
  {/each}
</div>

<style>
  .seg { display: inline-flex; flex-wrap: wrap; gap: 2px; padding: 3px; border-radius: 8px; background: rgba(255, 255, 255, .07); }
  button { border: 0; background: none; color: var(--dim); font: inherit; font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 6px; cursor: pointer; }
  button:hover:not(:disabled):not(.sel) { background: rgba(255, 255, 255, .08); color: #fff; }
  button.sel { background: var(--accent); color: #0b0a1a; }
  button:disabled { opacity: .4; cursor: not-allowed; }
  button:focus-visible { outline: 2px solid #fff; outline-offset: 1px; }
</style>
