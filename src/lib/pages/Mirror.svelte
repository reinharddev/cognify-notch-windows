<script lang="ts">
  import Select from '../ui/Select.svelte';
  import MicCard from '../MicCard.svelte';
  import { features } from '../system.svelte';
  import { onMount, tick } from 'svelte';
  import { ScanFace } from '@lucide/svelte';
  import { L } from '../i18n';

  type CameraChoice = { deviceId: string; label: string };
  let video: HTMLVideoElement | undefined = $state();
  let error = $state('');
  // Kamera mati sampai dinyalakan sendiri.
  let on = $state(false);
  let cameras = $state<CameraChoice[]>([]);
  let selectedCameraId = $state('');
  let stream: MediaStream | undefined;
  let gone = false;
  let requestId = 0;

  async function refreshCameras() {
    const devices = await navigator.mediaDevices?.enumerateDevices();
    cameras = (devices ?? []).filter((d) => d.kind === 'videoinput').map((d, i) => ({
      deviceId: d.deviceId,
      label: d.label || `${L('Kamera', 'Camera')} ${i + 1}`,
    }));
    if (!cameras.some((camera) => camera.deviceId === selectedCameraId)) {
      selectedCameraId = cameras[0]?.deviceId ?? '';
    }
  }

  async function startCamera(deviceId = '') {
    const request = ++requestId;
    stream?.getTracks().forEach((track) => track.stop());
    stream = undefined;
    error = '';
    try {
      const videoConstraints: MediaTrackConstraints = { width: { ideal: 640 }, height: { ideal: 360 } };
      if (deviceId) videoConstraints.deviceId = { exact: deviceId };
      const next = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
      if (gone || request !== requestId) return next.getTracks().forEach((track) => track.stop());
      stream = next;
      const actualId = next.getVideoTracks()[0]?.getSettings().deviceId;
      if (actualId) selectedCameraId = actualId;
      if (video) video.srcObject = next;
      await refreshCameras();
    } catch {
      if (gone || request !== requestId) return;
      error = L('Kamera tidak bisa dipakai. Izinkan kamera buat app ini di Pengaturan Windows > Privasi > Kamera.', 'Can\'t use the camera. Allow it for this app in Windows Settings > Privacy > Camera.');
      await refreshCameras().catch(() => {});
    }
  }

  function stopCamera() {
    requestId++;
    on = false;
    error = '';
    stream?.getTracks().forEach((track) => track.stop());
    stream = undefined;
  }

  async function toggleCamera() {
    if (on) return stopCamera();
    on = true;
    await tick(); // elemen video baru ada setelah `on`
    await startCamera(selectedCameraId);
  }

  function chooseCamera(deviceId: string) {
    selectedCameraId = deviceId;
    if (deviceId) localStorage.setItem('cognify.camera.input', deviceId);
    if (on) void startCamera(deviceId);
  }

  onMount(() => {
    gone = false;
    const preferred = localStorage.getItem('cognify.camera.input') ?? '';
    const onDeviceChange = () => { void refreshCameras(); };
    navigator.mediaDevices?.addEventListener('devicechange', onDeviceChange);
    void (async () => {
      await refreshCameras().catch(() => {});
      if (cameras.some((camera) => camera.deviceId === preferred)) selectedCameraId = preferred;
    })();
    return () => {
      gone = true;
      requestId++;
      navigator.mediaDevices?.removeEventListener('devicechange', onDeviceChange);
      stream?.getTracks().forEach((track) => track.stop());
      stream = undefined;
    };
  });
</script>

<div class="mirror" class:solo={!features.camera || !features.micTest}>
  {#if features.camera}
    <div class="card cam">
      {#if on && !error}<video bind:this={video} autoplay playsinline muted></video>{:else if error}<p class="err">{error}</p>{:else}<ScanFace size={40} strokeWidth={1} />{/if}
      {#if cameras.length}
        <div class="pick"><Select size="sm" value={selectedCameraId} onchange={(v) => chooseCamera(v)} width="100%" label="Choose camera"
          options={cameras.map((c) => ({ value: c.deviceId, label: c.label }))} /></div>
      {/if}
      <button class="btn toggle" onclick={toggleCamera}>{on ? 'Turn camera off' : 'Turn camera on'}</button>
    </div>
  {/if}
  {#if features.micTest}<MicCard />{/if}
</div>

<style>
  .mirror { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 8px; height: 164px; }
  .mirror.solo { grid-template-columns: minmax(0, 1fr); }
  .cam { position: relative; align-items: center; justify-content: center; padding: 0; overflow: hidden; color: var(--muted); }
  /* Gambar dipotong tengahnya, apa pun resolusi kameranya (mis. OBS 1920x1080). */
  video { width: 100%; height: 100%; transform: scaleX(-1); object-fit: cover; }
  .pick { position: absolute; left: 8px; right: 8px; top: 6px; }
  .toggle { position: absolute; bottom: 8px; }
  .err { margin: 0; padding: 0 16px 20px; font-size: 11px; text-align: center; color: #ffb4a8; }
</style>
