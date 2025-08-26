// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/sharelab/', // ajuste se o nome do repo for outro
  server: { port: 5173, open: false }
});
