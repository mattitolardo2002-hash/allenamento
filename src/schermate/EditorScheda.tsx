import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../dati/db';
import type { Scheda, VoceScheda } from '../dati/tipi';
import { vai } from '../navigazione';
import { Conferma } from '../componenti/Finestra';
import { NOMI_TIPO, SceltaEsercizio } from '../componenti/SceltaEsercizio';

// Cosa si sta scegliendo nella finestra degli esercizi.
type Scelta =
  | { tipo: 'aggiungi' }
  | { tipo: 'sostituisci'; indice: number }
  | { tipo: 'alternativa'; indice: number };

/**
 * Modifica di una scheda. Ogni cambiamento viene salvato subito:
 * non esiste un pulsante "Salva" da dimenticare.
 */
export function EditorScheda({ id }: { id: string }) {
  // La scheda viene letta una volta e poi tenuta qui: così mentre scrivi
  // il campo non "salta" in attesa del database.
  const [scheda, setScheda] = useState<Scheda | null | undefined>(undefined);
  const esercizi = useLiveQuery(() => db.esercizi.toArray(), []);
  const [scelta, setScelta] = useState<Scelta | null>(null);
  const [eliminare, setEliminare] = useState(false);

  useEffect(() => {
    db.schede.get(id).then((s) => setScheda(s ?? null));
  }, [id]);

  if (scheda === undefined || !esercizi) return null;
  if (scheda === null) {
    return (
      <>
        <Indietro />
        <section className="riquadro vuoto">
          <p>Questa scheda non esiste più.</p>
        </section>
      </>
    );
  }

  const esercizio = (eid?: string) => esercizi.find((e) => e.id === eid);

  const salva = (nuova: Scheda) => {
    setScheda(nuova);
    db.schede.put(nuova);
  };
  const cambiaVoce = (indice: number, modifica: Partial<VoceScheda>) =>
    salva({ ...scheda, voci: scheda.voci.map((v, i) => (i === indice ? { ...v, ...modifica } : v)) });
  const togliVoce = (indice: number) => salva({ ...scheda, voci: scheda.voci.filter((_, i) => i !== indice) });
  const spostaVoce = (indice: number, verso: -1 | 1) => {
    const voci = [...scheda.voci];
    [voci[indice], voci[indice + verso]] = [voci[indice + verso], voci[indice]];
    salva({ ...scheda, voci });
  };

  const scegli = (esercizioId: string) => {
    if (!scelta) return;
    if (scelta.tipo === 'aggiungi') {
      salva({ ...scheda, voci: [...scheda.voci, { esercizioId, serie: 3, rip: '6' }] });
    } else if (scelta.tipo === 'sostituisci') {
      cambiaVoce(scelta.indice, { esercizioId });
    } else {
      cambiaVoce(scelta.indice, { alternativaId: esercizioId });
    }
    setScelta(null);
  };

  return (
    <>
      <Indietro />

      <input
        className="campo titolo-campo"
        value={scheda.nome}
        onChange={(e) => salva({ ...scheda, nome: e.target.value })}
        onBlur={() => !scheda.nome.trim() && salva({ ...scheda, nome: 'Senza nome' })}
        aria-label="Nome della scheda"
      />
      <p className="testo-tenue piccolo">Le modifiche si salvano da sole. Ogni allenamento inizia con il riscaldamento.</p>

      <ol className="elenco-voci">
        {scheda.voci.map((v, i) => {
          const es = esercizio(v.esercizioId);
          const alt = esercizio(v.alternativaId);
          return (
            <li key={i} className="riquadro voce">
              <div className="voce-testa">
                <span className="voce-numero">{i + 1}</span>
                <button
                  type="button"
                  className="voce-nome"
                  onClick={() => setScelta({ tipo: 'sostituisci', indice: i })}
                >
                  {es?.nome ?? 'Esercizio eliminato'}
                  <span className="testo-tenue piccolo">
                    {es && NOMI_TIPO[es.tipo]}
                    {es?.perLato && ' · per lato'}
                  </span>
                </button>
              </div>

              {alt ? (
                <div className="voce-alternativa">
                  <span>
                    <span className="testo-tenue">oppure </span>
                    {alt.nome}
                  </span>
                  <button
                    type="button"
                    className="pulsante-testo"
                    onClick={() => cambiaVoce(i, { alternativaId: undefined })}
                  >
                    Togli
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="pulsante-testo"
                  onClick={() => setScelta({ tipo: 'alternativa', indice: i })}
                >
                  + Alternativa
                </button>
              )}

              <div className="voce-campi">
                <div className="campo-etichettato">
                  <span>Serie</span>
                  <div className="contatore">
                    <button
                      type="button"
                      aria-label="Una serie in meno"
                      disabled={v.serie <= 1}
                      onClick={() => cambiaVoce(i, { serie: v.serie - 1 })}
                    >
                      −
                    </button>
                    <output>{v.serie}</output>
                    <button
                      type="button"
                      aria-label="Una serie in più"
                      disabled={v.serie >= 20}
                      onClick={() => cambiaVoce(i, { serie: v.serie + 1 })}
                    >
                      +
                    </button>
                  </div>
                </div>
                <label className="campo-etichettato">
                  <span>Ripetizioni</span>
                  <input
                    className="campo"
                    value={v.rip}
                    placeholder="es. 6-8"
                    onChange={(e) => cambiaVoce(i, { rip: e.target.value })}
                  />
                </label>
              </div>

              <input
                className="campo"
                value={v.nota ?? ''}
                placeholder="Nota (facoltativa)"
                onChange={(e) => cambiaVoce(i, { nota: e.target.value || undefined })}
              />

              <div className="voce-azioni">
                <button
                  type="button"
                  className="pulsante-icona"
                  aria-label="Sposta su"
                  disabled={i === 0}
                  onClick={() => spostaVoce(i, -1)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 15l6-6 6 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="pulsante-icona"
                  aria-label="Sposta giù"
                  disabled={i === scheda.voci.length - 1}
                  onClick={() => spostaVoce(i, 1)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                <button type="button" className="pulsante-testo pericolo" onClick={() => togliVoce(i)}>
                  Rimuovi
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <button type="button" className="pulsante largo" onClick={() => setScelta({ tipo: 'aggiungi' })}>
        + Aggiungi esercizio
      </button>
      <button type="button" className="pulsante largo pericolo-tenue" onClick={() => setEliminare(true)}>
        Elimina scheda
      </button>

      <SceltaEsercizio
        aperta={scelta !== null}
        titolo={
          scelta?.tipo === 'sostituisci'
            ? 'Sostituisci esercizio'
            : scelta?.tipo === 'alternativa'
              ? 'Scegli l’alternativa'
              : 'Aggiungi esercizio'
        }
        onScegli={scegli}
        onChiudi={() => setScelta(null)}
      />

      <Conferma
        aperta={eliminare}
        titolo="Eliminare la scheda?"
        testo={`«${scheda.nome}» verrà eliminata. Gli allenamenti già registrati restano nello storico.`}
        etichetta="Elimina"
        onAnnulla={() => setEliminare(false)}
        onConferma={async () => {
          await db.schede.delete(scheda.id);
          vai('schede');
        }}
      />
    </>
  );
}

function Indietro() {
  return (
    <button type="button" className="pulsante-indietro" onClick={() => vai('schede')}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 6l-6 6 6 6" />
      </svg>
      Schede
    </button>
  );
}
