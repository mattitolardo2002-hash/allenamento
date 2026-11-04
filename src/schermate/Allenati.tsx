import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { IconCalendar, IconChevronRight, IconPlayerPlay } from '@tabler/icons-react';
import { db } from '../dati/db';
import type { Cardio, Pesata, Scheda, Sessione, TipoCardio } from '../dati/tipi';
import { dataConGiorno, dataLocale, dataLunga, numero, orario } from '../logica/formato';
import { lunediDi, riepilogoSettimane, settimaneDiFila } from '../logica/settimana';
import { recordDellaSessione } from '../logica/record';
import { durataTipica, prossimaScheda, quandoFa, ultimaDellaScheda, ultimaFatta } from '../logica/rotazione';
import { mediaMobile } from '../logica/peso';
import { vai } from '../navigazione';
import { segnaRitorno } from './Calendario';
import { FinestraCardio, NOMI_CARDIO, riassuntoCardio } from '../componenti/ModuloCardio';
import { AnteprimaScheda } from '../componenti/AnteprimaScheda';
import { FinestraNuovo, inizia } from '../componenti/FinestraNuovo';
import { FinestraObiettiviSettimana } from '../componenti/ObiettiviSettimana';
import { ICONE_CARDIO, IconaEsercizio, IconaNumero, IconaTinta } from '../componenti/Icone';
import { useObiettivi } from '../logica/obiettivi';
import { Calendario } from './Calendario';
import { AllenamentoInCorso } from './AllenamentoInCorso';
import { DettaglioSessione } from './DettaglioSessione';
import { Riepilogo } from './Riepilogo';

// Prefissi dell'indirizzo: dettaglio di un allenamento passato (#/allenati/s:<id>)
// e riepilogo appena finito un allenamento (#/allenati/fine:<id>).
export const PREFISSO_SESSIONE = 's:';
export const PREFISSO_FINE = 'fine:';

