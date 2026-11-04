import { useLiveQuery } from 'dexie-react-hooks';
import { IconArrowRight, IconCircleCheck, IconStar, IconTrophy } from '@tabler/icons-react';
import { db } from '../dati/db';
import type { Esercizio, Sessione } from '../dati/tipi';
import { dataLunga, numero } from '../logica/formato';
import { eRecord, miglioriPerEsercizio } from '../logica/record';
import { epley } from '../logica/progressi';
import { prossimaScheda } from '../logica/rotazione';
import { serieInBreve } from '../logica/storico';
import { vai } from '../navigazione';
import { IconaEsercizio, IconaTinta } from '../componenti/Icone';
import { PREFISSO_SESSIONE } from './Allenati';
import { segnaRitorno } from './Calendario';

const serieDiLavoro = (s: Sessione) =>
  s.esercizi.reduce((t, e) => t + e.serie.filter((x) => !x.riscaldamento).length, 0);

/** 8420 → { valore: "8,4", unita: "t" }; 640 → { valore: "640", unita: "kg" }. */
function pesoTotale(kg: number) {
  return kg >= 1000
    ? { valore: numero(Math.round(kg / 100) / 10), unita: 't' }
    : { valore: numero(Math.round(kg)), unita: 'kg' };
}

/**
 * Riepilogo che compare appena salvato un allenamento: i numeri della
 * seduta, i record battuti e il confronto con l'ultima volta che hai
 * fatto la stessa scheda.
 */
