import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pacchetto from './package.json';

// Colore di sfondo dell'app: usato anche per la barra di stato dell'iPhone
// e per la schermata di avvio.
const SFONDO = '#0d0f12';

export default defineConfig({
  // Percorsi relativi: l'app funziona sia in locale sia in una sottocartella
  // (es. https://utente.github.io/allenamento/) senza cambiare nulla.
  base: './',
  // Numero di versione mostrato nella sezione Altro (preso da package.json).
  define: {
    __VERSIONE__: JSON.stringify(pacchetto.version),
  },
  plugins: [
    react(),
    VitePWA({
      // Il service worker si aggiorna da solo quando pubblico una nuova versione.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Allenamento',
        short_name: 'Allenamento',
        description: 'Diario personale degli allenamenti e del peso corporeo',
        lang: 'it',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: SFONDO,
        theme_color: SFONDO,
        icons: [
          { src: 'icona-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icona-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icona-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Tutti i file dell'app vengono salvati nel telefono: funziona senza rete.
        // Del font si salva solo l'alfabeto latino (le altre lingue non servono).
        globPatterns: [
          '**/*.{js,css,html,svg,png,webmanifest}',
          '**/inter-latin-wght-normal-*.woff2',
          '**/barlow-condensed-latin-*-normal-*.woff2',
        ],
      },
    }),
  ],
});
