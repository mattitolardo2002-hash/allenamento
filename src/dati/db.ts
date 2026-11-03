import Dexie, { type EntityTable } from 'dexie';
import type { Bozza, Cardio, Esercizio, Pesata, Scheda, Sessione } from './tipi';
import { ESERCIZI_INIZIALI, SCHEDE_INIZIALI } from './datiIniziali';

// Database locale (IndexedDB) gestito con Dexie.
// Le stringhe in `stores` elencano solo i campi su cui si fanno ricerche:
// gli altri campi vengono salvati comunque.
export const db = new Dexie('allenamento') as Dexie & {
  esercizi: EntityTable<Esercizio, 'id'>;
  schede: EntityTable<Scheda, 'id'>;
  sessioni: EntityTable<Sessione, 'id'>;
  pesate: EntityTable<Pesata, 'data'>;
  bozza: EntityTable<Bozza, 'id'>;
  impostazioni: EntityTable<{ chiave: string; valore: string }, 'chiave'>;
  cardio: EntityTable<Cardio, 'id'>;
};

// Versione 1 della struttura. Se in futuro cambia, si aggiunge una
// `db.version(2)` con le istruzioni per convertire i dati esistenti:
// così gli aggiornamenti dell'app non cancellano niente.
db.version(1).stores({
  esercizi: 'id, nome',
  schede: 'id, ordine',
  sessioni: 'id, data, schedaId',
  pesate: 'data',
});

// Versione 2: aggiunge l'allenamento in corso. Le tabelle esistenti restano intatte.
db.version(2).stores({
  bozza: 'id',
});

// Versione 3: piccole informazioni dell'app (es. data dell'ultimo backup).
db.version(3).stores({
  impostazioni: 'chiave',
});

// Versione 4: attività cardio (cyclette e corsa).
db.version(4).stores({
  cardio: 'id, data',
});

/** Legge un'impostazione salvata (undefined se non c'è). */
export async function leggiImpostazione(chiave: string): Promise<string | undefined> {
  return (await db.impostazioni.get(chiave))?.valore;
}

export async function scriviImpostazione(chiave: string, valore: string): Promise<void> {
  await db.impostazioni.put({ chiave, valore });
}

// Al primissimo avvio carica le tue schede attuali.
db.on('populate', async (tx) => {
  await tx.table('esercizi').bulkAdd(ESERCIZI_INIZIALI);
  await tx.table('schede').bulkAdd(SCHEDE_INIZIALI);
});

/** Crea un identificativo univoco (funziona anche senza HTTPS, a differenza di crypto.randomUUID). */
export function nuovoId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
