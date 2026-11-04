import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../dati/db';
import type { Cardio, Sessione } from '../dati/tipi';
import { dataLocale, dataLunga } from '../logica/formato';
import { vai } from '../navigazione';
import { Conferma } from '../componenti/Finestra';
import { FinestraCardio, NOMI_CARDIO, riassuntoCardio } from '../componenti/ModuloCardio';
import { PREFISSO_SESSIONE } from './Allenati';

// Mese e giorno visti l'ultima volta: tornando dal dettaglio di un
// allenamento si ritrova il calendario dove lo si era lasciato.
let ricordo: { mese: string; giorno: string | null } | null = null;

/** Da dove si è aperto il dettaglio di un allenamento (per il tasto Indietro). */
export let apertoDalCalendario = false;
export function segnaRitorno(daCalendario: boolean) {
  apertoDalCalendario = daCalendario;
}

const GIORNI = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

/** Una voce del giorno: allenamento con i pesi oppure cardio. */
type Attivita = { tipo: 'pesi'; s: Sessione } | { tipo: 'cardio'; c: Cardio };

/** "2026-11" → primo giorno, numero di giorni e posizione del 1° nella settimana. */
function infoMese(mese: string) {
  const [a, m] = mese.split('-').map(Number);
  const giorni = new Date(a, m, 0).getDate();
  const inizio = (new Date(a, m - 1, 1).getDay() + 6) % 7; // 0 = lunedì
  return { a, m, giorni, inizio };
}

