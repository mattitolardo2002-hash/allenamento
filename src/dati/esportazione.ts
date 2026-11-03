import { db, scriviImpostazione } from './db';
import type { Cardio, Esercizio, Pesata, Scheda, Sessione } from './tipi';
import { dataLocale } from '../logica/formato';

/**
 * Contenuto del file JSON di backup. Lo stesso formato si usa per
 * ripristinare i dati (Importa backup) e per passarli a Notion.
 */
export interface Backup {
  app: 'allenamento';
  versione: 1;
  esportatoIl: string;
  /** "tutto" oppure "nuovi" (solo allenamenti e pesate non ancora esportati). */
  contenuto: 'tutto' | 'nuovi';
  esercizi: Esercizio[];
  schede: Scheda[];
  sessioni: Sessione[];
  pesate: Pesata[];
  /** Cyclette e corsa (assente nei backup più vecchi). */
  cardio?: Cardio[];
}

export interface Esportazione {
  file: File[];
  /** Cosa segnare come esportato, se l'utente conferma di aver salvato i file. */
  sessioniIds: string[];
  pesateDate: string[];
  cardioIds: string[];
}

/** Prepara i file: un JSON completo + tre CSV (serie, pesate, cardio). */
export async function preparaEsportazione(soloNuovi: boolean): Promise<Esportazione> {
  const [esercizi, schede, tutteSessioni, tuttePesate, tuttoCardio] = await Promise.all([
    db.esercizi.toArray(),
    db.schede.orderBy('ordine').toArray(),
    db.sessioni.orderBy('data').toArray(),
    db.pesate.orderBy('data').toArray(),
    db.cardio.orderBy('data').toArray(),
  ]);
  const sessioni = soloNuovi ? tutteSessioni.filter((s) => !s.esportato) : tutteSessioni;
  const pesate = soloNuovi ? tuttePesate.filter((p) => !p.esportato) : tuttePesate;
  const cardio = soloNuovi ? tuttoCardio.filter((c) => !c.esportato) : tuttoCardio;

  const backup: Backup = {
    app: 'allenamento',
    versione: 1,
    esportatoIl: new Date().toISOString(),
    contenuto: soloNuovi ? 'nuovi' : 'tutto',
    esercizi,
    schede,
    sessioni,
    pesate,
    cardio,
  };

  const oggi = dataLocale();
  const suffisso = soloNuovi ? '-nuovi' : '';
  const tipoEsercizio = new Map(esercizi.map((e) => [e.id, e.tipo]));

  return {
    file: [
      new File([JSON.stringify(backup, null, 2)], `allenamento-${oggi}${suffisso}.json`, { type: 'application/json' }),
      new File([csvSerie(sessioni, tipoEsercizio)], `allenamento-serie-${oggi}${suffisso}.csv`, { type: 'text/csv' }),
      new File([csvPesate(pesate)], `allenamento-pesate-${oggi}${suffisso}.csv`, { type: 'text/csv' }),
      new File([csvCardio(cardio)], `allenamento-cardio-${oggi}${suffisso}.csv`, { type: 'text/csv' }),
    ],
    sessioniIds: sessioni.map((s) => s.id),
    pesateDate: pesate.map((p) => p.data),
    cardioIds: cardio.map((c) => c.id),
  };
}

// CSV pensati per essere letti da programmi (Notion, fogli di calcolo, assistenti):
// separatore virgola e decimali col punto, come da standard.
function cella(v: string | number | boolean | null): string {
  if (v === null) return '';
  const testo = String(v);
  return /[",\n\r]/.test(testo) ? `"${testo.replace(/"/g, '""')}"` : testo;
}
const riga = (valori: (string | number | boolean | null)[]) => valori.map(cella).join(',');

/** Una riga per serie, con i dati dell'allenamento ripetuti su ogni riga. */
function csvSerie(sessioni: Sessione[], tipo: Map<string, string>): string {
  const righe = [
    riga([
      'sessione_id', 'data', 'scheda', 'esercizio', 'tipo_esercizio', 'serie_n', 'kg', 'rip',
      'riscaldamento', 'durata_min', 'rpe', 'note',
    ]),
  ];
  for (const s of sessioni) {
    for (const e of s.esercizi) {
      e.serie.forEach((x, i) => {
        righe.push(
          riga([
            s.id, s.data, s.schedaNome, e.nome, tipo.get(e.esercizioId) ?? '', i + 1, x.kg, x.rip,
            x.riscaldamento, s.durataMin, s.rpe, s.note,
          ]),
        );
      });
    }
  }
  return righe.join('\n') + '\n';
}

function csvPesate(pesate: Pesata[]): string {
  return [riga(['data', 'kg']), ...pesate.map((p) => riga([p.data, p.kg]))].join('\n') + '\n';
}

/** Una riga per attività cardio. Durata in minuti, passo in min:sec per km. */
function csvCardio(cardio: Cardio[]): string {
  const righe = [riga(['id', 'data', 'tipo', 'durata_min', 'km', 'passo_min_km', 'bpm_medio', 'bpm_min', 'bpm_max', 'note'])];
  for (const c of cardio) {
    const passo = c.passoSecKm ? `${Math.floor(c.passoSecKm / 60)}:${String(c.passoSecKm % 60).padStart(2, '0')}` : null;
    righe.push(
      riga([c.id, c.data, c.tipo, Math.round((c.durataSec / 60) * 10) / 10, c.km, passo, c.bpmMedio, c.bpmMin, c.bpmMax, c.note]),
    );
  }
  return righe.join('\n') + '\n';
}

/**
 * Consegna i file. Su iPhone apre il foglio di condivisione (Salva su File,
 * AirDrop, Mail…); dove non è possibile, li scarica uno per uno.
 * Restituisce false se l'utente ha chiuso il foglio senza fare nulla.
 */
export async function consegnaFile(file: File[]): Promise<boolean> {
  if (navigator.canShare?.({ files: file })) {
    try {
      await navigator.share({ files: file, title: 'Dati allenamento' });
      return true;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false;
      // Altri errori: si prova con il download normale.
    }
  }
  for (const f of file) {
    const url = URL.createObjectURL(f);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  return true;
}

/** Segna come esportati gli elementi inclusi nel file e ricorda la data del backup. */
export async function segnaEsportati(e: Esportazione): Promise<void> {
  await db.transaction('rw', [db.sessioni, db.pesate, db.cardio, db.impostazioni], async () => {
    await db.sessioni.where('id').anyOf(e.sessioniIds).modify({ esportato: true });
    await db.pesate.where('data').anyOf(e.pesateDate).modify({ esportato: true });
    await db.cardio.where('id').anyOf(e.cardioIds).modify({ esportato: true });
    await scriviImpostazione('ultimoBackup', new Date().toISOString());
  });
}
