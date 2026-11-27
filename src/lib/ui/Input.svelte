<script lang="ts" generics="V extends string | number = string">
  // Kolom isian bersama: teks, angka, waktu, pencarian, dan (dengan `multiline`) teks panjang.
  // `bare` tanpa latar, untuk dipakai di dalam kotak yang sudah punya latar sendiri.
  import type { HTMLInputAttributes, HTMLTextareaAttributes } from 'svelte/elements';

  let { value = $bindable(), type = 'text', multiline = false, bare = false, size = 'md', width = '', ...rest }:
    Omit<HTMLInputAttributes & HTMLTextareaAttributes, 'value' | 'size' | 'width' | 'type'> & {
      value?: V; type?: HTMLInputAttributes['type']; multiline?: boolean; bare?: boolean; size?: 'sm' | 'md'; width?: string;
    } = $props();

  // Sama seperti bind:value bawaan: kolom angka menghasilkan angka, selain itu teks.
  const oninput = (e: Event) => {
    const el = e.currentTarget as HTMLInputElement;
    value = el.value as V;
    (rest.oninput as ((ev: Event) => void) | undefined)?.(e);
  };
</script>

{#if multiline}
  <textarea {...rest} class="in multi" class:bare class:sm={size === 'sm'} style:width={width || undefined} {value} {oninput}></textarea>
{:else}
  <input {...rest} {type} class="in" class:bare class:sm={size === 'sm'} style:width={width || undefined} {value} {oninput} />
{/if}

<style>
  .in {
    box-sizing: border-box; width: 100%; min-width: 0; height: 28px; padding: 0 10px; border: 1px solid transparent; border-radius: 9px;
    background: rgba(255, 255, 255, .08); color: inherit; font: inherit; outline: none; color-scheme: dark;
    user-select: text; -webkit-user-select: text; transition: background .15s, border-color .15s;
  }
  .in.sm { height: 26px; font-size: 11px; }
  .in::placeholder { color: rgba(255, 255, 255, .4); }
  .in:focus { background: rgba(255, 255, 255, .12); border-color: color-mix(in srgb, var(--accent) 70%, transparent); }
  .in:disabled { opacity: .45; }
  .multi { height: 66px; padding: 8px; border-radius: 10px; resize: none; }
  .in.bare { height: auto; padding: 0; border: 0; border-radius: 0; background: none; }
  .in::-webkit-search-cancel-button { display: none; }
</style>
