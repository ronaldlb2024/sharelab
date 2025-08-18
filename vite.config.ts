import { defineConfig } from 'vite';

// Configuração mínima do Vite. A aplicação é servida a partir da pasta `public` para
// simplificar a estrutura: os arquivos HTML de paciente e médico estão lá e
// referenciam os scripts compilados em `public/js`.
export default defineConfig({
  root: 'public',
  publicDir: 'public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        paciente: 'public/paciente.html',
        medico: 'public/medico.html'
      }
    }
  },
  server: {
    port: 5173,
    open: false
  }
});