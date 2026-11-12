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
  .sw { flex: none; position: relative; width: 38px; height: 22px; padding: 0; border-radius: 99px; cursor: pointer; border: 0; background: rgba(255, 255, 255, .16); transition: background .15s; }
  .sw i { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .3); transition: transform .15s; }
  .sw.on { background: var(--accent); }
  .sw.on i { transform: translateX(16px); }
  .sw:disabled { cursor: not-allowed; }
  .sw:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { .sw, .sw i { transition: none; } }
</style>
