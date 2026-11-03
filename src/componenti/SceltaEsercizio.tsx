import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, nuovoId } from '../dati/db';
import type { Esercizio, TipoEsercizio } from '../dati/tipi';
import { Finestra } from './Finestra';

export const NOMI_TIPO: Record<TipoEsercizio, string> = {
  carico: 'Con carico',
  corpo: 'Corpo libero',
  zavorra: 'Zavorrabile',
};

// Confronto senza maiuscole né accenti: "Alzate" trova anche "alzàte".
export const semplifica = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/**
 * Finestra per scegliere un esercizio dall'anagrafica, crearne uno nuovo
 * o modificarne nome e tipo (la modifica vale ovunque, storico compreso).
 */
export function SceltaEsercizio({
  aperta,
  titolo,
  onScegli,
  onChiudi,
}: {
  aperta: boolean;
  titolo: string;
  onScegli: (esercizioId: string) => void;
  onChiudi: () => void;
}) {
  const esercizi = useLiveQuery(() => db.esercizi.toArray(), []) ?? [];
  const [cerca, setCerca] = useState('');
  // Esercizio in modifica, oppure 'nuovo' per crearne uno.
  const [inModifica, setInModifica] = useState<Esercizio | 'nuovo' | null>(null);

  // Ogni volta che si riapre, si riparte da zero.
  useEffect(() => {
    if (aperta) {
      setCerca('');
      setInModifica(null);
    }
  }, [aperta]);

  const filtro = semplifica(cerca);
  const elenco = esercizi
    .filter((e) => semplifica(e.nome).includes(filtro))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
  const esiste = esercizi.some((e) => semplifica(e.nome) === filtro);

  if (inModifica) {
    return (
      <Finestra
        aperta={aperta}
        titolo={inModifica === 'nuovo' ? 'Nuovo esercizio' : 'Modifica esercizio'}
        onChiudi={onChiudi}
      >
        <ModuloEsercizio
          iniziale={inModifica === 'nuovo' ? { id: '', nome: cerca.trim(), tipo: 'carico', perLato: false } : inModifica}
          nomiEsistenti={esercizi.filter((e) => e !== inModifica).map((e) => semplifica(e.nome))}
          onAnnulla={() => setInModifica(null)}
          onSalva={async (es) => {
            if (inModifica === 'nuovo') {
              const id = nuovoId();
              await db.esercizi.add({ ...es, id });
              onScegli(id);
            } else {
              await db.esercizi.put(es);
              setInModifica(null);
            }
          }}
        />
      </Finestra>
    );
  }

  return (
    <Finestra aperta={aperta} titolo={titolo} onChiudi={onChiudi}>
      <input
        className="campo"
        type="search"
        placeholder="Cerca o scrivi un nuovo esercizio"
        value={cerca}
        onChange={(e) => setCerca(e.target.value)}
        autoComplete="off"
      />
      <ul className="elenco-scelta">
        {cerca.trim() && !esiste && (
          <li>
            <button type="button" className="voce-scelta crea" onClick={() => setInModifica('nuovo')}>
              <span>Crea «{cerca.trim()}»</span>
            </button>
          </li>
        )}
        {elenco.map((e) => (
          <li key={e.id}>
            <button type="button" className="voce-scelta" onClick={() => onScegli(e.id)}>
              <span>{e.nome}</span>
              <span className="testo-tenue piccolo">{NOMI_TIPO[e.tipo]}</span>
            </button>
            <button
              type="button"
              className="pulsante-icona"
              aria-label={`Modifica ${e.nome}`}
              onClick={() => setInModifica(e)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </Finestra>
  );
}

/** Modulo con nome, tipo e "per lato" di un esercizio. */
export function ModuloEsercizio({
  iniziale,
  nomiEsistenti,
  onSalva,
  onAnnulla,
}: {
  iniziale: Esercizio;
  nomiEsistenti: string[];
  onSalva: (e: Esercizio) => void;
  onAnnulla: () => void;
}) {
  const [es, setEs] = useState(iniziale);
  const [errore, setErrore] = useState('');

  const salva = () => {
    const nome = es.nome.trim();
    if (!nome) return setErrore('Scrivi il nome dell’esercizio.');
    if (nomiEsistenti.includes(semplifica(nome))) return setErrore('Esiste già un esercizio con questo nome.');
    onSalva({ ...es, nome, perLato: es.tipo === 'carico' && es.perLato });
  };

  return (
    <div className="modulo">
      <label className="campo-etichettato">
        <span>Nome</span>
        <input className="campo" value={es.nome} onChange={(e) => setEs({ ...es, nome: e.target.value })} />
      </label>

      <div className="campo-etichettato">
        <span>Come si misura</span>
        <div className="segmenti" role="radiogroup">
          {(Object.keys(NOMI_TIPO) as TipoEsercizio[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={es.tipo === t}
              onClick={() => setEs({ ...es, tipo: t })}
            >
              {NOMI_TIPO[t]}
            </button>
          ))}
        </div>
        <p className="testo-tenue piccolo">
          {es.tipo === 'carico' && 'Segni kg e ripetizioni. Progressi con il 1RM stimato.'}
          {es.tipo === 'corpo' && 'Segni solo le ripetizioni.'}
          {es.tipo === 'zavorra' &&
            'Segni i kg di zavorra (vuoto = senza). Progressi: 1RM della sola zavorra, oppure ripetizioni.'}
        </p>
      </div>

      {es.tipo === 'carico' && (
        <label className="interruttore">
          <input
            type="checkbox"
            checked={es.perLato}
            onChange={(e) => setEs({ ...es, perLato: e.target.checked })}
          />
          <span>
            Per lato
            <small className="testo-tenue">Manubri o monogamba: kg di un lato e ripetizioni per lato</small>
          </span>
        </label>
      )}

      {errore && <p className="errore">{errore}</p>}

      <div className="fila-pulsanti">
        <button type="button" className="pulsante" onClick={onAnnulla}>
          Indietro
        </button>
        <button type="button" className="pulsante primario" onClick={salva}>
          Salva
        </button>
      </div>
    </div>
  );
}
