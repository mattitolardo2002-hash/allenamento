// Forma dei dati salvati nel dispositivo.

/**
 * Come si misura un esercizio:
 * - carico:   si segna il peso sollevato (macchinari, bilanciere, manubri);
 * - corpo:    solo ripetizioni, senza peso (es. leg raise);
 * - zavorra:  corpo libero con zavorra facoltativa (trazioni, dip).
 *             I kg segnati sono la sola zavorra; 0 = senza zavorra.
 */
export type TipoEsercizio = 'carico' | 'corpo' | 'zavorra';

/** Anagrafica unica degli esercizi: le schede e gli allenamenti la richiamano tramite id. */
export interface Esercizio {
  id: string;
  nome: string;
  tipo: TipoEsercizio;
  /** Vero per manubri e monogamba: kg di un manubrio e ripetizioni per lato. */
  perLato: boolean;
}

/** Una riga della scheda: quale esercizio e cosa prevede il programma. */
export interface VoceScheda {
  esercizioId: string;
  /** Esercizio che si può fare al suo posto (es. military press ↔ spinte con manubri). */
  alternativaId?: string;
  serie: number;
  /** Testo libero, es. "6", "5-6", "6-8". */
  rip: string;
  /** Promemoria facoltativo, es. "15 kg" o "max 3 serie". */
  nota?: string;
}

export interface Scheda {
  id: string;
  nome: string;
  /** Posizione nell'elenco: l'app propone le schede in quest'ordine, a rotazione. */
  ordine: number;
  voci: VoceScheda[];
}

/** Una serie registrata durante l'allenamento. */
export interface SerieSvolta {
  /** Carico, oppure zavorra per gli esercizi a corpo libero (0 = nessuna). */
  kg: number;
  rip: number;
  /** Serie di riscaldamento: esclusa da volume e record. */
  riscaldamento: boolean;
}

export interface EsercizioSvolto {
  esercizioId: string;
  /** Copia del nome al momento dell'allenamento, utile per l'esportazione. */
  nome: string;
  serie: SerieSvolta[];
}

export interface Sessione {
  id: string;
  /** Giorno dell'allenamento, formato AAAA-MM-GG. */
  data: string;
  schedaId: string | null;
  schedaNome: string;
  inizio: string;
  fine: string;
  durataMin: number;
  riscaldamentoFatto: boolean;
  esercizi: EsercizioSvolto[];
  volumeKg: number;
  rpe: number | null;
  note: string;
  esportato: boolean;
}

/**
 * Allenamento in corso. Viene salvato a ogni tocco, così se l'app si chiude
 * a metà lo si ritrova identico. I valori dei campi restano testo (es. "82,")
 * finché la serie non viene confermata.
 */
export interface Bozza {
  /** Ne esiste al massimo una: l'id è sempre "corrente". */
  id: 'corrente';
  schedaId: string | null;
  schedaNome: string;
  inizio: string;
  riscaldamentoFatto: boolean;
  esercizi: EsercizioBozza[];
}

export interface EsercizioBozza {
  esercizioId: string;
  alternativaId?: string;
  /** Cosa prevede la scheda (assente per gli esercizi aggiunti al momento). */
  obiettivo?: { serie: number; rip: string; nota?: string };
  serie: SerieBozza[];
}

export interface SerieBozza {
  kg: string;
  rip: string;
  fatta: boolean;
  riscaldamento: boolean;
}

/** Attività cardio registrata a mano (non segue le schede). */
export type TipoCardio = 'cyclette' | 'corsa';

export interface Cardio {
  id: string;
  /** Giorno dell'attività, formato AAAA-MM-GG. */
  data: string;
  tipo: TipoCardio;
  /** Durata in secondi: per la corsa è calcolata da km × passo. */
  durataSec: number;
  /** Solo corsa. */
  km: number | null;
  /** Solo corsa: secondi per km (es. 330 = 5:30/km). */
  passoSecKm: number | null;
  bpmMedio: number | null;
  /** Solo corsa: battito minimo e massimo. */
  bpmMin: number | null;
  bpmMax: number | null;
  note: string;
  esportato: boolean;
}

export interface Pesata {
  /** Giorno della pesata (AAAA-MM-GG): una sola pesata al giorno. */
  data: string;
  kg: number;
  esportato: boolean;
}
