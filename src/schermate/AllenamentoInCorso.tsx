import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../dati/db';
import type { Bozza, Esercizio, EsercizioBozza, SerieBozza } from '../dati/tipi';
import { annullaAllenamento, concludiAllenamento, eserciziSvolti, serieVuota } from '../dati/allenamento';
import { durata, leggiNumero, numero } from '../logica/formato';
import { testoUltimaVolta, ultimeVolte, type UltimaVolta } from '../logica/storico';
import { eRecord, miglioriPerEsercizio, type Migliori } from '../logica/record';
import { vai } from '../navigazione';
import { PREFISSO_FINE } from './Allenati';
import { Conferma, Finestra } from '../componenti/Finestra';
import { NOMI_TIPO, SceltaEsercizio } from '../componenti/SceltaEsercizio';
import { IconaEsercizio } from '../componenti/Icone';
import { avviaRecupero, BarraRecupero, fermaRecupero } from '../componenti/Recupero';

/**
 * Schermata usata in palestra: per ogni esercizio una riga per serie
 * con kg, ripetizioni e ✓. Ogni tocco viene salvato subito nella bozza.
 */
export function AllenamentoInCorso() {
  const [bozza, setBozza] = useState<Bozza | null | undefined>(undefined);
  const esercizi = useLiveQuery(() => db.esercizi.toArray(), []);
  const sessioni = useLiveQuery(() => db.sessioni.toArray(), []);
  const [errori, setErrori] = useState<Record<number, string>>({});
  const [aggiungi, setAggiungi] = useState(false);
  const [termina, setTermina] = useState(false);
  const [annulla, setAnnulla] = useState(false);
  const [daRimuovere, setDaRimuovere] = useState<number | null>(null);
  // Esercizio aperto scelto a mano (null = il primo non ancora finito).
  const [scelto, setScelto] = useState<number | null>(null);
  // Esercizio di cui è aperto il menu ⋯.
  const [menu, setMenu] = useState<number | null>(null);

  // La bozza si legge una volta; da lì in poi comanda lo stato qui sotto.
  useEffect(() => {
    db.bozza.get('corrente').then((b) => setBozza(b ?? null));
  }, []);

  const ultime = useMemo(() => ultimeVolte(sessioni ?? []), [sessioni]);
  const migliori = useMemo(() => miglioriPerEsercizio(sessioni ?? []), [sessioni]);
  const anagrafica = useMemo(() => new Map((esercizi ?? []).map((e) => [e.id, e])), [esercizi]);
  const nomi = useMemo(() => new Map((esercizi ?? []).map((e) => [e.id, e.nome])), [esercizi]);

  const attivo = bozza ? esercizioAttivo(bozza, scelto) : null;
  // Quando si passa a un altro esercizio lo si porta in vista (non all'apertura).
  const precedente = useRef<number | null>(null);
  useEffect(() => {
    const prima = precedente.current;
    precedente.current = attivo;
    // Niente scorrimento all'apertura (da "nessuno" al primo) o se non cambia.
    if (prima === null || attivo === null || prima === attivo) return;
    requestAnimationFrame(() =>
      document.getElementById(`esercizio-${attivo}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }, [attivo]);

  if (bozza === undefined || !esercizi || !sessioni) return null;
  if (bozza === null) {
    return (
      <>
        <h1 className="titolo-pagina">Allenamento</h1>
        <section className="riquadro vuoto">
          <p>Nessun allenamento in corso.</p>
        </section>
        <button type="button" className="pulsante largo" onClick={() => vai('allenati')}>
          Torna ad Allenati
        </button>
      </>
    );
  }

  const salva = (nuova: Bozza) => {
    setBozza(nuova);
    db.bozza.put(nuova);
  };
  const cambiaEsercizio = (ei: number, modifica: (e: EsercizioBozza) => EsercizioBozza) =>
    salva({ ...bozza, esercizi: bozza.esercizi.map((e, i) => (i === ei ? modifica(e) : e)) });
  const cambiaSerie = (ei: number, si: number, modifica: Partial<SerieBozza>) =>
    cambiaEsercizio(ei, (e) => ({ ...e, serie: e.serie.map((s, i) => (i === si ? { ...s, ...modifica } : s)) }));
  const segnaErrore = (ei: number, testo: string) => setErrori((prec) => ({ ...prec, [ei]: testo }));

  // Tocco su ✓: conferma la serie (usando i valori in grigio se i campi sono vuoti)
  // oppure, se era già confermata, la riapre per correggerla.
  const confermaSerie = (ei: number, si: number) => {
    const e = bozza.esercizi[ei];
    const s = e.serie[si];
    if (s.fatta) return cambiaSerie(ei, si, { fatta: false });

    const tipo = anagrafica.get(e.esercizioId)?.tipo ?? 'carico';
    const consiglio = suggerimento(e, si, ultime.get(e.esercizioId));
    const n = si + 1;

    let kg = 0;
    if (tipo !== 'corpo') {
      const testoKg = s.kg.trim() || (consiglio ? numero(consiglio.kg) : '');
      if (testoKg === '' && tipo === 'carico') return segnaErrore(ei, `Serie ${n}: inserisci i kg.`);
      const letto = testoKg === '' ? 0 : leggiNumero(testoKg);
      if (letto === null || letto > 999) return segnaErrore(ei, `Serie ${n}: kg non validi (es. 82,5).`);
      kg = letto;
    }

    const testoRip = s.rip.trim() || (consiglio ? String(consiglio.rip) : '');
    if (testoRip === '') return segnaErrore(ei, `Serie ${n}: inserisci le ripetizioni.`);
    const rip = leggiNumero(testoRip);
    if (rip === null || !Number.isInteger(rip) || rip < 1 || rip > 999) {
      return segnaErrore(ei, `Serie ${n}: le ripetizioni devono essere un numero intero.`);
    }

    segnaErrore(ei, '');
    cambiaSerie(ei, si, { kg: tipo === 'corpo' ? '' : numero(kg), rip: String(rip), fatta: true });

    // Esercizio finito: si passa da soli al prossimo da fare.
    const restanti = e.serie.filter((x, i) => i !== si && !x.fatta && !x.riscaldamento).length;
    if (restanti === 0 && !s.riscaldamento) setScelto(null);
    // Recupero, tranne dopo l'ultima serie dell'allenamento.
    const daFare = bozza.esercizi.some((x, i) => x.serie.some((y, j) => !y.fatta && !(i === ei && j === si)));
    if (daFare) avviaRecupero();
  };

  const svolti = eserciziSvolti(bozza, nomi);
  const serieFatte = svolti.reduce((tot, e) => tot + e.serie.length, 0);
  // Avanzamento: serie di lavoro confermate su quelle previste.
  const lavoro = bozza.esercizi.flatMap((e) => e.serie.filter((s) => !s.riscaldamento));
  const avanzamento = lavoro.length ? lavoro.filter((s) => s.fatta).length / lavoro.length : 0;
  // Record battuti oggi (esercizi con almeno una serie da record).
  const recordOggi = bozza.esercizi.filter((e) =>
    e.serie.some((s) => s.fatta && !s.riscaldamento && eRecord(serieNumerica(s), migliori.get(e.esercizioId))),
  ).length;

  const lavoroFatte = lavoro.filter((s) => s.fatta).length;
  // Primo esercizio non finito dopo quello aperto: segnato come "Poi".
  const poi = bozza.esercizi.findIndex((e, i) => i > (attivo ?? -1) && !completato(e));
  const eMenu = menu !== null ? bozza.esercizi[menu] : null;
  const altMenu = eMenu?.alternativaId ? anagrafica.get(eMenu.alternativaId) : undefined;

  return (
    <>
      <header className="testata-allenamento">
        <button type="button" className="pulsante-icona" aria-label="Torna ad Allenati" onClick={() => vai('allenati')}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="testata-centro">
          <h1>
            {bozza.schedaNome}
            {attivo !== null && ` · ${attivo + 1} di ${bozza.esercizi.length}`}
          </h1>
          <p className="testata-dati">
            <Cronometro inizio={bozza.inizio} />
            {recordOggi > 0 && <span className="testo-record">★ {recordOggi}</span>}
          </p>
        </div>
        <div className="testata-destra">
          <span className="testata-serie">
            {lavoroFatte}
            <small>/{lavoro.length} serie</small>
          </span>
          <button type="button" className="pulsante-testo" onClick={() => setTermina(true)}>
            Fine ›
          </button>
        </div>
        <div
          className="barra-avanzamento"
          role="progressbar"
          aria-label="Serie completate"
          aria-valuenow={Math.round(avanzamento * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <i style={{ width: `${avanzamento * 100}%` }} />
        </div>
      </header>

      <label className="riquadro interruttore riscaldamento">
        <input
          type="checkbox"
          checked={bozza.riscaldamentoFatto}
          onChange={(ev) => salva({ ...bozza, riscaldamentoFatto: ev.target.checked })}
        />
        <span>Riscaldamento fatto</span>
      </label>

      {attivo === null && bozza.esercizi.length > 0 && (
        <section className="riquadro tutto-fatto">
          <span className="etichetta-sopra">Tutto fatto</span>
          <p>Hai completato tutti gli esercizi. Premi “Fine” per salvare.</p>
          <button type="button" className="pulsante primario largo" onClick={() => setTermina(true)}>
            Fine allenamento
          </button>
        </section>
      )}

      <ol className="elenco-esercizi">
        {bozza.esercizi.map((e, ei) => {
          const es = anagrafica.get(e.esercizioId);
          const alt = e.alternativaId ? anagrafica.get(e.alternativaId) : undefined;
          const ultima = ultime.get(e.esercizioId);
          const diLavoro = e.serie.filter((s) => !s.riscaldamento);
          const fatte = diLavoro.filter((s) => s.fatta).length;
          const finito = completato(e);

          // Esercizi non aperti: una riga compatta, toccandola si apre.
          if (ei !== attivo) {
            return (
              <li key={ei} id={`esercizio-${ei}`}>
                <button
                  type="button"
                  className={`riga-esercizio${finito ? ' finito' : ''}`}
                  onClick={() => setScelto(ei)}
                >
                  <span className="riga-esercizio-segno" aria-hidden="true">
                    {finito ? '✓' : ei + 1}
                  </span>
                  <span className="riga-esercizio-nome">
                    {ei === poi && <b>Poi · </b>}
                    {es?.nome ?? '?'}
                  </span>
                  <span className="riga-esercizio-dati">{riassunto(e, es?.tipo ?? 'carico', fatte)}</span>
                </button>
              </li>
            );
          }

          return (
            <li key={ei} id={`esercizio-${ei}`} className="riquadro esercizio attivo">
              <div className="esercizio-testa">
                <div className="esercizio-titolo">
                  <IconaEsercizio nome={es?.nome ?? ''} />
                  <h2>{es?.nome ?? '?'}</h2>
                  <span className="conteggio">
                    {fatte}/{diLavoro.length}
                  </span>
                  <button
                    type="button"
                    className="pulsante-icona"
                    aria-label={`Altre azioni per ${es?.nome ?? 'l’esercizio'}`}
                    onClick={() => setMenu(ei)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M6 12h.01M12 12h.01M18 12h.01" strokeWidth="3" />
                    </svg>
                  </button>
                </div>
                <p className="testo-tenue piccolo">
                  {[
                    e.obiettivo && `${e.obiettivo.serie}×${e.obiettivo.rip || '—'}`,
                    e.obiettivo?.nota,
                    es && es.tipo !== 'carico' && NOMI_TIPO[es.tipo],
                    es?.perLato && 'kg e rip per lato',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <p className="ultima-volta">
                  {ultima && es ? testoUltimaVolta(ultima, es.tipo) : 'Prima volta: nessun dato precedente'}
                </p>
                {alt && (
                  <button
                    type="button"
                    className="pulsante-testo"
                    onClick={() =>
                      cambiaEsercizio(ei, (x) => ({ ...x, esercizioId: alt.id, alternativaId: x.esercizioId }))
                    }
                  >
                    ⇄ Fai invece {alt.nome}
                  </button>
                )}
              </div>

              <TabellaSerie
                esercizio={e}
                tipo={es?.tipo ?? 'carico'}
                perLato={es?.perLato ?? false}
                ultima={ultima}
                migliori={migliori.get(e.esercizioId)}
                onCambia={(si, modifica) => cambiaSerie(ei, si, modifica)}
                onConferma={(si) => confermaSerie(ei, si)}
              />

              {errori[ei] && <p className="errore">{errori[ei]}</p>}
            </li>
          );
        })}
      </ol>

      <button type="button" className="pulsante largo" onClick={() => setAggiungi(true)}>
        + Aggiungi esercizio
      </button>
      <button type="button" className="pulsante largo pericolo-tenue" onClick={() => setAnnulla(true)}>
        Annulla allenamento
      </button>

      <Finestra aperta={menu !== null} titolo={eMenu ? (anagrafica.get(eMenu.esercizioId)?.nome ?? 'Esercizio') : ''} onChiudi={() => setMenu(null)}>
        {eMenu && menu !== null && (
          <div className="fila-pulsanti verticale menu-esercizio">
            <button
              type="button"
              className="pulsante largo"
              onClick={() => {
                cambiaEsercizio(menu, (x) => ({ ...x, serie: [...x.serie, serieVuota()] }));
                setMenu(null);
              }}
            >
              + Aggiungi una serie
            </button>
            <button
              type="button"
              className="pulsante largo"
              disabled={!eMenu.serie.some((s) => !s.fatta)}
              onClick={() => {
                cambiaEsercizio(menu, (x) => {
                  // Toglie l'ultima serie non ancora confermata.
                  const i = x.serie.map((s) => s.fatta).lastIndexOf(false);
                  return { ...x, serie: x.serie.filter((_, j) => j !== i) };
                });
                setMenu(null);
              }}
            >
              − Togli una serie
            </button>
            <button
              type="button"
              className="pulsante largo"
              onClick={() => {
                cambiaEsercizio(menu, (x) => {
                  // Il riscaldamento va prima delle serie di lavoro.
                  const dopo = x.serie.findIndex((s) => !s.riscaldamento);
                  const serie = [...x.serie];
                  serie.splice(dopo === -1 ? serie.length : dopo, 0, serieVuota(true));
                  return { ...x, serie };
                });
                setMenu(null);
              }}
            >
              + Serie di riscaldamento
            </button>
            {altMenu && (
              <button
                type="button"
                className="pulsante largo"
                onClick={() => {
                  cambiaEsercizio(menu, (x) => ({ ...x, esercizioId: altMenu.id, alternativaId: x.esercizioId }));
                  setMenu(null);
                }}
              >
                ⇄ Fai invece {altMenu.nome}
              </button>
            )}
            <button
              type="button"
              className="pulsante largo pericolo-tenue"
              onClick={() => {
                const ei = menu;
                setMenu(null);
                if (eMenu.serie.some((s) => s.fatta)) setDaRimuovere(ei);
                else {
                  salva({ ...bozza, esercizi: bozza.esercizi.filter((_, i) => i !== ei) });
                  setScelto(null);
                }
              }}
            >
              Rimuovi esercizio
            </button>
          </div>
        )}
      </Finestra>

      <BarraRecupero />

      <SceltaEsercizio
        aperta={aggiungi}
        titolo="Aggiungi esercizio"
        onChiudi={() => setAggiungi(false)}
        onScegli={(esercizioId) => {
          salva({
            ...bozza,
            esercizi: [...bozza.esercizi, { esercizioId, serie: [serieVuota(), serieVuota(), serieVuota()] }],
          });
          setAggiungi(false);
        }}
      />

      <FinestraTermina
        aperta={termina}
        serieFatte={serieFatte}
        record={recordOggi}
        onChiudi={() => setTermina(false)}
        onSalva={async (rpe, note) => {
          const id = await concludiAllenamento(bozza, nomi, rpe, note);
          fermaRecupero();
          vai('allenati', PREFISSO_FINE + id);
        }}
      />

      <Conferma
        aperta={annulla}
        titolo="Annullare l’allenamento?"
        testo="Tutte le serie di questo allenamento verranno scartate. Lo storico non cambia."
        etichetta="Annulla allenamento"
        onAnnulla={() => setAnnulla(false)}
        onConferma={async () => {
          await annullaAllenamento();
          fermaRecupero();
          vai('allenati');
        }}
      />

      <Conferma
        aperta={daRimuovere !== null}
        titolo="Rimuovere l’esercizio?"
        testo="Ha già delle serie confermate: verranno scartate."
        etichetta="Rimuovi"
        onAnnulla={() => setDaRimuovere(null)}
        onConferma={() => {
          salva({ ...bozza, esercizi: bozza.esercizi.filter((_, i) => i !== daRimuovere) });
          setDaRimuovere(null);
          setScelto(null);
        }}
      />
    </>
  );
}

/** Vero se tutte le serie di lavoro dell'esercizio sono confermate. */
function completato(e: EsercizioBozza): boolean {
  const lavoro = e.serie.filter((s) => !s.riscaldamento);
  return lavoro.length > 0 && lavoro.every((s) => s.fatta);
}

/** Esercizio da mostrare aperto: quello scelto a mano, altrimenti il primo non finito. */
function esercizioAttivo(bozza: Bozza, scelto: number | null): number | null {
  if (scelto !== null && scelto < bozza.esercizi.length) return scelto;
  const i = bozza.esercizi.findIndex((e) => !completato(e));
  return i === -1 ? null : i;
}

/** Testo a destra delle righe compatte: cosa prevede, oppure cosa hai fatto. */
function riassunto(e: EsercizioBozza, tipo: Esercizio['tipo'], fatte: number): string {
  const lavoro = e.serie.filter((s) => !s.riscaldamento);
  if (fatte === 0) return e.obiettivo ? `${e.obiettivo.serie}×${e.obiettivo.rip || '—'}` : `${lavoro.length} serie`;
  const confermate = lavoro.filter((s) => s.fatta);
  const kg = Math.max(...confermate.map((s) => leggiNumero(s.kg) ?? 0));
  const testo = fatte < lavoro.length ? `${fatte}/${lavoro.length} serie` : `${fatte} serie`;
  return tipo !== 'corpo' && kg > 0 ? `${testo} · ${tipo === 'zavorra' ? '+' : ''}${numero(kg)} kg` : testo;
}

/**
 * Valori suggeriti (in grigio) per una serie: la serie corrispondente
 * dell'ultima volta; se non c'è storico, la serie precedente di oggi.
 */
function suggerimento(e: EsercizioBozza, si: number, ultima?: UltimaVolta): { kg: number; rip: number } | null {
  const serie = e.serie[si];
  if (serie.riscaldamento) return null;
  const indiceLavoro = e.serie.slice(0, si).filter((s) => !s.riscaldamento).length;
  if (ultima) return ultima.serie[indiceLavoro] ?? ultima.serie[ultima.serie.length - 1];
  const precedente = e.serie
    .slice(0, si)
    .reverse()
    .find((s) => s.fatta && !s.riscaldamento);
  if (precedente) return { kg: leggiNumero(precedente.kg) ?? 0, rip: leggiNumero(precedente.rip) ?? 0 };
  return null;
}

/** Valori numerici di una serie della bozza (i campi sono testo). */
function serieNumerica(s: SerieBozza) {
  return { kg: leggiNumero(s.kg) ?? 0, rip: leggiNumero(s.rip) ?? 0 };
}

function TabellaSerie({
  esercizio,
  tipo,
  perLato,
  ultima,
  migliori,
  onCambia,
  onConferma,
}: {
  esercizio: EsercizioBozza;
  tipo: Esercizio['tipo'];
  perLato: boolean;
  ultima?: UltimaVolta;
  migliori?: Migliori;
  onCambia: (si: number, modifica: Partial<SerieBozza>) => void;
  onConferma: (si: number) => void;
}) {
  const conKg = tipo !== 'corpo';
  let numeroLavoro = 0;
  return (
    <div className={`tabella-serie${conKg ? '' : ' senza-kg'}`}>
      <div className="riga-serie intestazione">
        <span aria-label="Serie">#</span>
        {conKg && <span>{tipo === 'zavorra' ? 'Zavorra' : perLato ? 'Kg/lato' : 'Kg'}</span>}
        <span>Rip</span>
        <span />
      </div>
      {esercizio.serie.map((s, si) => {
        if (!s.riscaldamento) numeroLavoro++;
        const consiglio = suggerimento(esercizio, si, ultima);
        // Serie confermata che batte il meglio di sempre: la segnamo con una stella.
        const record = s.fatta && !s.riscaldamento && eRecord(serieNumerica(s), migliori);
        return (
          <div key={si} className={`riga-serie${s.fatta ? ' fatta' : ''}${record ? ' record' : ''}`}>
            <span className="numero-serie" title={record ? 'Nuovo record' : undefined}>
              {record ? '★' : s.riscaldamento ? 'R' : numeroLavoro}
            </span>
            {conKg && (
              <CampoPasso
                etichetta={`kg serie ${si + 1}`}
                decimali
                valore={s.kg}
                suggerito={consiglio?.kg}
                passo={PASSO_KG}
                minimo={0}
                placeholder={consiglio ? numero(consiglio.kg) : tipo === 'zavorra' ? '0' : ''}
                bloccato={s.fatta}
                onCambia={(kg) => onCambia(si, { kg })}
              />
            )}
            <CampoPasso
              etichetta={`ripetizioni serie ${si + 1}`}
              valore={s.rip}
              suggerito={consiglio?.rip}
              passo={1}
              minimo={1}
              placeholder={consiglio ? String(consiglio.rip) : ''}
              bloccato={s.fatta}
              onCambia={(rip) => onCambia(si, { rip })}
            />
            <button
              type="button"
              className="spunta"
              aria-label={s.fatta ? `Riapri serie ${si + 1}` : `Conferma serie ${si + 1}`}
              aria-pressed={s.fatta}
              onClick={() => onConferma(si)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Di quanto cambiano i kg con − e +. */
const PASSO_KG = 2.5;

/**
 * Campo numerico con − e + ai lati: si usa con una mano, senza tastiera.
 * Se il campo è vuoto si parte dal valore suggerito (quello in grigio).
 */
function CampoPasso({
  etichetta,
  valore,
  suggerito,
  passo,
  minimo,
  decimali = false,
  placeholder,
  bloccato,
  onCambia,
}: {
  etichetta: string;
  valore: string;
  suggerito?: number;
  passo: number;
  minimo: number;
  decimali?: boolean;
  placeholder: string;
  bloccato: boolean;
  onCambia: (testo: string) => void;
}) {
  const sposta = (verso: 1 | -1) => {
    const base = leggiNumero(valore) ?? suggerito ?? 0;
    // Senza nulla da cui partire, il + parte dal minimo utile.
    const nuovo = Math.max(minimo, Math.round((base + verso * passo) * 100) / 100);
    onCambia(numero(nuovo));
  };
  return (
    <div className="campo-passo">
      <button type="button" tabIndex={-1} aria-label={`Meno ${etichetta}`} disabled={bloccato} onClick={() => sposta(-1)}>
        −
      </button>
      <input
        className="campo"
        inputMode={decimali ? 'decimal' : 'numeric'}
        pattern={decimali ? undefined : '[0-9]*'}
        aria-label={etichetta.replace(/^./, (c) => c.toUpperCase())}
        value={valore}
        placeholder={placeholder}
        disabled={bloccato}
        onChange={(ev) => onCambia(ev.target.value)}
      />
      <button type="button" tabIndex={-1} aria-label={`Più ${etichetta}`} disabled={bloccato} onClick={() => sposta(1)}>
        +
      </button>
    </div>
  );
}

/** Durata dall'inizio, aggiornata ogni secondo (calcolata dall'orario, non da un contatore). */
function Cronometro({ inizio }: { inizio: string }) {
  const [adesso, setAdesso] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAdesso(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span>{durata((adesso - new Date(inizio).getTime()) / 1000)}</span>;
}

function FinestraTermina({
  aperta,
  serieFatte,
  record,
  onChiudi,
  onSalva,
}: {
  aperta: boolean;
  serieFatte: number;
  record: number;
  onChiudi: () => void;
  onSalva: (rpe: number | null, note: string) => void;
}) {
  const [rpe, setRpe] = useState<number | null>(null);
  const [note, setNote] = useState('');

  return (
    <Finestra aperta={aperta} titolo="Termina allenamento" onChiudi={onChiudi}>
      {serieFatte === 0 ? (
        <p className="errore">
          Nessuna serie confermata: non c’è niente da salvare. Conferma almeno una serie con ✓, oppure annulla
          l’allenamento.
        </p>
      ) : (
        <p className="testo-tenue">
          {serieFatte === 1 ? '1 serie confermata' : `${serieFatte} serie confermate`}
          {record > 0 && (
            <span className="testo-record">
              {' '}
              · ★ {record === 1 ? 'nuovo record' : `${record} nuovi record`}
            </span>
          )}
          . Si salvano solo le serie confermate.
        </p>
      )}

      <div className="modulo">
        <div className="campo-etichettato">
          <span>Fatica percepita (RPE, facoltativa)</span>
          <div className="griglia-rpe">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={rpe === n}
                onClick={() => setRpe(rpe === n ? null : n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <label className="campo-etichettato">
          <span>Note</span>
          <textarea
            className="campo area"
            rows={3}
            value={note}
            placeholder="Come è andata?"
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </div>

      <div className="fila-pulsanti">
        <button type="button" className="pulsante" onClick={onChiudi}>
          Continua
        </button>
        <button
          type="button"
          className="pulsante primario"
          disabled={serieFatte === 0}
          onClick={() => onSalva(rpe, note)}
        >
          Salva
        </button>
      </div>
    </Finestra>
  );
}
