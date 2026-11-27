<script lang="ts" generics="T extends string | number">
  // Dropdown sendiri, pengganti <select>. Daftarnya digambar di lapisan teratas (popover) supaya tidak
  // terpotong, tetapi tetap di dalam kotak notch: di luar kotak itu klik tembus dan notch menutup.
  import { ChevronDown, Check } from '@lucide/svelte';
  import { tick } from 'svelte';

  let { options, value = $bindable(), label = '', disabled = false, size = 'md', width = '', onchange }: {
    options: { value: T; label: string }[]; value: T | undefined; label?: string; disabled?: boolean;
    size?: 'sm' | 'md'; width?: string; onchange?: (v: T) => void;
  } = $props();

  const uid = $props.id();
  let open = $state(false);
  let active = $state(0);
  let trigger: HTMLButtonElement;
  let menu = $state<HTMLDivElement>();
  let typed = '';
  let typedTimer: ReturnType<typeof setTimeout>;

  const current = $derived(options.find((o) => o.value === value));
  const GAP = 4;
  const EDGE = 6;

  function place() {
    if (!menu) return;
    const t = trigger.getBoundingClientRect();
    const box = trigger.closest('.shell')?.getBoundingClientRect() ?? new DOMRect(0, 0, innerWidth, innerHeight);
    menu.style.minWidth = `${t.width}px`;
    menu.style.maxWidth = `${box.width - EDGE * 2}px`;
    menu.style.maxHeight = '';
    const want = Math.min(menu.scrollHeight + 2, 260);
    const below = box.bottom - t.bottom - GAP - EDGE;
    const above = t.top - box.top - GAP - EDGE;
    let top: number;
    let height: number;
    if (below >= want || above >= want) {
      height = want;
      top = below >= want ? t.bottom + GAP : t.top - GAP - height;
    } else {
      // Ruang atas dan bawah sempit (panel notch pendek): daftar menutupi tombolnya, setinggi kotak.
      height = Math.min(want, box.height - EDGE * 2);
      top = Math.min(Math.max(t.top, box.top + EDGE), box.bottom - EDGE - height);
    }
    const w = menu.offsetWidth;
    menu.style.top = `${top}px`;
    menu.style.maxHeight = `${height}px`;
    menu.style.left = `${Math.max(box.left + EDGE, Math.min(t.right - w, box.right - EDGE - w))}px`;
  }

  const reveal = () => menu?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });

  async function show() {
    if (disabled || !options.length) return;
    active = Math.max(0, options.findIndex((o) => o.value === value));
    open = true;
    await tick();
    menu?.showPopover();
    place();
    reveal();
  }
  const hide = () => { open = false; };

  function pick(i: number) {
    const o = options[i];
    hide();
    trigger.focus();
    if (!o || o.value === value) return;
    value = o.value;
    onchange?.(o.value);
  }

  function move(i: number) {
    active = Math.min(options.length - 1, Math.max(0, i));
    reveal();
  }

  function onkeydown(e: KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); void show(); }
      return;
    }
    if (e.key === 'Tab') { hide(); return; }
    // Esc hanya menutup daftar, tidak ikut menutup notch.
    e.stopPropagation();
    if (e.key === 'Escape') hide();
    else if (e.key === 'ArrowDown') move(active + 1);
    else if (e.key === 'ArrowUp') move(active - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(options.length - 1);
    else if (e.key === 'Enter' || e.key === ' ') pick(active);
    else if (e.key.length === 1) {
      clearTimeout(typedTimer);
      typed += e.key.toLowerCase();
      typedTimer = setTimeout(() => (typed = ''), 600);
      const i = options.findIndex((o) => o.label.toLowerCase().startsWith(typed));
      if (i >= 0) move(i);
    } else return;
    e.preventDefault();
  }

  $effect(() => {
    if (!open) return;
    const outside = (e: Event) => {
      const n = e.target as Node;
      if (!menu?.contains(n) && !trigger.contains(n)) hide();
    };
    addEventListener('pointerdown', outside, true);
    addEventListener('scroll', outside, true);
    addEventListener('resize', hide);
    addEventListener('blur', hide);
    return () => {
      removeEventListener('pointerdown', outside, true);
      removeEventListener('scroll', outside, true);
      removeEventListener('resize', hide);
      removeEventListener('blur', hide);
    };
  });
  $effect(() => { if (disabled) hide(); });
</script>

<span class="dd" class:sm={size === 'sm'} style:width={width || undefined}>
  <button bind:this={trigger} type="button" class="trigger" role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={open}
    aria-controls="{uid}-list" aria-activedescendant={open ? `${uid}-${active}` : undefined} {disabled} title={current?.label}
    onclick={(e) => { e.preventDefault(); if (open) hide(); else void show(); }} {onkeydown}>
    <span class="val">{current?.label ?? ''}</span>
    <ChevronDown size={size === 'sm' ? 12 : 14} />
  </button>
  {#if open}
    <div bind:this={menu} class="menu" popover="manual" role="listbox" id="{uid}-list" aria-label={label}>
      {#each options as o, i (o.value)}
        <!-- svelte-ignore a11y_click_events_have_key_events (papan ketik ditangani tombol di atas) -->
        <div class="opt" class:active={i === active} role="option" tabindex="-1" id="{uid}-{i}" data-i={i} aria-selected={o.value === value}
          onpointermove={() => (active = i)} onpointerdown={(e) => e.preventDefault()} onclick={(e) => { e.preventDefault(); e.stopPropagation(); pick(i); }}>
          <span>{o.label}</span>
          {#if o.value === value}<Check size={12} strokeWidth={3} />{/if}
        </div>
      {/each}
    </div>
  {/if}
</span>

<style>
  .dd { display: inline-flex; min-width: 130px; max-width: 100%; }
  .dd.sm { min-width: 0; font-size: 10px; }
  .trigger {
    display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-width: 0; height: 28px; padding: 0 10px 0 12px;
    border: 0; border-radius: 99px; background: rgba(255, 255, 255, .09); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .08);
    color: inherit; font: inherit; cursor: pointer; transition: background .15s;
  }
  .sm .trigger { height: 26px; gap: 4px; padding: 0 7px 0 9px; }
  .trigger:hover:not(:disabled) { background: rgba(255, 255, 255, .15); }
  .trigger:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .trigger:disabled { opacity: .45; cursor: default; }
  .trigger :global(svg) { flex: none; opacity: .6; }
  .val { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .menu {
    position: fixed; inset: auto; margin: 0; padding: 4px; overflow-y: auto; overscroll-behavior: contain;
    border: 1px solid rgba(255, 255, 255, .14); border-radius: 12px; background: #1e1e1e; color: #fff;
    box-shadow: 0 8px 24px rgba(0, 0, 0, .45); font: 12px/1.35 'Segoe UI', system-ui, sans-serif; scrollbar-width: thin;
  }
  .opt { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 5px 8px; border-radius: 8px; cursor: pointer; white-space: nowrap; }
  .opt span { overflow: hidden; text-overflow: ellipsis; }
  .opt.active { background: rgba(255, 255, 255, .1); }
  .opt[aria-selected='true'] :global(svg) { flex: none; color: var(--accent); }
</style>
