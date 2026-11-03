import { useEffect, useState } from 'react';

// Le sezioni principali, nell'ordine della barra in basso.
export const SEZIONI = [
  { id: 'allenati', etichetta: 'Allenati' },
  { id: 'peso', etichetta: 'Peso' },
  { id: 'progressi', etichetta: 'Progressi' },
  { id: 'schede', etichetta: 'Schede' },
  { id: 'altro', etichetta: 'Altro' },
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
