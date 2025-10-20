import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Bloqueia o pré-bundle/transform dessas libs UMD antigas.
// (Estamos carregando via CDN no runtime, então não devem passar pelo esbuild.)
const EXCLUDES = ['html-docx-js', 'pptxgenjs', 'xlsx', 'html2pdf.js']

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: EXCLUDES,
  },
  build: {
    // Ajuda quando alguma dependência escapar como CJS
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  // Evita que o SSR (se existir) tente empacotar as libs
  ssr: {
    noExternal: EXCLUDES,
  },
})
