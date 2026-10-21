<script lang="ts">
  import { onMount } from 'svelte';
  import { L } from '../i18n';
  let video: HTMLVideoElement | undefined = $state();
  let error = $state('');

  // Kamera hanya menyala selama halaman ini terbuka.
  onMount(() => {
    let stream: MediaStream | undefined;
    let gone = false;
    navigator.mediaDevices?.getUserMedia({ video: { width: 640, height: 360 } }).then((s) => {
      if (gone) return s.getTracks().forEach((t) => t.stop());
      stream = s;
      if (video) video.srcObject = s;
    }).catch(() => (error = L('Kamera tidak bisa dipakai. Izinkan kamera untuk app ini di Pengaturan Windows > Privasi > Kamera.', 'Camera unavailable. Allow camera access for this app in Windows Settings > Privacy > Camera.')));
    return () => { gone = true; stream?.getTracks().forEach((t) => t.stop()); };
  });
</script>

{#if error}<div class="empty">{error}</div>
{:else}<div class="wrap"><video bind:this={video} autoplay playsinline muted></video></div>{/if}

<style>
  .wrap { height: 100%; display: grid; place-items: center; }
  video { height: 100%; max-width: 100%; border-radius: 14px; transform: scaleX(-1); object-fit: cover; background: #111; }
</style>
