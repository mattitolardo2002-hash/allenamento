import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../dati/db';
import type { Scheda } from '../dati/tipi';
import { dataBreve } from '../logica/formato';
import { serieUltimaVolta, ultimeVolte } from '../logica/storico';
import { Finestra } from './Finestra';

/**
 * Anteprima di una scheda prima di iniziarla: per ogni esercizio cosa prevede
 * la scheda e cosa hai fatto l'ultima volta (in quale allenamento, quando,
 * con quali kg e ripetizioni). Così sai già quanto caricare.
 */
export function AnteprimaScheda({
  scheda,
  puoiIniziare,
  onInizia,
  onChiudi,
}: {
  scheda: Scheda | null;
  puoiIniziare: boolean;
  onInizia: (s: Scheda) => void;
  onChiudi: () => void;
}) {
  const esercizi = useLiveQuery(() => db.esercizi.toArray(), []);
  const sessioni = useLiveQuery(() => db.sessioni.toArray(), []);

  if (!esercizi || !sessioni) return null;
  const ultime = ultimeVolte(sessioni);

  return (
    <Finestra aperta={scheda !== null} titolo={scheda?.nome ?? ''} onChiudi={onChiudi}>
      {scheda && (
        <>
          <ol className="anteprima">
            {scheda.voci.map((v, i) => {
              const es = esercizi.find((e) => e.id === v.esercizioId);
              const alt = v.alternativaId ? esercizi.find((e) => e.id === v.alternativaId) : undefined;
              const ultima = ultime.get(v.esercizioId);
              return (
                <li key={i}>
                  <div className="anteprima-testa">
                    <strong>{es?.nome ?? '?'}</strong>
                    <span className="testo-tenue piccolo">
                      {v.serie}×{v.rip || '—'}
                    </span>
                  </div>
                  {alt && <span className="testo-tenue piccolo">oppure {alt.nome}</span>}
                  {ultima && es ? (
                    <span className="anteprima-ultima">
                      <b>{serieUltimaVolta(ultima, es.tipo)}</b>
                      <small className="testo-tenue">
                        {ultima.schedaNome} · {dataBreve(ultima.data)}
                      </small>
                    </span>
                  ) : (
                    <span className="testo-spento piccolo">Mai fatto finora</span>
                  )}
                </li>
              );
            })}
          </ol>
          {puoiIniziare && (
            <button type="button" className="pulsante primario largo grande" onClick={() => onInizia(scheda)}>
              Inizia {scheda.nome}
            </button>
          )}
        </>
      )}
    </Finestra>
  );
}
