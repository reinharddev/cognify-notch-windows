<script lang="ts">
  // Saklar ala Windows 11: bulat, bergeser, warna aksen saat nyala.
  let { checked = $bindable(false), disabled = false, label = '', onchange }: { checked?: boolean; disabled?: boolean; label?: string; onchange?: (v: boolean) => void } = $props();
  function flip() {
    if (disabled) return;
    checked = !checked;
    onchange?.(checked);
  }
</script>

<button type="button" role="switch" aria-checked={checked} aria-label={label} {disabled} class="sw" class:on={checked}
  onclick={(e) => { e.preventDefault(); flip(); }}><i></i></button>

<style>
  .sw { flex: none; position: relative; width: 40px; height: 22px; padding: 0; border-radius: 99px; cursor: pointer;
    border: 1px solid rgba(255, 255, 255, .5); background: transparent; transition: background .15s, border-color .15s; }
  .sw i { position: absolute; top: 50%; left: 4px; width: 12px; height: 12px; border-radius: 50%; background: rgba(255, 255, 255, .85);
    transform: translateY(-50%); transition: left .15s, width .15s, height .15s, background .15s; }
  .sw:hover:not(:disabled) i { width: 14px; height: 14px; }
  .sw.on { background: var(--accent); border-color: var(--accent); }
  .sw.on i { left: 22px; background: #0b0a1a; }
  .sw.on:hover:not(:disabled) i { left: 21px; }
  .sw:disabled { cursor: not-allowed; }
  .sw:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { .sw, .sw i { transition: none; } }
</style>
