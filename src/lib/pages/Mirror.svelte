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
{:else}
  <div class="cols" style="align-items:center;gap:22px;padding-left:6px">
    <video bind:this={video} autoplay playsinline muted></video>
    <div class="col">
      <b style="font-size:15px">{L('Cermin', 'Mirror')}</b>
      <span class="dim" style="max-width:300px">{L('Lihat dirimu sebelum rapat. Kamera hanya menyala selama halaman ini terbuka dan tidak merekam apa pun.', 'Check yourself before a call. The camera is on only while this page is open and nothing is recorded.')}</span>
    </div>
  </div>
{/if}

<style>
  /* Kotak tetap di kiri, apa pun resolusi kameranya (mis. OBS 1920x1080): gambar dipotong tengahnya. */
  video { width: 176px; height: 176px; flex: none; border-radius: 28px; transform: scaleX(-1); object-fit: cover; background: #111; }
</style>
