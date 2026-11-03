import { db } from './db';
import type { Backup } from './esportazione';

/**
 * Legge e controlla un file di backup. Se qualcosa non torna lancia un
 * errore con un messaggio comprensibile: in quel caso non si tocca nulla.
 */
export async function leggiBackup(file: File): Promise<Backup> {
  let dati: unknown;
  try {
    dati = JSON.parse(await file.text());
  } catch {
    throw new Error('Il file non è un JSON valido.');
  }
  const b = dati as Partial<Backup>;
  if (b?.app !== 'allenamento') throw new Error('Questo file non è un backup di questa app.');
  if (b.versione !== 1) throw new Error('Versione del backup non supportata.');
  for (const campo of ['esercizi', 'schede', 'sessioni', 'pesate'] as const) {
    if (!Array.isArray(b[campo])) throw new Error(`Nel file manca l’elenco “${campo}”.`);
  }

  // Controlli essenziali su ogni elemento, per non salvare dati rotti.
  const backup = b as Backup;
  const data = /^\d{4}-\d{2}-\d{2}$/;
  if (!backup.esercizi.every((e) => typeof e.id === 'string' && typeof e.nome === 'string')) {
    throw new Error('Alcuni esercizi nel file non sono validi.');
  }
  if (!backup.schede.every((s) => typeof s.id === 'string' && Array.isArray(s.voci))) {
    throw new Error('Alcune schede nel file non sono valide.');
  }
  if (
    !backup.sessioni.every(
      (s) =>
        typeof s.id === 'string' &&
        data.test(s.data) &&
        Array.isArray(s.esercizi) &&
        s.esercizi.every((e) => Array.isArray(e.serie) && e.serie.every((x) => typeof x.kg === 'number' && typeof x.rip === 'number')),
    )
  ) {
    throw new Error('Alcuni allenamenti nel file non sono validi.');
  }
  if (!backup.pesate.every((p) => data.test(p.data) && typeof p.kg === 'number')) {
    throw new Error('Alcune pesate nel file non sono valide.');
  }
  // Il cardio è facoltativo: i backup più vecchi non lo hanno.
  backup.cardio ??= [];
  if (
    !Array.isArray(backup.cardio) ||
    !backup.cardio.every(
      (c) => typeof c.id === 'string' && data.test(c.data) && (c.tipo === 'cyclette' || c.tipo === 'corsa') && typeof c.durataSec === 'number',
    )
  ) {
    throw new Error('Alcune attività cardio nel file non sono valide.');
  }
  return backup;
}

/**
 * Importa un backup.
 * - "unisci": aggiunge ciò che manca e aggiorna gli elementi con lo stesso id
 *   (o la stessa data, per le pesate). Non cancella nulla.
 * - "sostituisci": cancella tutto (tranne l'allenamento in corso) e carica il file.
 * Tutto avviene in un'unica transazione: se qualcosa va storto non cambia niente.
 */
export async function importaBackup(backup: Backup, modo: 'unisci' | 'sostituisci'): Promise<void> {
  await db.transaction('rw', [db.esercizi, db.schede, db.sessioni, db.pesate, db.cardio], async () => {
    if (modo === 'sostituisci') {
      await Promise.all([db.esercizi.clear(), db.schede.clear(), db.sessioni.clear(), db.pesate.clear(), db.cardio.clear()]);
    }
    await db.esercizi.bulkPut(backup.esercizi);
    await db.schede.bulkPut(backup.schede);
    await db.sessioni.bulkPut(backup.sessioni);
    await db.pesate.bulkPut(backup.pesate);
    await db.cardio.bulkPut(backup.cardio ?? []);
  });
}
