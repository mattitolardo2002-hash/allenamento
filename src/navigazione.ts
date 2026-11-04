import { useEffect, useState } from 'react';

// Le sezioni dell'app. Quelle con `inBarra` compaiono nella barra in basso
// (due a sinistra e due a destra del "+"); le schede si aprono da Allenati.
export const SEZIONI = [
  { id: 'allenati', etichetta: 'Allenati', inBarra: true },
  { id: 'progressi', etichetta: 'Progressi', inBarra: true },
  { id: 'peso', etichetta: 'Peso', inBarra: true },
  { id: 'altro', etichetta: 'Altro', inBarra: true },
  { id: 'schede', etichetta: 'Schede', inBarra: false },
] as const;

export type IdSezione = (typeof SEZIONI)[number]['id'];

export interface Posizione {
  sezione: IdSezione;
  /** Elemento aperto dentro la sezione (es. la scheda in modifica), se c'è. */
  dettaglio: string | null;
}

// Legge la posizione dall'indirizzo (es. ...#/schede/allenamento-1). Usare
// l'indirizzo permette di ricaricare la pagina restando nello stesso punto
// e di usare il tasto Indietro sul Mac.
function posizioneDaIndirizzo(): Posizione {
  const [id, dettaglio] = location.hash.replace(/^#\/?/, '').split('/');
  const sezione = SEZIONI.some((s) => s.id === id) ? (id as IdSezione) : 'allenati';
  return { sezione, dettaglio: dettaglio ? decodeURIComponent(dettaglio) : null };
}

export function vai(sezione: IdSezione, dettaglio?: string) {
  location.hash = `/${sezione}` + (dettaglio ? `/${encodeURIComponent(dettaglio)}` : '');
  window.scrollTo(0, 0);
}

export function usePosizione(): Posizione {
  const [posizione, setPosizione] = useState(posizioneDaIndirizzo);

  useEffect(() => {
    const aggiorna = () => setPosizione(posizioneDaIndirizzo());
    window.addEventListener('hashchange', aggiorna);
    return () => window.removeEventListener('hashchange', aggiorna);
  }, []);

  return posizione;
}

