import { useLiveQuery } from 'dexie-react-hooks';
import { db, nuovoId } from '../dati/db';
import type { Scheda } from '../dati/tipi';
import { vai } from '../navigazione';
import { EditorScheda } from './EditorScheda';

// Sezione Schede: elenco delle schede oppure, se ne è aperta una, il suo editor.
export function Schede({ dettaglio }: { dettaglio: string | null }) {
  if (dettaglio) return <EditorScheda id={dettaglio} />;
  return <ElencoSchede />;
}

function ElencoSchede() {
  const schede = useLiveQuery(() => db.schede.orderBy('ordine').toArray(), []);
  const esercizi = useLiveQuery(() => db.esercizi.toArray(), []);

  // Finché il database non ha risposto non mostriamo nulla (dura pochi millisecondi).
  if (!schede || !esercizi) return null;

  const nomeEsercizio = (id: string) => esercizi.find((e) => e.id === id)?.nome ?? '?';

  // Scambia di posto due schede vicine e rinumera l'ordine da 0.
  const sposta = async (indice: number, verso: -1 | 1) => {
    const nuove = [...schede];
    const altro = indice + verso;
    if (altro < 0 || altro >= nuove.length) return;
    [nuove[indice], nuove[altro]] = [nuove[altro], nuove[indice]];
    await db.schede.bulkPut(nuove.map((s, i) => ({ ...s, ordine: i })));
  };

  const nuovaScheda = async () => {
    const scheda: Scheda = {
      id: nuovoId(),
      nome: `Allenamento ${schede.length + 1}`,
      ordine: schede.length,
      voci: [],
    };
    await db.schede.add(scheda);
    vai('schede', scheda.id);
  };

  return (
    <>
      <h1 className="titolo-pagina">Schede</h1>

      {schede.length === 0 && (
        <section className="riquadro vuoto">
          <p>Nessuna scheda. Creane una per iniziare.</p>
        </section>
      )}

      <ul className="elenco-schede">
        {schede.map((s, i) => (
          <li key={s.id} className="riquadro scheda">
            <button type="button" className="scheda-apri" onClick={() => vai('schede', s.id)}>
              <span className="scheda-nome">{s.nome}</span>
              <span className="testo-tenue piccolo">
                {s.voci.length === 1 ? '1 esercizio' : `${s.voci.length} esercizi`}
              </span>
              <span className="scheda-riassunto">{s.voci.map((v) => nomeEsercizio(v.esercizioId)).join(' · ')}</span>
            </button>
            <div className="scheda-ordine">
              <button
                type="button"
                className="pulsante-icona"
                aria-label={`Sposta ${s.nome} su`}
                disabled={i === 0}
                onClick={() => sposta(i, -1)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 15l6-6 6 6" />
                </svg>
              </button>
              <button
                type="button"
                className="pulsante-icona"
                aria-label={`Sposta ${s.nome} giù`}
                disabled={i === schede.length - 1}
                onClick={() => sposta(i, 1)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button type="button" className="pulsante largo" onClick={nuovaScheda}>
        + Nuova scheda
      </button>
      <p className="testo-tenue piccolo centrato">
        L’ordine conta: dopo un allenamento l’app ti propone la scheda successiva.
      </p>
    </>
  );
}
