<script lang="ts">
  import { onMount } from 'svelte';
  import { L } from '../i18n';

  type CameraChoice = { deviceId: string; label: string };
  let video: HTMLVideoElement | undefined = $state();
  let error = $state('');
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
      error = L('Kamera tidak bisa dipakai. Izinkan kamera untuk app ini di Pengaturan Windows > Privasi > Kamera.', 'Camera unavailable. Allow camera access for this app in Windows Settings > Privacy > Camera.');
      await refreshCameras().catch(() => {});
    }
  }

  function chooseCamera(deviceId: string) {
    selectedCameraId = deviceId;
    if (deviceId) localStorage.setItem('cognify.camera.input', deviceId);
    void startCamera(deviceId);
  }

  onMount(() => {
    gone = false;
    const preferred = localStorage.getItem('cognify.camera.input') ?? '';
    const onDeviceChange = () => { void refreshCameras(); };
    navigator.mediaDevices?.addEventListener('devicechange', onDeviceChange);
    void (async () => {
      await refreshCameras().catch(() => {});
      const available = cameras.some((camera) => camera.deviceId === preferred) ? preferred : '';
      await startCamera(available);
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

<div class="cols" style="align-items:center;gap:22px;padding-left:6px">
  {#if !error}<video bind:this={video} autoplay playsinline muted></video>{:else}<div class="empty camera-error">{error}</div>{/if}
  <div class="col">
    <b style="font-size:15px">{L('Cermin', 'Mirror')}</b>
    <span class="dim" style="max-width:300px">{L('Lihat dirimu sebelum rapat. Kamera hanya menyala selama halaman ini terbuka dan tidak merekam apa pun.', 'Check yourself before a call. The camera is on only while this page is open and nothing is recorded.')}</span>
    {#if cameras.length}
      <label class="camera-picker">
        <span>{L('Input kamera', 'Camera input')}</span>
        <select value={selectedCameraId} onchange={(event) => chooseCamera(event.currentTarget.value)} aria-label={L('Pilih kamera', 'Choose camera')}>
          {#each cameras as camera (camera.deviceId)}<option value={camera.deviceId}>{camera.label}</option>{/each}
        </select>
      </label>
    {/if}
  </div>
</div>

<style>
  /* Kotak tetap di kiri, apa pun resolusi kameranya (mis. OBS 1920x1080): gambar dipotong tengahnya. */
  video { width: 176px; height: 176px; flex: none; border-radius: 28px; transform: scaleX(-1); object-fit: cover; background: #111; }
  .camera-error { max-width: 200px; padding: 12px; font-size: 11px; }
  .camera-picker { display: grid; gap: 5px; max-width: 280px; color: rgba(255,255,255,.56); font-size: 11px; }
  .camera-picker select { width: 100%; min-width: 0; padding: 8px 10px; border: 1px solid rgba(255,255,255,.14); border-radius: 10px; background: rgba(255,255,255,.08); color: #fff; font: inherit; outline: none; }
  .camera-picker option { color: #171717; }
</style>