function spostaMese(mese: string, verso: number): string {
  const { a, m } = infoMese(mese);
  const d = new Date(a, m - 1 + verso, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Calendario degli allenamenti: un mese alla volta, con un pallino per i pesi
 * e uno per il cardio. Toccando un giorno si vedono le attività di quel giorno
 * e si possono aprire o eliminare.
 */
export function Calendario() {
  const sessioni = useLiveQuery(() => db.sessioni.toArray(), []);
  const cardio = useLiveQuery(() => db.cardio.toArray(), []);
  const oggi = dataLocale();
  const [mese, setMese] = useState(ricordo?.mese ?? oggi.slice(0, 7));
  const [giorno, setGiorno] = useState<string | null>(ricordo?.giorno ?? null);
  const [daEliminare, setDaEliminare] = useState<Attivita | null>(null);
  const [cardioAperto, setCardioAperto] = useState<Cardio | null>(null);

  if (!sessioni || !cardio) return null;
  ricordo = { mese, giorno };

  const { a, m, giorni, inizio } = infoMese(mese);
  const dataDi = (g: number) => `${mese}-${String(g).padStart(2, '0')}`;

  // Attività del mese, raggruppate per giorno.
  const perGiorno = new Map<string, Attivita[]>();
  const aggiungi = (data: string, x: Attivita) => {
    if (!data.startsWith(mese)) return;
    perGiorno.set(data, [...(perGiorno.get(data) ?? []), x]);
  };
  sessioni.forEach((s) => aggiungi(s.data, { tipo: 'pesi', s }));
  cardio.forEach((c) => aggiungi(c.data, { tipo: 'cardio', c }));

  const nPesi = sessioni.filter((s) => s.data.startsWith(mese)).length;
  const nCardio = cardio.filter((c) => c.data.startsWith(mese)).length;

  // Elenco sotto il calendario: il giorno scelto oppure tutto il mese.
  const giorniElenco = giorno ? [giorno] : [...perGiorno.keys()].sort().reverse();
  const nomeMese = new Date(a, m - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  const apriSessione = (s: Sessione) => {
    segnaRitorno(true);
    vai('allenati', PREFISSO_SESSIONE + s.id);
  };

  return (
    <>
      <button type="button" className="pulsante-indietro" onClick={() => vai('allenati')}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Allenati
      </button>
      <h1 className="titolo-pagina">Calendario</h1>

      <section className="riquadro calendario">
        <div className="naviga-periodo">
          <button
            type="button"
            className="pulsante-icona"
            aria-label="Mese precedente"
            onClick={() => {
              setMese(spostaMese(mese, -1));
              setGiorno(null);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <span>
            <strong className="mese-nome">{nomeMese}</strong>
            <small className="testo-tenue">
              {nPesi} pesi · {nCardio} cardio
            </small>
          </span>
          <button
            type="button"
            className="pulsante-icona"
            aria-label="Mese successivo"
            disabled={mese >= oggi.slice(0, 7)}
            onClick={() => {
              setMese(spostaMese(mese, 1));
              setGiorno(null);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>

        <div className="griglia-mese" role="grid" aria-label={`Allenamenti di ${nomeMese}`}>
          {GIORNI.map((g, i) => (
            <span key={i} className="intestazione-giorno">
              {g}
            </span>
          ))}
          {Array.from({ length: inizio }, (_, i) => (
            <span key={`vuoto-${i}`} />
          ))}
          {Array.from({ length: giorni }, (_, i) => {
            const data = dataDi(i + 1);
            const attivita = perGiorno.get(data) ?? [];
            const pesi = attivita.some((x) => x.tipo === 'pesi');
            const card = attivita.some((x) => x.tipo === 'cardio');
            const classi = [
              'giorno',
              data === oggi && 'oggi',
              data === giorno && 'scelto',
              attivita.length > 0 && 'attivo',
              data > oggi && 'futuro',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={data}
                type="button"
                className={classi}
                disabled={data > oggi}
                aria-pressed={data === giorno}
                aria-label={`${dataLunga(data)}: ${attivita.length ? `${attivita.length} attività` : 'nessuna attività'}`}
                onClick={() => setGiorno(data === giorno ? null : data)}
              >
                <span>{i + 1}</span>
                <span className="pallini">
                  {pesi && <i className="pallino-pesi" />}
                  {card && <i className="pallino-cardio" />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="legenda calendario-legenda">
          <span>
            <i className="pallino-pesi" /> Pesi
          </span>
          <span>
            <i className="pallino-cardio" /> Cardio
          </span>
        </div>
      </section>

      <div className="titolo-con-azione">
        <h2 className="titolo-sezione">{giorno ? dataLunga(giorno).replace(/ \d{4}$/, '') : `Tutto ${nomeMese}`}</h2>
        {giorno && (
          <button type="button" className="pulsante-testo" onClick={() => setGiorno(null)}>
            Tutto il mese
          </button>
        )}
      </div>

      {giorniElenco.every((d) => !perGiorno.get(d)?.length) ? (
        <section className="riquadro vuoto">
          <p>{giorno ? 'Nessun allenamento in questo giorno.' : 'Nessun allenamento in questo mese.'}</p>
        </section>
      ) : (
        <ul className="riquadro elenco-giorno">
          {giorniElenco.flatMap((d) =>
            (perGiorno.get(d) ?? []).map((x) => {
              const chiave = x.tipo === 'pesi' ? x.s.id : x.c.id;
              return (
                <li key={chiave}>
                  <button
                    type="button"
                    className="voce-giorno"
                    onClick={() => (x.tipo === 'pesi' ? apriSessione(x.s) : setCardioAperto(x.c))}
                  >
                    <i className={x.tipo === 'pesi' ? 'pallino-pesi' : 'pallino-cardio'} />
                    <span>
                      <span className="storico-nome">{x.tipo === 'pesi' ? x.s.schedaNome : NOMI_CARDIO[x.c.tipo]}</span>
                      <span className="testo-tenue piccolo">
                        {!giorno && `${Number(d.slice(8))} · `}
                        {x.tipo === 'pesi'
                          ? `${x.s.durataMin} min · ${x.s.esercizi.reduce((t, e) => t + e.serie.filter((y) => !y.riscaldamento).length, 0)} serie`
                          : riassuntoCardio(x.c)}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="pulsante-icona"
                    aria-label="Elimina"
                    onClick={() => setDaEliminare(x)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 7h14M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3" />
                    </svg>
                  </button>
                </li>
              );
            }),
          )}
        </ul>
      )}

      <Conferma
        aperta={daEliminare !== null}
        titolo="Eliminare l’allenamento?"
        testo={
          daEliminare
            ? `${daEliminare.tipo === 'pesi' ? daEliminare.s.schedaNome : NOMI_CARDIO[daEliminare.c.tipo]} del ${dataLunga(
                daEliminare.tipo === 'pesi' ? daEliminare.s.data : daEliminare.c.data,
              )} verrà eliminato definitivamente.`
            : ''
        }
        etichetta="Elimina"
        onAnnulla={() => setDaEliminare(null)}
        onConferma={async () => {
          if (daEliminare?.tipo === 'pesi') await db.sessioni.delete(daEliminare.s.id);
          if (daEliminare?.tipo === 'cardio') await db.cardio.delete(daEliminare.c.id);
          setDaEliminare(null);
        }}
      />
      <FinestraCardio attivita={cardioAperto} onChiudi={() => setCardioAperto(null)} />
    </>
  );
}
