import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
// Font inclusi nell'app (non scaricati da internet): funzionano anche offline.
// Inter per i testi, Barlow Condensed per titoli e numeri grandi.
import '@fontsource-variable/inter/wght.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import './stile.css';

// Chiede al browser di non cancellare mai i dati salvati nel dispositivo,
// nemmeno quando la memoria scarseggia. Se non è supportato, pazienza:
// l'app funziona lo stesso.
navigator.storage?.persist?.().catch(() => {});

// Aggiornamenti: quando pubblico una nuova versione, l'app la scarica e si
// ricarica da sola (l'allenamento in corso è salvato, non si perde nulla).
// Sull'iPhone l'app resta spesso aperta in sottofondo: per questo controlla
// anche ogni volta che torna in primo piano e una volta all'ora.
registerSW({
  immediate: true,
  onRegisteredSW(_indirizzo, registrazione) {
    if (!registrazione) return;
    const controlla = () => registrazione.update().catch(() => {});
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') controlla();
    });
    setInterval(controlla, 60 * 60 * 1000);
  },
});

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
