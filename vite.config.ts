import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { version } = JSON.parse(readFileSync('./package.json', 'utf8'));

export default defineConfig({
  plugins: [svelte(), {
    name: 'copy-japanese-reading-dictionary',
    closeBundle() {
      const source = resolve('node_modules/kuroshiro-browser/dist/dict');
      const destination = resolve('dist/dict');
      mkdirSync(destination, { recursive: true });
      cpSync(source, destination, { recursive: true });
    },
  }],
  clearScreen: false,
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: { port: 1430, strictPort: true, host: '127.0.0.1' },
  build: { target: 'es2022', outDir: 'dist' },
});
