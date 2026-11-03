import type { Sessione } from '../dati/tipi';
import { epley } from './progressi';

/** I migliori risultati di un esercizio fino a un certo momento. */
export interface Migliori {
  /** 1RM stimato più alto tra le serie con peso (0 = nessuna). */
  e1rm: number;
  /** Ripetizioni massime in una serie senza peso (0 = nessuna). */
  rip: number;
}

/**
 * Migliori risultati per esercizio nelle sessioni date
 * (il riscaldamento non conta).
 */
export function miglioriPerEsercizio(sessioni: Sessione[]): Map<string, Migliori> {
  const mappa = new Map<string, Migliori>();
  for (const s of sessioni) {
    for (const e of s.esercizi) {
      const m = mappa.get(e.esercizioId) ?? { e1rm: 0, rip: 0 };
      for (const x of e.serie) {
        if (x.riscaldamento) continue;
        if (x.kg > 0) m.e1rm = Math.max(m.e1rm, epley(x.kg, x.rip));
        else m.rip = Math.max(m.rip, x.rip);
      }
      mappa.set(e.esercizioId, m);
    }
  }
  return mappa;
}

/**
 * Una serie è un record se supera il meglio precedente dello stesso esercizio:
 * 1RM stimato per le serie con peso, ripetizioni per quelle senza.
 * La prima volta in assoluto non conta come record (non c'è nulla da battere).
 */
export function eRecord(serie: { kg: number; rip: number }, migliori?: Migliori): boolean {
  if (!migliori) return false;
  if (serie.kg > 0) return migliori.e1rm > 0 && epley(serie.kg, serie.rip) > migliori.e1rm + 1e-9;
  return migliori.rip > 0 && serie.rip > migliori.rip;
}

/** Quanti esercizi hanno segnato un record in una sessione (rispetto a quelle precedenti). */
export function recordDellaSessione(sessione: Sessione, tutte: Sessione[]): number {
  const precedenti = miglioriPerEsercizio(tutte.filter((s) => s.fine < sessione.fine));
  return sessione.esercizi.filter((e) =>
    e.serie.some((x) => !x.riscaldamento && eRecord(x, precedenti.get(e.esercizioId))),
  ).length;
}
