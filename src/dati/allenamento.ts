import { db, nuovoId } from './db';
import type { Bozza, EsercizioSvolto, Scheda, SerieBozza, Sessione } from './tipi';
import { dataLocale, leggiNumero } from '../logica/formato';
import { volume } from '../logica/storico';

export const serieVuota = (riscaldamento = false): SerieBozza => ({
  kg: '',
  rip: '',
  fatta: false,
  riscaldamento,
});

/** Crea l'allenamento in corso a partire da una scheda (o vuoto, se libero). */
export async function iniziaAllenamento(scheda: Scheda | null): Promise<void> {
  const bozza: Bozza = {
    id: 'corrente',
    schedaId: scheda?.id ?? null,
    schedaNome: scheda?.nome ?? 'Allenamento libero',
    inizio: new Date().toISOString(),
    riscaldamentoFatto: false,
    esercizi: (scheda?.voci ?? []).map((v) => ({
      esercizioId: v.esercizioId,
      alternativaId: v.alternativaId,
      obiettivo: { serie: v.serie, rip: v.rip, nota: v.nota },
      serie: Array.from({ length: v.serie }, () => serieVuota()),
    })),
  };
  await db.bozza.put(bozza);
}

/** Le serie confermate della bozza, già convertite in numeri. */
export function eserciziSvolti(bozza: Bozza, nomi: Map<string, string>): EsercizioSvolto[] {
  return bozza.esercizi
    .map((e) => ({
      esercizioId: e.esercizioId,
      nome: nomi.get(e.esercizioId) ?? '?',
      serie: e.serie
        .filter((s) => s.fatta)
        .map((s) => ({ kg: leggiNumero(s.kg) ?? 0, rip: leggiNumero(s.rip) ?? 0, riscaldamento: s.riscaldamento })),
    }))
    .filter((e) => e.serie.length > 0);
}

/** Salva l'allenamento nello storico ed elimina la bozza, in un'unica operazione. */
export async function concludiAllenamento(
  bozza: Bozza,
  nomi: Map<string, string>,
  rpe: number | null,
  note: string,
): Promise<void> {
  const fine = new Date();
  const esercizi = eserciziSvolti(bozza, nomi);
  const sessione: Sessione = {
    id: nuovoId(),
    data: dataLocale(new Date(bozza.inizio)),
    schedaId: bozza.schedaId,
    schedaNome: bozza.schedaNome,
    inizio: bozza.inizio,
    fine: fine.toISOString(),
    durataMin: Math.round((fine.getTime() - new Date(bozza.inizio).getTime()) / 60000),
    riscaldamentoFatto: bozza.riscaldamentoFatto,
    esercizi,
    volumeKg: Math.round(esercizi.reduce((tot, e) => tot + volume(e.serie), 0)),
    rpe,
    note: note.trim(),
    esportato: false,
  };
  // Transazione: o si salvano entrambe le cose o nessuna, mai dati a metà.
  await db.transaction('rw', db.sessioni, db.bozza, async () => {
    await db.sessioni.add(sessione);
    await db.bozza.delete('corrente');
  });
}

export async function annullaAllenamento(): Promise<void> {
  await db.bozza.delete('corrente');
}
