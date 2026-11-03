import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, leggiImpostazione } from '../dati/db';
import type { Cardio, Scheda, Sessione, TipoCardio } from '../dati/tipi';
import { iniziaAllenamento } from '../dati/allenamento';
import { dataBreve, dataConGiorno, dataLocale, dataLunga, orario } from '../logica/formato';
import { lunediDi, riepilogoSettimane, settimaneDiFila } from '../logica/settimana';
import { recordDellaSessione } from '../logica/record';
import { vai } from '../navigazione';
import { FinestraCardio, NOMI_CARDIO, riassuntoCardio } from '../componenti/ModuloCardio';
import { AllenamentoInCorso } from './AllenamentoInCorso';
import { DettaglioSessione } from './DettaglioSessione';

// Prefisso dell'indirizzo per il dettaglio di un allenamento passato: #/allenati/s:<id>
export const PREFISSO_SESSIONE = 's:';

/** Obiettivo di allenamenti a settimana, se non è stato impostato in "Altro". */
export const OBIETTIVO_PREDEFINITO = 3;
/** Obiettivo di sedute cardio a settimana, se non impostato. */
export const OBIETTIVO_CARDIO_PREDEFINITO = 2;

// Sezione Allenati: scelta della scheda, settimana e storico.
// Dentro la stessa sezione si aprono l'allenamento in corso e il dettaglio di quelli passati.
export function Allenati({ dettaglio }: { dettaglio: string | null }) {
  if (dettaglio === 'in-corso') return <AllenamentoInCorso />;
  if (dettaglio?.startsWith(PREFISSO_SESSIONE)) {
    return <DettaglioSessione id={dettaglio.slice(PREFISSO_SESSIONE.length)} />;
  }
  return <Home />;
}

/** La scheda che segue l'ultima usata, nell'ordine dell'elenco (a rotazione). */
function prossimaScheda(schede: Scheda[], recenti: Sessione[]): Scheda | undefined {
  const ultima = recenti.find((s) => schede.some((x) => x.id === s.schedaId));
  if (!ultima) return schede[0];
  const i = schede.findIndex((x) => x.id === ultima.schedaId);
  return schede[(i + 1) % schede.length];
}

/** Serie di lavoro di una sessione (senza riscaldamento). */
const serieDi = (s: Sessione) =>
  s.esercizi.reduce((t, e) => t + e.serie.filter((x) => !x.riscaldamento).length, 0);

/** 75 → "1h 15", 40 → "40 min" (corto, per stare in una riga). */
function tempo(minuti: number): string {
  if (minuti < 60) return `${minuti} min`;
  const resto = minuti % 60;
  return `${Math.floor(minuti / 60)}h${resto ? ` ${String(resto).padStart(2, '0')}` : ''}`;
}

// Quanti allenamenti passati mostrare per volta.
const PAGINA = 10;
// Iniziali dei giorni per la striscia settimanale (da lunedì).
const GIORNI = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

