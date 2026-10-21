import { mount } from 'svelte';
import './app.css';
import { windowKind } from './lib/bridge';
import App from './App.svelte';
import SettingsWindow from './SettingsWindow.svelte';

// Satu bundel untuk dua jendela: notch (transparan) dan Pengaturan (jendela biasa).
if (windowKind === 'settings') document.body.classList.add('settings-window');
mount(windowKind === 'settings' ? SettingsWindow : App, { target: document.getElementById('app')! });
