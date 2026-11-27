<script lang="ts">
  import type { Snippet } from 'svelte';
  let { title = '', hint = '', action = '', onaction, children }: { title?: string; hint?: string; action?: string; onaction?: () => void; children: Snippet } = $props();
</script>

<section class="grp">
  {#if title}<h3><span>{title}</span>{#if action}<button type="button" onclick={onaction}>{action}</button>{/if}</h3>{/if}
  <div class="card">{@render children()}</div>
  {#if hint}<p class="hint">{hint}</p>{/if}
</section>

<style>
  .grp { margin-top: 14px; }
  h3 { margin: 0 8px 6px; font-size: 12px; font-weight: 600; color: var(--dim); display: flex; justify-content: space-between; align-items: center; }
  h3 button { border: 0; background: none; color: var(--accent); font: inherit; font-size: 12px; text-transform: none; letter-spacing: 0; cursor: pointer; padding: 0 2px; }
  h3 button:hover { text-decoration: underline; }
  .card { display: flex; flex-direction: column; gap: 2px; padding: 6px; background: var(--card); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08); border-radius: 20px; overflow: hidden; }
  .hint { margin: 6px 8px 0; font-size: 11px; line-height: 1.45; color: var(--dim); }
</style>
