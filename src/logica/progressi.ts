import type { SerieSvolta, Sessione } from '../dati/tipi';
import { volume } from './storico';

/**
 * 1RM stimato con la formula di Epley: kg × (1 + rip/30).
 * Con 1 ripetizione il massimale è il carico stesso.
 * È una stima: più affidabile sotto le 10 ripetizioni.
 */
export function epley(kg: number, rip: number): number {
  return rip === 1 ? kg : kg * (1 + rip / 30);
}

export interface Seduta {
  sessioneId: string;
  data: string;
  /** Solo le serie di lavoro (il riscaldamento è escluso). */
  serie: SerieSvolta[];
  volume: number;
  /** Serie con il 1RM stimato più alto, tra quelle con kg > 0. */
  migliore1RM: { kg: number; rip: number; stima: number } | null;
  /** Ripetizioni massime tra le serie senza peso/zavorra. */
  maxRipSenzaPeso: number | null;
}

/** Tutte le sedute in cui compare un esercizio, dalla più vecchia. */
export function seduteEsercizio(sessioni: Sessione[], esercizioId: string): Seduta[] {
  const sedute: Seduta[] = [];
  for (const s of sessioni) {
    const serie = s.esercizi
      .filter((e) => e.esercizioId === esercizioId)
      .flatMap((e) => e.serie)
      .filter((x) => !x.riscaldamento);
    if (!serie.length) continue;

    let migliore1RM: Seduta['migliore1RM'] = null;
    for (const x of serie) {
      if (x.kg <= 0) continue;
      const stima = epley(x.kg, x.rip);
      if (!migliore1RM || stima > migliore1RM.stima) migliore1RM = { kg: x.kg, rip: x.rip, stima };
    }
    const senzaPeso = serie.filter((x) => x.kg === 0).map((x) => x.rip);

    sedute.push({
      sessioneId: s.id,
      data: s.data,
      serie,
      volume: volume(serie),
      migliore1RM,
      maxRipSenzaPeso: senzaPeso.length ? Math.max(...senzaPeso) : null,
    });
  }
  return sedute.sort((a, b) => a.data.localeCompare(b.data));
}

/** Esercizi presenti nello storico, dal più recente, con numero di sedute. */
export function eserciziConStorico(sessioni: Sessione[]) {
  const mappa = new Map<string, { esercizioId: string; nome: string; sedute: number; ultima: string }>();
  for (const s of sessioni) {
    for (const e of s.esercizi) {
      if (!e.serie.some((x) => !x.riscaldamento)) continue;
      const voce = mappa.get(e.esercizioId);
      if (!voce) mappa.set(e.esercizioId, { esercizioId: e.esercizioId, nome: e.nome, sedute: 1, ultima: s.data });
      else {
        voce.sedute++;
        if (s.data > voce.ultima) voce.ultima = s.data;
      }
    }
  }
  return [...mappa.values()].sort((a, b) => b.ultima.localeCompare(a.ultima));
}
