import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Font inclusi nell'app (non scaricati da internet): funzionano anche offline.
// Inter per i testi, Barlow Condensed per titoli e numeri grandi.
import '@fontsource-variable/inter/wght.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import './stile.css';

// Chiede al browser di non cancellare mai i dati salvati nel dispositivo,
// nemmeno quando la memoria scarseggia. Se non è supportato, pazienza:
// l'app funziona lo stesso.
navigator.storage?.persist?.().catch(() => {});

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