function Home() {
  const schede = useLiveQuery(() => db.schede.orderBy('ordine').toArray(), []);
  const sessioni = useLiveQuery(() => db.sessioni.toArray(), []);
  const esercizi = useLiveQuery(() => db.esercizi.toArray(), []);
  const obiettivo = useLiveQuery(
    () => leggiImpostazione('obiettivoSettimanale').then((v) => Number(v) || OBIETTIVO_PREDEFINITO),
    [],
  );
  const obiettivoCardio = useLiveQuery(
    () => leggiImpostazione('obiettivoCardio').then((v) => Number(v) || OBIETTIVO_CARDIO_PREDEFINITO),
    [],
  );
  // `null` = nessun allenamento in corso (undefined = ancora in caricamento).
  const bozza = useLiveQuery(() => db.bozza.get('corrente').then((b) => b ?? null), []);
  const cardio = useLiveQuery(() => db.cardio.toArray(), []);
  const [mostrati, setMostrati] = useState(PAGINA);
  // Attività cardio aperta nella finestra (nuova o da modificare).
  const [finestraCardio, setFinestraCardio] = useState<Cardio | { tipo: TipoCardio } | null>(null);

  if (!schede || !sessioni || !esercizi || !obiettivo || !obiettivoCardio || !cardio || bozza === undefined) {
    return null;
  }

  // Dalla più recente alla più vecchia.
  const recenti = [...sessioni].sort((a, b) => b.fine.localeCompare(a.fine));
  const prossima = bozza ? undefined : prossimaScheda(schede, recenti);
  const altre = schede.filter((s) => s !== prossima);
  const { attuale } = riepilogoSettimane(sessioni);
  const diFila = settimaneDiFila(sessioni, obiettivo);
  const nomeEsercizio = (id: string) => esercizi.find((e) => e.id === id)?.nome ?? '?';

  // I 7 giorni della settimana corrente, con quelli in cui ti sei allenato.
  const oggi = dataLocale();
  const [a, m, g] = lunediDi(new Date()).split('-').map(Number);
  const giorni = GIORNI.map((iniziale, i) => {
    const data = dataLocale(new Date(a, m - 1, g + i));
    return {
      iniziale,
      data,
      fatto: sessioni.some((s) => s.data === data),
      cardio: cardio.some((c) => c.data === data),
      oggi: data === oggi,
    };
  });
  const lunedi = lunediDi(new Date());
  const cardioSettimana = cardio.filter((c) => c.data >= lunedi && c.data <= giorni[6].data);
  const minutiCardio = Math.round(cardioSettimana.reduce((t, c) => t + c.durataSec, 0) / 60);

  // Storico unico: allenamenti con i pesi e attività cardio, dal più recente.
  const storico = [
    ...recenti.map((s) => ({ chiave: s.fine, sessione: s, cardio: null })),
    ...cardio.map((c) => ({ chiave: `${c.data}T12:00:00`, sessione: null, cardio: c })),
  ].sort((x, y) => y.chiave.localeCompare(x.chiave));

  const inizia = async (scheda: Scheda | null) => {
    await iniziaAllenamento(scheda);
    vai('allenati', 'in-corso');
  };

  return (
    <>
      <span className="sopratitolo">{dataLunga(oggi).replace(/ \d{4}$/, '')}</span>
      <h1 className="titolo-pagina">Allenati</h1>

      {bozza && (
        <section className="riquadro in-corso">
          <div>
            <span className="etichetta-sopra accento">In corso</span>
            <span className="nome-display">{bozza.schedaNome}</span>
            <span className="testo-tenue piccolo">Iniziato alle {orario(bozza.inizio)}</span>
          </div>
          <button type="button" className="pulsante primario" onClick={() => vai('allenati', 'in-corso')}>
            Riprendi
          </button>
        </section>
      )}

      {prossima && (
        <section className="riquadro protagonista">
          <span className="etichetta-sopra accento">Prossimo allenamento</span>
          <h2 className="nome-display grande">{prossima.nome}</h2>
          <p className="testo-tenue piccolo">
            {prossima.voci.length === 1 ? '1 esercizio' : `${prossima.voci.length} esercizi`}
            {(() => {
              const ultima = recenti.find((s) => s.schedaId === prossima.id);
              return ultima ? ` · l’ultima volta ${dataBreve(ultima.data)}` : '';
            })()}
          </p>
          <ul className="gettoni">
            {prossima.voci.slice(0, 5).map((v, i) => (
              <li key={i}>{nomeEsercizio(v.esercizioId)}</li>
            ))}
            {prossima.voci.length > 5 && <li className="altri">+{prossima.voci.length - 5}</li>}
          </ul>
          <button type="button" className="pulsante primario largo grande" onClick={() => inizia(prossima)}>
            Inizia allenamento
          </button>
        </section>
      )}

      <section className="riquadro settimana" aria-label="Questa settimana">
        <span className="etichetta-sopra">Questa settimana</span>
        {/* Due obiettivi separati: pesi e cardio. */}
        <div className="settimana-testa">
          <Obiettivo nome="Pesi" valore={attuale.allenamenti} obiettivo={obiettivo} />
          <Obiettivo nome="Cardio" valore={cardioSettimana.length} obiettivo={obiettivoCardio} cardio />
        </div>
        <ol className="striscia-giorni">
          {giorni.map((d) => (
            <li
              key={d.data}
              className={`${d.fatto ? 'fatto' : d.cardio ? 'cardio' : ''}${d.oggi ? ' oggi' : ''}`}
              aria-label={`${dataConGiorno(d.data)}${d.fatto ? ': allenamento fatto' : d.cardio ? ': cardio' : ''}`}
            >
              <span>{d.iniziale}</span>
              <i />
            </li>
          ))}
        </ol>
        <dl className="settimana-cifre">
          <div>
            <dt>Serie</dt>
            <dd>{attuale.serie}</dd>
          </div>
          <div>
            <dt>Tempo</dt>
            <dd>{tempo(attuale.minuti + minutiCardio)}</dd>
          </div>
          <div>
            <dt>Di fila</dt>
            <dd>{diFila} sett.</dd>
          </div>
        </dl>
      </section>

      <h2 className="titolo-sezione">{prossima ? 'Altre schede' : 'Schede'}</h2>
      <ul className="riquadro elenco-avvio">
        {altre.map((s) => (
          <li key={s.id}>
            <div>
              <span className="storico-nome">{s.nome}</span>
              <span className="testo-tenue piccolo">
                {s.voci.length === 1 ? '1 esercizio' : `${s.voci.length} esercizi`}
              </span>
            </div>
            <button type="button" className="pulsante piccolo-pulsante" disabled={!!bozza} onClick={() => inizia(s)}>
              Inizia
            </button>
          </li>
        ))}
        <li>
          <div>
            <span className="storico-nome">Allenamento libero</span>
            <span className="testo-tenue piccolo">Senza scheda: aggiungi gli esercizi al momento</span>
          </div>
          <button type="button" className="pulsante piccolo-pulsante" disabled={!!bozza} onClick={() => inizia(null)}>
            Inizia
          </button>
        </li>
      </ul>
      {bozza && (
        <p className="testo-tenue piccolo centrato">Termina o annulla l’allenamento in corso per iniziarne un altro.</p>
      )}

      {/* Cardio: allenamenti a sé, indipendenti dalle schede dei pesi. */}
      <h2 className="titolo-sezione">Cardio</h2>
      <ul className="riquadro elenco-avvio">
        {(['cyclette', 'corsa'] as const).map((t) => {
          const ultima = [...cardio].filter((c) => c.tipo === t).sort((x, y) => y.data.localeCompare(x.data))[0];
          return (
            <li key={t}>
              <div>
                <span className="storico-nome">{NOMI_CARDIO[t]}</span>
                <span className="testo-tenue piccolo">
                  {ultima
                    ? `Ultima: ${dataBreve(ultima.data)} · ${riassuntoCardio(ultima)}`
                    : t === 'corsa'
                      ? 'Km, passo e battito'
                      : 'Tempo e battito medio'}
                </span>
              </div>
              <button type="button" className="pulsante piccolo-pulsante" onClick={() => setFinestraCardio({ tipo: t })}>
                Registra
              </button>
            </li>
          );
        })}
      </ul>

      <h2 className="titolo-sezione">Ultimi allenamenti</h2>
      {storico.length === 0 ? (
        <section className="riquadro vuoto">
          <p>Ancora nessun allenamento registrato.</p>
        </section>
      ) : (
        <ul className="elenco-sessioni">
          {storico.slice(0, mostrati).map(({ sessione: s, cardio: c }) => {
            const data = (s ?? c)!.data;
            const [, mese, giorno] = data.split('-').map(Number);
            const tessera = (
              <span className={`tessera-data${c ? ' cardio' : ''}`} aria-hidden="true">
                <b>{giorno}</b>
                <small>{new Date(2000, mese - 1, 1).toLocaleDateString('it-IT', { month: 'short' })}</small>
              </span>
            );
            if (c) {
              return (
                <li key={c.id}>
                  <button type="button" className="riquadro" onClick={() => setFinestraCardio(c)}>
                    {tessera}
                    <span className="sessione-testo">
                      <span className="storico-nome">{NOMI_CARDIO[c.tipo]}</span>
                      <span className="testo-tenue piccolo">
                        {dataConGiorno(c.data).split(' ')[0]} · {riassuntoCardio(c)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            }
            const record = recordDellaSessione(s!, sessioni);
            return (
              <li key={s!.id}>
                <button type="button" className="riquadro" onClick={() => vai('allenati', PREFISSO_SESSIONE + s!.id)}>
                  {tessera}
                  <span className="sessione-testo">
                    <span className="storico-nome">{s!.schedaNome}</span>
                    <span className="testo-tenue piccolo">
                      {dataConGiorno(s!.data).split(' ')[0]} · {s!.durataMin} min · {serieDi(s!)} serie
                    </span>
                  </span>
                  {record > 0 && (
                    <span className="distintivo-record">
                      ★ {record === 1 ? '1 record' : `${record} record`}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {storico.length > mostrati && (
        <button type="button" className="pulsante largo" onClick={() => setMostrati(mostrati + PAGINA)}>
          Mostra altri
        </button>
      )}

      <FinestraCardio attivita={finestraCardio} onChiudi={() => setFinestraCardio(null)} />
    </>
  );
}

/** Un obiettivo della settimana: anello + "2/3" + quanto manca. */
function Obiettivo({
  nome,
  valore,
  obiettivo,
  cardio = false,
}: {
  nome: string;
  valore: number;
  obiettivo: number;
  cardio?: boolean;
}) {
  return (
    <div className={`obiettivo-settimana${cardio ? ' cardio' : ''}`}>
      <Anello valore={valore} obiettivo={obiettivo} />
      <div>
        <span className="obiettivo-nome">{nome}</span>
        <span className="cifra-display">
          {valore}
          <small>/{obiettivo}</small>
        </span>
        <span className="testo-tenue piccolo">
          {valore >= obiettivo ? 'Fatto ✓' : `Ancora ${obiettivo - valore}`}
        </span>
      </div>
    </div>
  );
}

/** Anello di avanzamento verso l'obiettivo settimanale. */
function Anello({ valore, obiettivo }: { valore: number; obiettivo: number }) {
  const r = 26;
  const giro = 2 * Math.PI * r;
  const quota = Math.min(valore / obiettivo, 1);
  return (
    <svg className="anello" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r={r} className="anello-fondo" />
      {/* A zero non si disegna nulla (altrimenti resta un puntino). */}
      {quota > 0 && <circle
        cx="32"
        cy="32"
        r={r}
        className="anello-pieno"
        strokeDasharray={`${giro * quota} ${giro}`}
        transform="rotate(-90 32 32)"
      />}
    </svg>
  );
}