// Sezione Allenati: cosa fare oggi, settimana e storico.
// Dentro la stessa sezione si aprono l'allenamento in corso, il riepilogo
// finale e il dettaglio di quelli passati.
export function Allenati({ dettaglio }: { dettaglio: string | null }) {
  if (dettaglio === 'in-corso') return <AllenamentoInCorso />;
  if (dettaglio === 'calendario') return <Calendario />;
  if (dettaglio?.startsWith(PREFISSO_FINE)) return <Riepilogo id={dettaglio.slice(PREFISSO_FINE.length)} />;
  if (dettaglio?.startsWith(PREFISSO_SESSIONE)) {
    return <DettaglioSessione id={dettaglio.slice(PREFISSO_SESSIONE.length)} />;
  }
  return <Home />;
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
  const pesate = useLiveQuery(() => db.pesate.orderBy('data').toArray(), []);
  const obiettivi = useObiettivi();
  // `null` = nessun allenamento in corso (undefined = ancora in caricamento).
  const bozza = useLiveQuery(() => db.bozza.get('corrente').then((b) => b ?? null), []);
  const cardio = useLiveQuery(() => db.cardio.toArray(), []);
  const [mostrati, setMostrati] = useState(PAGINA);
  // Attività cardio aperta nella finestra (nuova o da modificare).
  const [finestraCardio, setFinestraCardio] = useState<Cardio | { tipo: TipoCardio } | null>(null);
  const [anteprima, setAnteprima] = useState<Scheda | null>(null);
  const [modificaObiettivi, setModificaObiettivi] = useState(false);
  const [scegli, setScegli] = useState(false);
  // Scheda scelta per oggi toccando la rotazione (null = la prossima).
  const [sceltaId, setSceltaId] = useState<string | null>(null);

  if (!schede || !sessioni || !esercizi || !obiettivi || !cardio || !pesate || bozza === undefined) {
    return null;
  }

  // Dalla più recente alla più vecchia.
  const recenti = [...sessioni].sort((a, b) => b.fine.localeCompare(a.fine));
  const prossima = prossimaScheda(schede, sessioni);
  const ultima = ultimaFatta(schede, sessioni);
  const oggiScelta = schede.find((s) => s.id === sceltaId) ?? prossima;
  const { attuale } = riepilogoSettimane(sessioni);
  // Obiettivi di questa settimana (possono essere diversi dai predefiniti, anche 0).
  const { pesi: obiettivo, cardio: obiettivoCardio } = obiettivi.di(lunediDi(new Date()));
  const diFila = settimaneDiFila(sessioni, (l) => obiettivi.di(l).pesi);
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

  return (
    <>
      <header className="testata">
        <div>
          <span className="sopratitolo">{dataLunga(oggi).replace(/ \d{4}$/, '')}</span>
          <h1 className="titolo-pagina">Allenati</h1>
        </div>
        <button
          type="button"
          className="pulsante-tondo"
          aria-label="Calendario degli allenamenti"
          onClick={() => vai('allenati', 'calendario')}
        >
          <IconCalendar size={20} stroke={1.8} />
        </button>
      </header>

      {bozza ? (
        <section className="riquadro in-corso">
          <div>
            <span className="etichetta-sopra">
              <i className="punto-vivo" />
              In corso
            </span>
            <span className="nome-display">{bozza.schedaNome}</span>
            <span className="testo-tenue piccolo">Iniziato alle {orario(bozza.inizio)}</span>
          </div>
          <button type="button" className="pulsante primario" onClick={() => vai('allenati', 'in-corso')}>
            <IconPlayerPlay size={18} stroke={2} aria-hidden="true" />
            Riprendi
          </button>
        </section>
      ) : oggiScelta ? (
        <Eroe
          scheda={oggiScelta}
          schede={schede}
          sessioni={sessioni}
          prossimaId={prossima?.id}
          ultimaId={ultima?.schedaId ?? undefined}
          nomeEsercizio={nomeEsercizio}
          onScegliRotazione={(id) => setSceltaId(id === prossima?.id ? null : id)}
          onScegliAltro={() => setScegli(true)}
          onAnteprima={() => setAnteprima(oggiScelta)}
        />
      ) : (
        <section className="riquadro riquadro-eroe">
          <span className="etichetta-sopra accento">Per iniziare</span>
          <h2 className="nome-display grande">Crea una scheda</h2>
          <p className="eroe-sotto">Oppure fai un allenamento libero dal pulsante +.</p>
          <div className="eroe-azioni" style={{ marginTop: 16 }}>
            <button type="button" className="pulsante primario grande" onClick={() => vai('schede')}>
              Le tue schede
            </button>
          </div>
        </section>
      )}

      <section className="riquadro" aria-label="Questa settimana">
        <div className="settimana-titolo">
          <span className="etichetta-sopra">Questa settimana</span>
          <button type="button" className="pulsante-testo" onClick={() => setModificaObiettivi(true)}>
            Obiettivi
          </button>
        </div>
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

      {pesate.length > 0 && <PesoMini pesate={pesate} />}

      <div className="titolo-con-azione">
        <h2 className="titolo-sezione">Le tue schede</h2>
        <button type="button" className="pulsante-testo" onClick={() => vai('schede')}>
          Modifica <IconChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
      <ul className="riquadro elenco-avvio">
        {schede.map((s, i) => {
          const fatta = ultimaDellaScheda(s.id, sessioni);
          return (
            <li key={s.id}>
              <button type="button" className="apri-anteprima" onClick={() => setAnteprima(s)}>
                <IconaNumero
                  n={i + 1}
                  misura={36}
                  tono={s.id === prossima?.id ? 'blu' : s.id === ultima?.schedaId ? 'verde' : 'grigio'}
                />
                <span className="testo-riga">
                  <span className="storico-nome">{s.nome}</span>
                  <span className="testo-tenue piccolo">
                    {s.voci.length === 1 ? '1 esercizio' : `${s.voci.length} esercizi`} ·{' '}
                    {fatta ? quandoFa(fatta.data) : 'mai fatto'}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="pulsante piccolo-pulsante"
                disabled={!!bozza}
                onClick={() => inizia(s)}
              >
                Inizia
              </button>
            </li>
          );
        })}
        {schede.length === 0 && (
          <li>
            <span className="testo-tenue piccolo">Nessuna scheda: creane una da “Modifica”.</span>
          </li>
        )}
      </ul>

      {/* Cardio: allenamenti a sé, indipendenti dalle schede dei pesi. */}
      <h2 className="titolo-sezione">Cardio</h2>
      <ul className="riquadro elenco-avvio">
        {(['cyclette', 'corsa'] as const).map((t) => {
          const ultimaC = [...cardio].filter((c) => c.tipo === t).sort((x, y) => y.data.localeCompare(x.data))[0];
          return (
            <li key={t}>
              <div>
                <IconaTinta icona={ICONE_CARDIO[t].icona} colore={ICONE_CARDIO[t].colore} misura={36} />
                <span className="testo-riga">
                  <span className="storico-nome">{NOMI_CARDIO[t]}</span>
                  <span className="testo-tenue piccolo">
                    {ultimaC
                      ? `${quandoFa(ultimaC.data).replace(/^./, (c) => c.toUpperCase())} · ${riassuntoCardio(ultimaC)}`
                      : t === 'corsa'
                        ? 'Km, passo e battito'
                        : 'Tempo e battito medio'}
                  </span>
                </span>
              </div>
              <button type="button" className="pulsante piccolo-pulsante" onClick={() => setFinestraCardio({ tipo: t })}>
                Registra
              </button>
            </li>
          );
        })}
      </ul>

      <div className="titolo-con-azione">
        <h2 className="titolo-sezione">Ultimi allenamenti</h2>
        <button type="button" className="pulsante-testo" onClick={() => vai('allenati', 'calendario')}>
          Calendario <IconChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
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
                <button
                  type="button"
                  className="riquadro"
                  onClick={() => {
                    segnaRitorno(false);
                    vai('allenati', PREFISSO_SESSIONE + s!.id);
                  }}
                >
                  {tessera}
                  <span className="sessione-testo">
                    <span className="storico-nome">{s!.schedaNome}</span>
                    <span className="testo-tenue piccolo">
                      {dataConGiorno(s!.data).split(' ')[0]} · {s!.durataMin} min · {serieDi(s!)} serie
                    </span>
                  </span>
                  {record > 0 && (
                    <span className="distintivo-record">★ {record === 1 ? '1 record' : `${record} record`}</span>
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
      <AnteprimaScheda
        scheda={anteprima}
        puoiIniziare={!bozza}
        onChiudi={() => setAnteprima(null)}
        onInizia={(s) => {
          setAnteprima(null);
          inizia(s);
        }}
      />
      <FinestraNuovo aperta={scegli} soloPesi onChiudi={() => setScegli(false)} />
      <FinestraObiettiviSettimana aperta={modificaObiettivi} onChiudi={() => setModificaObiettivi(false)} />
    </>
  );
}

/**
 * Il riquadro principale: quale allenamento tocca oggi, la rotazione
 * delle schede (toccando un numero lo scegli per oggi) e i pulsanti
 * per iniziare o sceglierne un altro.
 */
function Eroe({
  scheda,
  schede,
  sessioni,
  prossimaId,
  ultimaId,
  nomeEsercizio,
  onScegliRotazione,
  onScegliAltro,
  onAnteprima,
}: {
  scheda: Scheda;
  schede: Scheda[];
  sessioni: Sessione[];
  prossimaId?: string;
  ultimaId?: string;
  nomeEsercizio: (id: string) => string;
  onScegliRotazione: (id: string) => void;
  onScegliAltro: () => void;
  onAnteprima: () => void;
}) {
  const ePrevista = scheda.id === prossimaId;
  const fatta = ultimaDellaScheda(scheda.id, sessioni);
  const minuti = durataTipica(scheda.id, sessioni);
  const nomi = scheda.voci.map((v) => nomeEsercizio(v.esercizioId));
  const descrizione = [
    scheda.voci.length === 1 ? '1 esercizio' : `${scheda.voci.length} esercizi`,
    minuti && `circa ${minuti} min`,
    fatta ? `ultima volta ${quandoFa(fatta.data)}` : 'mai fatto finora',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className="riquadro riquadro-eroe">
      <div className="eroe-testa">
        <span className="etichetta-sopra accento">{ePrevista ? 'Oggi tocca a' : 'Scelto per oggi'}</span>
        {schede.length > 1 && (
          <span className="pastiglia blu">
            {schede.indexOf(scheda) + 1} di {schede.length}
          </span>
        )}
      </div>
      <h2 className="nome-display grande">{scheda.nome}</h2>
      <p className="eroe-sotto">{descrizione}</p>

      {schede.length > 1 && (
        <div className="rotazione" role="group" aria-label="Rotazione delle schede: tocca per scegliere">
          {schede.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={s.id === prossimaId ? 'prossima' : s.id === ultimaId ? 'ultima' : ''}
              aria-pressed={s.id === scheda.id}
              aria-label={`${s.nome}${s.id === prossimaId ? ' (prossimo)' : s.id === ultimaId ? ' (fatto l’ultima volta)' : ''}`}
              onClick={() => onScegliRotazione(s.id)}
            >
              {i + 1}
              {s.id === ultimaId && s.id !== scheda.id && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}

      {nomi.length > 0 && (
        <div className="icone-esercizi" aria-label={`Esercizi: ${nomi.join(', ')}`}>
          {nomi.slice(0, 4).map((n, i) => (
            <IconaEsercizio key={i} nome={n} misura={30} />
          ))}
          <span className="testo-tenue">
            {nomi.slice(0, 2).join(', ')}
            {nomi.length > 2 ? ` +${nomi.length - 2}` : ''}
          </span>
        </div>
      )}

      <div className="eroe-azioni">
        <button type="button" className="pulsante primario grande" onClick={() => inizia(scheda)}>
          <IconPlayerPlay size={18} stroke={2} aria-hidden="true" />
          Inizia
        </button>
        <button type="button" className="pulsante vetro grande" onClick={onScegliAltro}>
          Scegli un altro
        </button>
      </div>
      <button type="button" className="pulsante-testo eroe-link" onClick={onAnteprima}>
        Vedi i kg dell’ultima volta <IconChevronRight size={16} aria-hidden="true" />
      </button>
    </section>
  );
}

/** Peso medio degli ultimi giorni, con una piccola linea dell'andamento (ultimi 30 giorni). */
function PesoMini({ pesate }: { pesate: Pesata[] }) {
  const medie = mediaMobile(pesate).slice(-30);
  const attuale = medie[medie.length - 1].media;
  const [intero, decimali] = numero(Math.round(attuale * 10) / 10).split(',');
  const valori = medie.map((m) => m.media);
  const min = Math.min(...valori);
  const max = Math.max(...valori);
  const punti = valori.map((v, i) => {
    const x = valori.length === 1 ? 60 : (i / (valori.length - 1)) * 120;
    const y = max === min ? 20 : 36 - ((v - min) / (max - min)) * 32;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <button type="button" className="riquadro peso-mini" onClick={() => vai('peso')}>
      <span>
        <span className="etichetta-sopra">Peso · media 7 giorni</span>
        <span className="cifra-display">
          {intero}
          {decimali && <span className="decimali">,{decimali}</span>}
          <small> kg</small>
        </span>
      </span>
      {valori.length > 1 && (
        <svg viewBox="0 0 120 40" aria-hidden="true">
          <polyline points={punti.join(' ')} fill="none" stroke="#3b86f0" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )}
    </button>
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
    <div className={`obiettivo-settimana${cardio ? ' cardio' : ''}${obiettivo === 0 ? ' pausa' : ''}`}>
      <Anello valore={valore} obiettivo={obiettivo} />
      <div>
        <span className="obiettivo-nome">{nome}</span>
        {obiettivo === 0 ? (
          <span className="cifra-display">Pausa</span>
        ) : (
          <span className="cifra-display">
            {valore}
            <small>/{obiettivo}</small>
          </span>
        )}
        <span className="testo-tenue piccolo">
          {obiettivo === 0
            ? valore > 0
              ? `Fatte comunque: ${valore}`
              : 'Settimana di riposo'
            : valore >= obiettivo
              ? 'Fatto ✓'
              : `Ancora ${obiettivo - valore}`}
        </span>
      </div>
    </div>
  );
}

/** Anello di avanzamento verso l'obiettivo settimanale. */
function Anello({ valore, obiettivo }: { valore: number; obiettivo: number }) {
  const r = 26;
  const giro = 2 * Math.PI * r;
  const quota = obiettivo === 0 ? 0 : Math.min(valore / obiettivo, 1);
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