export function Riepilogo({ id }: { id: string }) {
  const sessione = useLiveQuery(() => db.sessioni.get(id).then((s) => s ?? null), [id]);
  const tutte = useLiveQuery(() => db.sessioni.toArray(), []);
  const schede = useLiveQuery(() => db.schede.orderBy('ordine').toArray(), []);
  const esercizi = useLiveQuery(() => db.esercizi.toArray(), []);

  if (sessione === undefined || !tutte || !schede || !esercizi) return null;
  if (sessione === null) {
    return (
      <>
        <section className="riquadro vuoto">
          <p>Questo allenamento non esiste più.</p>
        </section>
        <button type="button" className="pulsante largo" onClick={() => vai('allenati')}>
          Torna ad Allenati
        </button>
      </>
    );
  }

  const prima = tutte.filter((s) => s.fine < sessione.fine);
  const migliori = miglioriPerEsercizio(prima);
  const tipo = (eid: string): Esercizio['tipo'] => esercizi.find((e) => e.id === eid)?.tipo ?? 'carico';

  // Record di oggi: per ogni esercizio la serie migliore tra quelle da record.
  const record = sessione.esercizi.flatMap((e) => {
    const battute = e.serie.filter((x) => !x.riscaldamento && eRecord(x, migliori.get(e.esercizioId)));
    if (!battute.length) return [];
    const top = battute.reduce((a, b) => (b.kg > 0 ? epley(b.kg, b.rip) > epley(a.kg, a.rip) : b.rip > a.rip) ? b : a);
    return [{ nome: e.nome, serie: serieInBreve(top, tipo(e.esercizioId)), kg: top.kg > 0 }];
  });

  // L'ultima volta con la stessa scheda, per il confronto.
  const precedente = sessione.schedaId
    ? prima.filter((s) => s.schedaId === sessione.schedaId).sort((a, b) => b.fine.localeCompare(a.fine))[0]
    : undefined;
  const prossima = prossimaScheda(schede, tutte);
  const volume = pesoTotale(sessione.volumeKg);

  return (
    <>
      <div className="fine-testa">
        {record.length ? (
          <IconaTinta icona={IconTrophy} colore="#e9b44c" misura={64} />
        ) : (
          <IconaTinta icona={IconCircleCheck} colore="#3ccf91" misura={64} />
        )}
        <h1>{record.length ? 'Nuovi record!' : 'Allenamento finito'}</h1>
        <p className="testo-tenue piccolo">
          {sessione.schedaNome} · {dataLunga(sessione.data).replace(/ \d{4}$/, '')}
        </p>
      </div>

      <section className="riquadro riquadro-eroe">
        <dl className="tre-cifre">
          <div>
            <dt>Durata</dt>
            <dd>
              {sessione.durataMin}
              <small>min</small>
            </dd>
          </div>
          <div>
            <dt>Serie</dt>
            <dd>{serieDiLavoro(sessione)}</dd>
          </div>
          <div>
            <dt>Volume</dt>
            <dd>
              {volume.valore}
              <small>{volume.unita}</small>
            </dd>
          </div>
        </dl>
      </section>

      {record.length > 0 && (
        <section className="riquadro">
          <span className="etichetta-sopra">Record battuti</span>
          <ul className="elenco-record-oggi">
            {record.map((r) => (
              <li key={r.nome}>
                <IconaEsercizio nome={r.nome} misura={34} />
                <span>{r.nome}</span>
                <b>
                  {r.serie}
                  {r.kg ? '' : ' rip'}
                </b>
                <IconStar size={16} color="#e9b44c" aria-hidden="true" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {precedente && (
        <section className="riquadro">
          <span className="etichetta-sopra">Rispetto all’ultima volta</span>
          <div className="confronto">
            {sessione.volumeKg > 0 && precedente.volumeKg > 0 && (
              <Confronto
                nome="Volume"
                oggi={sessione.volumeKg}
                prima={precedente.volumeKg}
                testo={(n) => `${pesoTotale(n).valore} ${pesoTotale(n).unita}`}
              />
            )}
            <Confronto nome="Serie" oggi={serieDiLavoro(sessione)} prima={serieDiLavoro(precedente)} testo={String} />
            <Confronto
              nome="Durata"
              oggi={sessione.durataMin}
              prima={precedente.durataMin}
              testo={(n) => `${n} min`}
              neutro
            />
          </div>
        </section>
      )}

      {prossima && (
        <p className="prossima-volta">
          Prossima volta: <strong style={{ color: 'var(--testo)' }}>{prossima.nome}</strong>
          <IconArrowRight size={15} aria-hidden="true" />
        </p>
      )}

      <div className="fila-pulsanti">
        <button
          type="button"
          className="pulsante vetro grande"
          onClick={() => {
            segnaRitorno(false);
            vai('allenati', PREFISSO_SESSIONE + sessione.id);
          }}
        >
          Dettagli
        </button>
        <button type="button" className="pulsante primario grande" onClick={() => vai('allenati')}>
          Fatto
        </button>
      </div>
    </>
  );
}

/** Una riga del confronto: oggi (barra blu) e l'ultima volta (barra grigia), con la differenza. */
function Confronto({
  nome,
  oggi,
  prima,
  testo,
  neutro = false,
}: {
  nome: string;
  oggi: number;
  prima: number;
  testo: (n: number) => string;
  /** Vero se di più non è per forza meglio (es. la durata). */
  neutro?: boolean;
}) {
  const massimo = Math.max(oggi, prima, 1);
  const diff = prima ? Math.round(((oggi - prima) / prima) * 100) : 0;
  const classe = neutro || diff === 0 ? '' : diff > 0 ? ' positiva' : ' negativa';
  return (
    <div className="confronto-riga">
      <div>
        <span>{nome}</span>
        <span className={`pastiglia${classe}`}>
          {diff === 0 ? 'uguale' : `${diff > 0 ? '+' : ''}${diff}%`}
        </span>
      </div>
      <div className="barre-confronto" aria-label={`Oggi ${testo(oggi)}, l’ultima volta ${testo(prima)}`}>
        <span>
          <i style={{ width: `${(oggi / massimo) * 100}%` }} />
        </span>
        <span>
          <i style={{ width: `${(prima / massimo) * 100}%` }} />
        </span>
      </div>
      <div className="testo-tenue piccolo" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Oggi {testo(oggi)}</span>
        <span>Ultima volta {testo(prima)}</span>
      </div>
    </div>
  );
}
