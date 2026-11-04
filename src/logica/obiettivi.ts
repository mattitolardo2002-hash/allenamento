import { useLiveQuery } from 'dexie-react-hooks';
import { db, leggiImpostazione } from '../dati/db';

/** Obiettivi di una settimana: quanti allenamenti con i pesi e quante sedute di cardio. */
export interface Obiettivi {
  pesi: number;
  cardio: number;
}

export const PREDEFINITI: Obiettivi = { pesi: 3, cardio: 2 };

// Gli obiettivi di una settimana particolare (es. una settimana di pausa)
// stanno nelle impostazioni con la chiave "obiettivi:<lunedì>".
const PREFISSO = 'obiettivi:';

/**
 * Obiettivi in vigore: quelli predefiniti (da "Altro") e le eccezioni
 * impostate per singole settimane. `di(lunedi)` dice quali valgono
 * per una certa settimana.
 */
export function useObiettivi() {
  const dati = useLiveQuery(async () => {
    const pesi = Number(await leggiImpostazione('obiettivoSettimanale')) || PREDEFINITI.pesi;
    const cardio = Number(await leggiImpostazione('obiettivoCardio')) || PREDEFINITI.cardio;
    const eccezioni = new Map<string, Obiettivi>();
    const righe = await db.impostazioni.where('chiave').startsWith(PREFISSO).toArray();
    for (const r of righe) {
      try {
        eccezioni.set(r.chiave.slice(PREFISSO.length), JSON.parse(r.valore));
      } catch {
        // Riga rovinata: si ignora e valgono i predefiniti.
      }
    }
    return { predefiniti: { pesi, cardio }, eccezioni };
  }, []);

  if (!dati) return undefined;
  return {
    ...dati,
    di: (lunedi: string): Obiettivi => dati.eccezioni.get(lunedi) ?? dati.predefiniti,
  };
}

/** Imposta gli obiettivi di una sola settimana (null = torna ai predefiniti). */
export async function impostaSettimana(lunedi: string, obiettivi: Obiettivi | null): Promise<void> {
  if (obiettivi === null) await db.impostazioni.delete(PREFISSO + lunedi);
  else await db.impostazioni.put({ chiave: PREFISSO + lunedi, valore: JSON.stringify(obiettivi) });
}
