import { defineConfig } from 'vite';

// base './' = semua path relatif, wajib agar jalan di Android (Capacitor).
export default defineConfig({
  base: './',
  build: { outDir: 'dist', target: 'es2020' },
});
