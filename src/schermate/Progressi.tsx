import { useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../dati/db';
import type { Cardio, Esercizio, Sessione, TipoCardio } from '../dati/tipi';
import { dataBreve, dataConGiorno, dataLocale, numero, passo } from '../logica/formato';
import { eserciziConStorico, seduteEsercizio, type Seduta } from '../logica/progressi';
import { serieInBreve } from '../logica/storico';
import { vai } from '../navigazione';
import { segnaRitorno } from './Calendario';
import { Grafico, type Punto } from '../componenti/Grafico';
import { Finestra } from '../componenti/Finestra';
import { FinestraCardio, NOMI_CARDIO, riassuntoCardio } from '../componenti/ModuloCardio';
import { PREFISSO_SESSIONE } from './Allenati';
import { IconChevronRight } from '@tabler/icons-react';
import { ICONE_CARDIO, IconaEsercizio, IconaTinta } from '../componenti/Icone';
import { lunediDi, spostaData } from '../logica/settimana';
import { recordDellaSessione } from '../logica/record';

type Misura = '1rm' | 'rip';

/** Una cifra decimale: 92.44 → 92.4 */
const arrotonda = (n: number) => Math.round(n * 10) / 10;

// Nell'indirizzo il cardio si distingue dagli esercizi così: #/progressi/cardio:corsa
const PREFISSO_CARDIO = 'cardio:';

/** Una voce sceglibile in Progressi: un esercizio con i pesi o un tipo di cardio. */
interface Voce {
  id: string;
  nome: string;
  sedute: number;
  ultima: string;
  cardio: boolean;
}

// Sezione Progressi: un esercizio (o un tipo di cardio) alla volta.
export function Progressi({ dettaglio }: { dettaglio: string | null }) {
  const sessioni = useLiveQuery(() => db.sessioni.toArray(), []);
  const esercizi = useLiveQuery(() => db.esercizi.toArray(), []);
  const cardio = useLiveQuery(() => db.cardio.toArray(), []);
  const [scelta, setScelta] = useState(false);

  if (!sessioni || !esercizi || !cardio) return null;

  // Elenco delle voci con dati: prima gli esercizi (dal più recente), poi il cardio.
  const voci: Voce[] = [
    ...eserciziConStorico(sessioni).map((e) => ({
      id: e.esercizioId,
      nome: esercizi.find((x) => x.id === e.esercizioId)?.nome ?? e.nome,
      sedute: e.sedute,
      ultima: e.ultima,
      cardio: false,
    })),
    ...(['corsa', 'cyclette'] as const).flatMap((t) => {
      const elenco = cardio.filter((c) => c.tipo === t);
      if (!elenco.length) return [];
      return [
        {
          id: PREFISSO_CARDIO + t,
          nome: NOMI_CARDIO[t],
          sedute: elenco.length,
          ultima: elenco.map((c) => c.data).sort().pop()!,
          cardio: true,
        },
      ];
    }),
  ];

  if (!voci.length) {
    return (
      <>
        <h1 className="titolo-pagina">Progressi</h1>
        <section className="riquadro vuoto">
          <p>Completa il primo allenamento per vedere qui l’andamento di ogni esercizio.</p>
        </section>
      </>
    );
  }

  // Voce mostrata: quella nell'indirizzo, altrimenti la prima (l'esercizio più recente).
  const voce = voci.find((v) => v.id === dettaglio) ?? voci[0];
  const descrizione = (v: Voce) =>
    `${v.sedute === 1 ? '1 seduta' : `${v.sedute} sedute`} · ultima ${dataBreve(v.ultima)}`;

  return (
    <>
      <h1 className="titolo-pagina">Progressi</h1>

      <Panoramica sessioni={sessioni} />

      <h2 className="titolo-sezione">Esercizio per esercizio</h2>
      <button type="button" className="riquadro selettore" onClick={() => setScelta(true)}>
        <span>
          {voce.cardio ? (
            <IconaTinta
              icona={ICONE_CARDIO[voce.id.slice(PREFISSO_CARDIO.length) as TipoCardio].icona}
              colore={ICONE_CARDIO[voce.id.slice(PREFISSO_CARDIO.length) as TipoCardio].colore}
            />
          ) : (
            <IconaEsercizio nome={voce.nome} />
          )}
          <span className="testo-riga">
            <span className="scheda-nome">{voce.nome}</span>
            <span className="testo-tenue piccolo">{descrizione(voce)}</span>
          </span>
        </span>
        <span className="pulsante-testo">
          Cambia <IconChevronRight size={16} aria-hidden="true" />
        </span>
      </button>

      {voce.cardio ? (
        <CorpoCardio key={voce.id} tipo={voce.id.slice(PREFISSO_CARDIO.length) as TipoCardio} cardio={cardio} />
      ) : (
        <CorpoEsercizio
          key={voce.id}
          esercizio={esercizi.find((e) => e.id === voce.id)}
          esercizioId={voce.id}
          sessioni={sessioni}
        />
      )}

      <Finestra aperta={scelta} titolo="Scegli cosa vedere" onChiudi={() => setScelta(false)}>
        {[false, true].map((gruppoCardio) => {
          const gruppo = voci.filter((v) => v.cardio === gruppoCardio);
          if (!gruppo.length) return null;
          return (
            <div key={String(gruppoCardio)}>
              <h3 className="titolo-sezione">{gruppoCardio ? 'Cardio' : 'Esercizi con i pesi'}</h3>
              <ul className="elenco-scelta">
                {gruppo.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      className="voce-scelta"
                      aria-current={v.id === voce.id ? 'true' : undefined}
                      onClick={() => {
                        setScelta(false);
                        vai('progressi', v.id);
                      }}
                    >
                      <span>{v.nome}</span>
                      <span className="testo-tenue piccolo">{descrizione(v)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </Finestra>
    </>
  );
}

// Settimane mostrate nelle barre della panoramica.
const SETTIMANE = 8;

/**
 * Panoramica in cima a Progressi: le serie di lavoro delle ultime
 * settimane (barre) e i numeri del mese in corso.
 */
function Panoramica({ sessioni }: { sessioni: Sessione[] }) {
  if (!sessioni.length) return null;
  const questo = lunediDi(new Date());
  const settimane = Array.from({ length: SETTIMANE }, (_, i) => {
    const da = spostaData(questo, (i - SETTIMANE + 1) * 7);
    const a = spostaData(da, 7);
    const dentro = sessioni.filter((s) => s.data >= da && s.data < a);
    return {
      da,
      allenamenti: dentro.length,
      serie: dentro.reduce((t, s) => t + s.esercizi.reduce((u, e) => u + e.serie.filter((x) => !x.riscaldamento).length, 0), 0),
    };
  });
  const massimo = Math.max(...settimane.map((x) => x.serie), 1);
  const media = Math.round(settimane.slice(0, -1).reduce((t, x) => t + x.allenamenti, 0) / (SETTIMANE - 1) * 10) / 10;

  // Il mese in corso.
  const mese = dataLocale().slice(0, 7);
  const delMese = sessioni.filter((s) => s.data.startsWith(mese));
  const record = delMese.reduce((t, s) => t + recordDellaSessione(s, sessioni), 0);
  const minuti = delMese.reduce((t, s) => t + s.durataMin, 0);
  const nomeMese = new Date().toLocaleDateString('it-IT', { month: 'long' });

  return (
    <>
      <section className="riquadro riquadro-eroe">
        <div className="eroe-testa">
          <span className="etichetta-sopra accento">Serie a settimana</span>
          <span className="pastiglia blu">{numero(media)} allenamenti/sett.</span>
        </div>
        <div className="barre" role="img" aria-label={settimane.map((x) => `settimana del ${dataBreve(x.da)}: ${x.serie} serie`).join(', ')}>
          {settimane.map((x, i) => (
            <div key={x.da} className={i === SETTIMANE - 1 ? 'attuale' : ''}>
              <b>{x.serie || ''}</b>
              <i style={{ height: `${(x.serie / massimo) * 70}px` }} />
              <small>{i === SETTIMANE - 1 ? 'ora' : dataBreve(x.da).replace(/ .*/, '')}</small>
            </div>
          ))}
        </div>
      </section>
      <div className="tre-tessere">
        <div className="riquadro tessera">
          <span className="etichetta-sopra">Allenamenti</span>
          <span className="cifra-display">{delMese.length}</span>
          <span className="tessera-sotto">a {nomeMese}</span>
        </div>
        <div className="riquadro tessera">
          <span className="etichetta-sopra">Record</span>
          <span className="cifra-display" style={record ? { color: 'var(--oro)' } : undefined}>{record}</span>
          <span className="tessera-sotto">migliorati</span>
        </div>
        <div className="riquadro tessera">
          <span className="etichetta-sopra">Tempo</span>
          <span className="cifra-display">
            {minuti < 60 ? (
              <>
                {minuti}
                <small>min</small>
              </>
            ) : (
              <>
                {Math.floor(minuti / 60)}
                <small>h {String(minuti % 60).padStart(2, '0')}</small>
              </>
            )}
          </span>
          <span className="tessera-sotto">in palestra</span>
        </div>
      </div>
    </>
  );
}

/** Grafico, record e sedute di un esercizio con i pesi. */
function CorpoEsercizio({
  esercizio,
  esercizioId,
  sessioni,
}: {
  esercizio?: Esercizio;
  esercizioId: string;
  sessioni: Sessione[];
}) {
  const [misuraScelta, setMisuraScelta] = useState<Misura | null>(null);
  const tipo = esercizio?.tipo ?? 'carico';
  const sedute = seduteEsercizio(sessioni, esercizioId);

  // Quali misure hanno dati: 1RM (serie con kg) e/o ripetizioni (serie senza peso).
  const con1RM = sedute.filter((s) => s.migliore1RM);
  // (Per un esercizio con carico le ripetizioni si mostrano solo se non c'è mai un peso.)
  const conRip = sedute.filter((s) => s.maxRipSenzaPeso !== null);
  const disponibili: Misura[] = [
    ...(con1RM.length ? ['1rm' as const] : []),
    ...(conRip.length && (tipo !== 'carico' || !con1RM.length) ? ['rip' as const] : []),
  ];
  const misura: Misura = misuraScelta && disponibili.includes(misuraScelta) ? misuraScelta : disponibili[0];

  const punti =
    misura === '1rm'
      ? con1RM.map((s) => ({ data: s.data, valore: arrotonda(s.migliore1RM!.stima) }))
      : conRip.map((s) => ({ data: s.data, valore: s.maxRipSenzaPeso! }));

  const titoloGrafico =
    misura === 'rip'
      ? 'Ripetizioni migliori a corpo libero'
      : tipo === 'zavorra'
        ? '1RM stimato della sola zavorra (kg)'
        : `1RM stimato (kg${esercizio?.perLato ? ' per lato' : ''})`;

  return (
    <>
      {disponibili.length > 1 && (
        <Segmenti
          valore={misura}
          opzioni={[
            ['1rm', '1RM zavorra'],
            ['rip', 'Ripetizioni'],
          ]}
          onScegli={(m) => setMisuraScelta(m as Misura)}
        />
      )}

      <section className="riquadro spazio-sopra">
        <h2 className="titolo-grafico">{titoloGrafico}</h2>
        <Cima punti={punti} unita={misura === 'rip' ? 'rip' : 'kg'} />
        <Grafico
          punti={punti}
          linea={punti}
          area
          nomePunti={misura === 'rip' ? 'Ripetizioni' : '1RM stimato'}
          unita={misura === 'rip' ? 'rip' : 'kg'}
        />
        {misura === '1rm' && (
          <p className="testo-tenue piccolo nota-grafico">
            Stima con la formula di Epley (kg × (1 + rip/30)) sulla serie migliore di ogni seduta: più affidabile sotto
            le 10 ripetizioni.
          </p>
        )}
      </section>

      <Record sedute={sedute} misura={misura} tipo={tipo} />

      <h2 className="titolo-sezione">Sedute</h2>
      <ul className="riquadro elenco-storico">
        {[...sedute].reverse().map((s) => (
          <li key={s.sessioneId}>
            <button type="button" onClick={() => {
                segnaRitorno(false);
                vai('allenati', PREFISSO_SESSIONE + s.sessioneId); }}>
              <span className="storico-data">{dataConGiorno(s.data)}</span>
              <span className="storico-nome">{s.serie.map((x) => serieInBreve(x, tipo)).join(', ')}</span>
              <span className="testo-tenue piccolo">
                {s.serie.length} serie
                {s.migliore1RM && ` · 1RM stimato ${numero(arrotonda(s.migliore1RM.stima))} kg`}
              </span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Scelta tra misure affiancate (es. Passo / Km / Battito). */
function Segmenti({
  valore,
  opzioni,
  onScegli,
}: {
  valore: string;
  opzioni: [string, string][];
  onScegli: (v: string) => void;
}) {
  return (
    <div className="segmenti filtro-periodo" role="radiogroup" aria-label="Misura">
      {opzioni.map(([id, etichetta]) => (
        <button key={id} type="button" role="radio" aria-checked={valore === id} onClick={() => onScegli(id)}>
          {etichetta}
        </button>
      ))}
    </div>
  );
}

// Misure disponibili per il cardio.
type MisuraCardio = 'passo' | 'km' | 'tempo' | 'bpm';

interface DefinizioneMisura {
  etichetta: string;
  titolo: string;
  unita: string;
  valore: (c: Cardio) => number | null;
  formato?: (n: number) => string;
  /** Vero se un valore più basso è un miglioramento (es. il passo). */
  bassoMeglio?: boolean;
  /** Vero se salire o scendere non è di per sé meglio (es. il battito). */
  neutro?: boolean;
}

const MISURE_CARDIO: Record<MisuraCardio, DefinizioneMisura> = {
  passo: {
    etichetta: 'Passo',
    titolo: 'Passo medio (min/km) · più in alto = più veloce',
    unita: '/km',
    valore: (c) => c.passoSecKm,
    formato: passo,
    bassoMeglio: true,
  },
  km: { etichetta: 'Km', titolo: 'Distanza (km)', unita: 'km', valore: (c) => c.km },
  tempo: { etichetta: 'Tempo', titolo: 'Durata (minuti)', unita: 'min', valore: (c) => Math.round(c.durataSec / 60) },
  bpm: { etichetta: 'Battito', titolo: 'Battito medio (bpm)', unita: 'bpm', valore: (c) => c.bpmMedio, neutro: true },
};

/** Grafico, record e sedute di corsa o cyclette. */
function CorpoCardio({ tipo, cardio }: { tipo: TipoCardio; cardio: Cardio[] }) {
  const opzioni: MisuraCardio[] = tipo === 'corsa' ? ['passo', 'km', 'bpm'] : ['tempo', 'bpm'];
  const [misura, setMisura] = useState<MisuraCardio>(opzioni[0]);
  const [aperta, setAperta] = useState<Cardio | null>(null);

  const elenco = cardio.filter((c) => c.tipo === tipo).sort((a, b) => a.data.localeCompare(b.data));
  const def = MISURE_CARDIO[misura];
  // Più attività nello stesso giorno: il grafico ne mostra una per giorno (l'ultima).
  const perGiorno = new Map<string, number>();
  for (const c of elenco) {
    const v = def.valore(c);
    if (v) perGiorno.set(c.data, v);
  }
  const punti: Punto[] = [...perGiorno].map(([data, valore]) => ({ data, valore }));
  const formato = def.formato ?? numero;

  // Record del tipo di cardio.
  const record: { etichetta: string; valore: string; dettaglio: string }[] = [];
  const migliore = (f: (c: Cardio) => number | null, bassoMeglio = false) =>
    elenco
      .filter((c) => f(c))
      .reduce<Cardio | null>((m, c) => (!m || (bassoMeglio ? f(c)! < f(m)! : f(c)! > f(m)!) ? c : m), null);
  if (tipo === 'corsa') {
    const veloce = migliore((c) => c.passoSecKm, true);
    if (veloce) record.push({ etichetta: 'Passo migliore', valore: `${passo(veloce.passoSecKm!)}/km`, dettaglio: `${numero(veloce.km!)} km · ${dataBreve(veloce.data)}` });
    const lunga = migliore((c) => c.km);
    if (lunga) record.push({ etichetta: 'Corsa più lunga', valore: `${numero(lunga.km!)} km`, dettaglio: dataBreve(lunga.data) });
    record.push({ etichetta: 'Km totali', valore: `${numero(arrotonda(elenco.reduce((t, c) => t + (c.km ?? 0), 0)))} km`, dettaglio: `in ${elenco.length} uscite` });
  } else {
    const lunga = migliore((c) => c.durataSec);
    if (lunga) record.push({ etichetta: 'Seduta più lunga', valore: `${Math.round(lunga.durataSec / 60)} min`, dettaglio: dataBreve(lunga.data) });
    const totale = Math.round(elenco.reduce((t, c) => t + c.durataSec, 0) / 60);
    record.push({ etichetta: 'Tempo totale', valore: totale >= 60 ? `${Math.floor(totale / 60)} h ${totale % 60} min` : `${totale} min`, dettaglio: `in ${elenco.length} sedute` });
  }

  return (
    <>
      <Segmenti
        valore={misura}
        opzioni={opzioni.map((m) => [m, MISURE_CARDIO[m].etichetta])}
        onScegli={(m) => setMisura(m as MisuraCardio)}
      />

      <section className="riquadro spazio-sopra">
        <h2 className="titolo-grafico">{def.titolo}</h2>
        {punti.length ? (
          <>
            <Cima punti={punti} unita={def.unita} formato={formato} bassoMeglio={def.bassoMeglio} neutro={def.neutro} />
            <Grafico
              punti={punti}
              linea={punti}
              area={!def.bassoMeglio}
              nomePunti={def.etichetta}
              unita={def.unita}
              formato={formato}
              invertito={def.bassoMeglio}
            />
          </>
        ) : (
          <p className="testo-tenue">Nessun dato: inseriscilo quando registri l’attività.</p>
        )}
      </section>

      <TabellaRecord righe={record} />

      <h2 className="titolo-sezione">Sedute</h2>
      <ul className="riquadro elenco-storico">
        {[...elenco].reverse().map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => setAperta(c)}>
              <span className="storico-data">{dataConGiorno(c.data)}</span>
              <span className="storico-nome">{riassuntoCardio(c)}</span>
              <span className="testo-tenue piccolo">
                {c.bpmMin && c.bpmMax ? `battito ${c.bpmMin}–${c.bpmMax}` : c.note || ' '}
              </span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </li>
        ))}
      </ul>

      <FinestraCardio attivita={aperta} onChiudi={() => setAperta(null)} />
    </>
  );
}

/** Elenco "etichetta → valore" dei record. */
function TabellaRecord({ righe }: { righe: { etichetta: string; valore: string; dettaglio: ReactNode }[] }) {
  return (
    <>
      <h2 className="titolo-sezione">Record</h2>
      <ul className="riquadro elenco-record">
        {righe.map((r) => (
          <li key={r.etichetta}>
            <span className="testo-tenue">{r.etichetta}</span>
            <span className="record-valore">
              <strong>{r.valore}</strong>
              <small className="testo-tenue">{r.dettaglio}</small>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Valore più recente in grande, con la variazione rispetto alla prima seduta. */
function Cima({
  punti,
  unita,
  formato = numero,
  bassoMeglio = false,
  neutro = false,
}: {
  punti: Punto[];
  unita: string;
  formato?: (n: number) => string;
  /** Per il passo: scendere è un miglioramento (freccia in su, colore positivo). */
  bassoMeglio?: boolean;
  /** Variazione senza giudizio: niente colore "positivo". */
  neutro?: boolean;
}) {
  if (!punti.length) return null;
  const ultimo = punti[punti.length - 1];
  const diff = arrotonda(ultimo.valore - punti[0].valore);
  const meglio = bassoMeglio ? diff < 0 : diff > 0;
  return (
    <div className="cima">
      <span className="cifra-display">
        {formato(ultimo.valore)}
        <small> {unita}</small>
      </span>
      {punti.length > 1 && diff !== 0 && (
        <span className={`variazione${meglio && !neutro ? ' su' : ''}`}>
          {(bassoMeglio ? meglio : diff > 0) ? '▲ ' : '▼ '}
          {formato(Math.abs(diff))} {unita}
          {bassoMeglio ? (meglio ? ' più veloce' : ' più lento') : ''} dal {dataBreve(punti[0].data)}
        </span>
      )}
    </div>
  );
}

/** Record personali dell'esercizio, in base alla misura mostrata. */
function Record({ sedute, misura, tipo }: { sedute: Seduta[]; misura: Misura; tipo: string }) {
  const righe: { etichetta: string; valore: string; dettaglio: string }[] = [];

  if (misura === '1rm') {
    const migliore = sedute
      .filter((s) => s.migliore1RM)
      .reduce((a, b) => (b.migliore1RM!.stima > a.migliore1RM!.stima ? b : a));
    const m = migliore.migliore1RM!;
    righe.push({
      etichetta: '1RM stimato',
      valore: `${numero(arrotonda(m.stima))} kg`,
      dettaglio: `${numero(m.kg)}×${m.rip} · ${dataBreve(migliore.data)}`,
    });

    // Carico più alto mai usato (a parità, quello con più ripetizioni).
    let pesante = { kg: 0, rip: 0, data: '' };
    for (const s of sedute) {
      for (const x of s.serie) {
        if (x.kg > pesante.kg || (x.kg === pesante.kg && x.rip > pesante.rip)) pesante = { ...x, data: s.data };
      }
    }
    righe.push({
      etichetta: tipo === 'zavorra' ? 'Zavorra massima' : 'Carico massimo',
      valore: `${numero(pesante.kg)} kg`,
      dettaglio: `×${pesante.rip} · ${dataBreve(pesante.data)}`,
    });

  } else {
    const migliore = sedute
      .filter((s) => s.maxRipSenzaPeso !== null)
      .reduce((a, b) => (b.maxRipSenzaPeso! > a.maxRipSenzaPeso! ? b : a));
    righe.push({
      etichetta: 'Ripetizioni in una serie',
      valore: `${migliore.maxRipSenzaPeso}`,
      dettaglio: dataBreve(migliore.data),
    });
    const totali = sedute.reduce(
      (a, b) => {
        const tot = b.serie.filter((x) => x.kg === 0).reduce((t, x) => t + x.rip, 0);
        return tot > a.tot ? { tot, data: b.data } : a;
      },
      { tot: 0, data: '' },
    );
    righe.push({ etichetta: 'Ripetizioni in una seduta', valore: `${totali.tot}`, dettaglio: dataBreve(totali.data) });
  }

  righe.push({ etichetta: 'Sedute', valore: `${sedute.length}`, dettaglio: `dal ${dataBreve(sedute[0].data)}` });

  return <TabellaRecord righe={righe} />;
}
