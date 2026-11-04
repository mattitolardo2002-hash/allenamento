import type { Sessione } from '../dati/tipi';
import { dataLocale } from './formato';

/** Lunedì della settimana che contiene il giorno dato (AAAA-MM-GG). */
export function lunediDi(d: Date): string {
  const copia = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const giorno = (copia.getDay() + 6) % 7; // 0 = lunedì … 6 = domenica
  copia.setDate(copia.getDate() - giorno);
  return dataLocale(copia);
}

/** Sposta una data AAAA-MM-GG di un certo numero di giorni. */
function sposta(data: string, giorni: number): string {
  const [a, m, g] = data.split('-').map(Number);
  return dataLocale(new Date(a, m - 1, g + giorni));
}

export interface Riepilogo {
  allenamenti: number;
  /** Serie di lavoro (senza riscaldamento). */
  serie: number;
  minuti: number;
}

function riepiloga(sessioni: Sessione[], da: string, a: string): Riepilogo {
  const dentro = sessioni.filter((s) => s.data >= da && s.data < a);
  return {
    allenamenti: dentro.length,
    serie: dentro.reduce(
      (tot, s) => tot + s.esercizi.reduce((t, e) => t + e.serie.filter((x) => !x.riscaldamento).length, 0),
      0,
    ),
    minuti: dentro.reduce((tot, s) => tot + s.durataMin, 0),
  };
}

/** Questa settimana (da lunedì) e la settimana precedente intera. */
export function riepilogoSettimane(sessioni: Sessione[], oggi = new Date()) {
  const lunedi = lunediDi(oggi);
  return {
    attuale: riepiloga(sessioni, lunedi, sposta(lunedi, 7)),
    precedente: riepiloga(sessioni, sposta(lunedi, -7), lunedi),
  };
}

/**
 * Settimane di fila in cui hai raggiunto l'obiettivo dei pesi.
 * - La settimana in corso conta solo se l'obiettivo è già raggiunto
 *   (altrimenti non interrompe la serie: c'è ancora tempo).
 * - Una settimana con obiettivo 0 (pausa) non conta e non interrompe la serie.
 */
export function settimaneDiFila(
  sessioni: Sessione[],
  obiettivoDi: (lunedi: string) => number,
  oggi = new Date(),
): number {
  let lunedi = lunediDi(oggi);
  const conta = (da: string) => sessioni.filter((s) => s.data >= da && s.data < sposta(da, 7)).length;
  const obiettivoOra = obiettivoDi(lunedi);
  let serie = obiettivoOra > 0 && conta(lunedi) >= obiettivoOra ? 1 : 0;
  // Si torna indietro una settimana alla volta (al massimo 10 anni).
  for (let i = 0; i < 520; i++) {
    lunedi = sposta(lunedi, -7);
    const obiettivo = obiettivoDi(lunedi);
    if (obiettivo === 0) continue;
    if (conta(lunedi) < obiettivo) return serie;
    serie++;
  }
  return serie;
}

export { sposta as spostaData };
