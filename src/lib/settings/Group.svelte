<script lang="ts">
  import type { Snippet } from 'svelte';
  let { title = '', hint = '', children }: { title?: string; hint?: string; children: Snippet } = $props();
</script>

<section class="grp">
  {#if title}<h3>{title}</h3>{/if}
  <div class="card">{@render children()}</div>
  {#if hint}<p class="hint">{hint}</p>{/if}
</section>

<style>
  .grp { margin-top: 22px; }
  h3 { margin: 0 0 8px 4px; font-size: 12px; font-weight: 600; color: var(--dim); }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  .hint { margin: 8px 4px 0; font-size: 12px; line-height: 1.45; color: var(--dim); }
</style>
