import type { Esercizio, SerieSvolta, Sessione } from '../dati/tipi';
import { dataBreve, numero } from './formato';

export interface UltimaVolta {
  data: string;
  /** Serie di lavoro dell'ultima seduta (senza il riscaldamento). */
  serie: SerieSvolta[];
}

/**
 * Per ogni esercizio, le serie dell'ultima seduta in cui è stato fatto.
 * Le sessioni vanno passate tutte: le ordiniamo noi dalla più recente.
 */
export function ultimeVolte(sessioni: Sessione[]): Map<string, UltimaVolta> {
  const mappa = new Map<string, UltimaVolta>();
  const ordinate = [...sessioni].sort((a, b) => b.fine.localeCompare(a.fine));
  for (const s of ordinate) {
    for (const e of s.esercizi) {
      if (mappa.has(e.esercizioId)) continue;
      const serie = e.serie.filter((x) => !x.riscaldamento);
      if (serie.length) mappa.set(e.esercizioId, { data: s.data, serie });
    }
  }
  return mappa;
}

/** Una serie in breve: "60×10", "+10×6" (zavorra) oppure "10" (corpo libero). */
export function serieInBreve(s: { kg: number; rip: number }, tipo: Esercizio['tipo']): string {
  if (tipo === 'corpo' || (tipo === 'zavorra' && s.kg === 0)) return `${s.rip}`;
  return `${tipo === 'zavorra' ? '+' : ''}${numero(s.kg)}×${s.rip}`;
}

/** "Ultima volta · 28 ott: 60×10, 60×9, 60×8". */
export function testoUltimaVolta(u: UltimaVolta, tipo: Esercizio['tipo']): string {
  const serie = u.serie.map((s) => serieInBreve(s, tipo)).join(', ');
  const unita = tipo === 'corpo' || u.serie.every((s) => tipo === 'zavorra' && s.kg === 0) ? ' rip' : '';
  return `Ultima volta · ${dataBreve(u.data)}: ${serie}${unita}`;
}

/** Volume = somma di kg × ripetizioni delle serie di lavoro. */
export function volume(serie: SerieSvolta[]): number {
  return serie.reduce((tot, s) => (s.riscaldamento ? tot : tot + s.kg * s.rip), 0);
}
