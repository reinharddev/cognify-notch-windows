import {
  ArrowBigUp, ArrowBigUpDash, BatteryFull, BatteryLow, BatteryMedium, BatteryWarning, Bell, CircleCheck, CircleX, Headphones,
  Keyboard, Sun, SunDim, TriangleAlert, Volume1, Volume2, VolumeX, Wifi, WifiOff, Zap,
} from '@lucide/svelte';

// Padanan ikon SF Symbols yang dipakai versi Mac. Nama mengikuti Lucide.
export const ICONS = {
  zap: Zap, bell: Bell, headphones: Headphones, keyboard: Keyboard, wifi: Wifi, 'wifi-off': WifiOff,
  'battery-full': BatteryFull, 'battery-medium': BatteryMedium, 'battery-low': BatteryLow, 'battery-warning': BatteryWarning,
  'circle-check': CircleCheck, 'circle-x': CircleX, 'triangle-alert': TriangleAlert,
  'caps-on': ArrowBigUp, 'caps-off': ArrowBigUpDash,
  sun: Sun, 'sun-dim': SunDim, 'volume-x': VolumeX, 'volume-1': Volume1, 'volume-2': Volume2,
} as const;
export type IconName = keyof typeof ICONS;

// Warna sama dengan Mac (Color.green, .red, .orange, .gray, .yellow, dan aksen).
export const TINT = {
  green: '#30d158', red: '#ff453a', orange: '#ff9f0a', gray: 'rgba(255,255,255,.55)', white: '#ffffff',
  yellow: '#ffd60a', accent: 'var(--accent)',
} as const;
