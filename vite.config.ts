import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pacchetto from './package.json';

// Colore di sfondo dell'app: usato anche per la barra di stato dell'iPhone
// e per la schermata di avvio.
const SFONDO = '#07090c';

// Regole di sicurezza (Content Security Policy) per la versione pubblicata,
// le stesse di Bilancio. Il browser carica solo i file dell'app stessa e
// BLOCCA ogni collegamento verso altri siti: anche se un giorno entrasse
// del codice estraneo, non potrebbe spedire i tuoi dati da nessuna parte.
// Solo in "build": durante lo sviluppo Vite ha bisogno di più libertà.
const SICUREZZA = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // colori delle icone scritti direttamente negli elementi
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'", // nessuna richiesta verso altri siti
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function regoleSicurezza(): Plugin {
  return {
    name: 'regole-sicurezza',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${SICUREZZA}" />\n    <meta name="referrer" content="no-referrer" />`),
  };
}

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
    regoleSicurezza(),
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
