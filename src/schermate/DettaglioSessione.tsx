import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../dati/db';
import type { Esercizio, Sessione } from '../dati/tipi';
import { dataLunga, leggiNumero, numero, orario } from '../logica/formato';
import { serieInBreve, volume } from '../logica/storico';
import { eRecord, miglioriPerEsercizio } from '../logica/record';
import { vai } from '../navigazione';
import { Conferma } from '../componenti/Finestra';

/** Un allenamento passato: lettura, correzione ed eliminazione. */
export function DettaglioSessione({ id }: { id: string }) {
  // `null` = non trovato (undefined = in caricamento).
  const sessione = useLiveQuery(() => db.sessioni.get(id).then((s) => s ?? null), [id]);
  const esercizi = useLiveQuery(() => db.esercizi.toArray(), []);
  const tutte = useLiveQuery(() => db.sessioni.toArray(), []);
  const [modifica, setModifica] = useState(false);
  const [elimina, setElimina] = useState(false);

  if (sessione === undefined || !esercizi) return null;
  if (sessione === null) {
    return (
      <>
        <Indietro />
        <section className="riquadro vuoto">
          <p>Questo allenamento non esiste più.</p>
        </section>
      </>
    );
  }

  const tipo = (eid: string) => esercizi.find((e) => e.id === eid)?.tipo ?? 'carico';
  // Migliori risultati prima di questo allenamento, per segnare i record (★).
  const precedenti = miglioriPerEsercizio((tutte ?? []).filter((s) => s.fine < sessione.fine));

  if (modifica) {
    return <ModificaSessione sessione={sessione} esercizi={esercizi} onFine={() => setModifica(false)} />;
  }

  return (
    <>
      <Indietro />
      <span className="sopratitolo">{dataLunga(sessione.data)}</span>
      <h1 className="titolo-pagina">{sessione.schedaNome}</h1>

      <dl className="riquadro cifre-sessione">
        <div>
          <dt>Durata</dt>
          <dd>{sessione.durataMin} min</dd>
          <span className="testo-tenue piccolo">
            {orario(sessione.inizio)}–{orario(sessione.fine)}
          </span>
        </div>
        <div>
          <dt>Serie</dt>
          <dd>{sessione.esercizi.reduce((t, e) => t + e.serie.filter((x) => !x.riscaldamento).length, 0)}</dd>
          <span className="testo-tenue piccolo">{sessione.riscaldamentoFatto ? 'con riscaldamento' : ' '}</span>
        </div>
        <div>
          <dt>RPE</dt>
          <dd>{sessione.rpe ?? '—'}</dd>
          <span className="testo-tenue piccolo">fatica percepita</span>
        </div>
      </dl>

      <ul className="elenco-esercizi">
        {sessione.esercizi.map((e, i) => {
          let n = 0;
          return (
            <li key={i} className="riquadro esercizio-passato">
              <div className="esercizio-passato-testa">
                <h2>{e.nome}</h2>
              </div>
              <ol className="serie-passate">
                {e.serie.map((s, j) => {
                  const record = !s.riscaldamento && eRecord(s, precedenti.get(e.esercizioId));
                  return (
                    <li key={j} className={s.riscaldamento ? 'riscaldamento' : record ? 'record' : ''}>
                      <span className="numero-serie">{s.riscaldamento ? 'R' : record ? '★' : ++n}</span>
                      <span>{serieInBreve(s, tipo(e.esercizioId))}</span>
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ul>

      {sessione.note && (
        <section className="riquadro note">
          <span className="etichetta-sopra">Note</span>
          <p>{sessione.note}</p>
        </section>
      )}

      <button type="button" className="pulsante largo" onClick={() => setModifica(true)}>
        Modifica
      </button>
      <button type="button" className="pulsante largo pericolo-tenue" onClick={() => setElimina(true)}>
        Elimina allenamento
      </button>

      <Conferma
        aperta={elimina}
        titolo="Eliminare l’allenamento?"
        testo={`L’allenamento del ${dataLunga(sessione.data)} verrà eliminato definitivamente.`}
        etichetta="Elimina"
        onAnnulla={() => setElimina(false)}
        onConferma={async () => {
          await db.sessioni.delete(sessione.id);
          vai('allenati');
        }}
      />
    </>
  );
}

/** Correzione di un allenamento passato: kg, ripetizioni, data, RPE e note. */
function ModificaSessione({
  sessione,
  esercizi,
  onFine,
}: {
  sessione: Sessione;
  esercizi: Esercizio[];
  onFine: () => void;
}) {
  // Copia di lavoro con i numeri come testo, in formato italiano.
  const [bozza, setBozza] = useState(() => ({
    data: sessione.data,
    rpe: sessione.rpe,
    note: sessione.note,
    esercizi: sessione.esercizi.map((e) => ({
      ...e,
      serie: e.serie.map((s) => ({ ...s, kg: numero(s.kg), rip: String(s.rip) })),
    })),
  }));
  const [errore, setErrore] = useState('');

  const tipo = (eid: string) => esercizi.find((e) => e.id === eid)?.tipo ?? 'carico';
  const cambiaSerie = (ei: number, si: number, campo: 'kg' | 'rip', valore: string) =>
    setBozza({
      ...bozza,
      esercizi: bozza.esercizi.map((e, i) =>
        i !== ei ? e : { ...e, serie: e.serie.map((s, j) => (j === si ? { ...s, [campo]: valore } : s)) },
      ),
    });
  const togliSerie = (ei: number, si: number) =>
    setBozza({
      ...bozza,
      esercizi: bozza.esercizi.map((e, i) => (i !== ei ? e : { ...e, serie: e.serie.filter((_, j) => j !== si) })),
    });

  const salva = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bozza.data)) return setErrore('Scegli una data valida.');
    const eserciziNuovi = [];
    for (const e of bozza.esercizi) {
      const serie = [];
      for (const [j, s] of e.serie.entries()) {
        const kg = tipo(e.esercizioId) === 'corpo' ? 0 : leggiNumero(s.kg || '0');
        const rip = leggiNumero(s.rip);
        if (kg === null || kg > 999) return setErrore(`${e.nome}, serie ${j + 1}: kg non validi.`);
        if (rip === null || !Number.isInteger(rip) || rip < 1) {
          return setErrore(`${e.nome}, serie ${j + 1}: ripetizioni non valide.`);
        }
        serie.push({ kg, rip, riscaldamento: s.riscaldamento });
      }
      // Un esercizio rimasto senza serie viene tolto.
      if (serie.length) eserciziNuovi.push({ esercizioId: e.esercizioId, nome: e.nome, serie });
    }
    if (!eserciziNuovi.length) return setErrore('Serve almeno una serie. Per togliere tutto, elimina l’allenamento.');

    await db.sessioni.put({
      ...sessione,
      data: bozza.data,
      rpe: bozza.rpe,
      note: bozza.note.trim(),
      esercizi: eserciziNuovi,
      volumeKg: Math.round(eserciziNuovi.reduce((tot, e) => tot + volume(e.serie), 0)),
      // Modificato: andrà riesportato verso Notion.
      esportato: false,
    });
    onFine();
  };

  return (
    <>
      <h1 className="titolo-pagina">Modifica</h1>

      <label className="campo-etichettato">
        <span>Data</span>
        <input
          className="campo"
          type="date"
          value={bozza.data}
          onChange={(e) => setBozza({ ...bozza, data: e.target.value })}
        />
      </label>

      <ul className="elenco-esercizi">
        {bozza.esercizi.map((e, ei) => {
          const conKg = tipo(e.esercizioId) !== 'corpo';
          let n = 0;
          return (
            <li key={ei} className="riquadro esercizio">
              <div className="esercizio-testa">
                <h2>{e.nome}</h2>
              </div>
              <div className={`tabella-serie${conKg ? '' : ' senza-kg'}`}>
                {e.serie.map((s, si) => (
                  <div key={si} className="riga-serie">
                    <span className="numero-serie">{s.riscaldamento ? 'R' : ++n}</span>
                    {conKg && (
                      <input
                        className="campo"
                        inputMode="decimal"
                        aria-label={`Kg serie ${si + 1}`}
                        value={s.kg}
                        onChange={(ev) => cambiaSerie(ei, si, 'kg', ev.target.value)}
                      />
                    )}
                    <input
                      className="campo"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      aria-label={`Ripetizioni serie ${si + 1}`}
                      value={s.rip}
                      onChange={(ev) => cambiaSerie(ei, si, 'rip', ev.target.value)}
                    />
                    <button
                      type="button"
                      className="spunta"
                      aria-label={`Togli serie ${si + 1}`}
                      onClick={() => togliSerie(ei, si)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M7 7l10 10M17 7L7 17" />
                      </svg>
                    </button>
                  </div>
                ))}
                {e.serie.length === 0 && <p className="testo-tenue piccolo">Nessuna serie: verrà tolto.</p>}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="modulo spazio-sopra">
        <div className="campo-etichettato">
          <span>RPE</span>
          <div className="griglia-rpe">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={bozza.rpe === n}
                onClick={() => setBozza({ ...bozza, rpe: bozza.rpe === n ? null : n })}
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
            value={bozza.note}
            onChange={(e) => setBozza({ ...bozza, note: e.target.value })}
          />
        </label>
      </div>

      {errore && <p className="errore spazio-sopra">{errore}</p>}

      <div className="fila-pulsanti">
        <button type="button" className="pulsante" onClick={onFine}>
          Annulla
        </button>
        <button type="button" className="pulsante primario" onClick={salva}>
          Salva
        </button>
      </div>
    </>
  );
}

function Indietro() {
  return (
    <button type="button" className="pulsante-indietro" onClick={() => vai('allenati')}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 6l-6 6 6 6" />
      </svg>
      Allenati
    </button>
  );
}
