import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** `npm run demo`: abre a interface do painel no navegador, sem instalar a extensão. */
export default defineConfig({
  root: here('.'),
  plugins: [react()],
  resolve: {
    alias: {
      'wxt/browser': here('./mock-browser.ts'),
      'wxt/utils/storage': here('./mock-storage.ts'),
    },
  },
  server: { port: 5199, strictPort: true },
});
