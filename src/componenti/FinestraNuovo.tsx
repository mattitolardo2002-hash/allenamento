import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { IconChevronRight, IconPencilPlus, IconScale } from '@tabler/icons-react';
import { db } from '../dati/db';
import type { Scheda, TipoCardio } from '../dati/tipi';
import { iniziaAllenamento } from '../dati/allenamento';
import { prossimaScheda, quandoFa, ultimaDellaScheda, ultimaFatta } from '../logica/rotazione';
import { vai } from '../navigazione';
import { Finestra } from './Finestra';
import { AnteprimaScheda } from './AnteprimaScheda';
import { FinestraCardio, NOMI_CARDIO, riassuntoCardio } from './ModuloCardio';
import { ICONE_CARDIO, IconaNumero, IconaTinta, nomeGruppo } from './Icone';

/** Fa partire un allenamento (con una scheda, o libero) e apre la schermata in palestra. */
export async function inizia(scheda: Scheda | null) {
  await iniziaAllenamento(scheda);
  vai('allenati', 'in-corso');
}

/**
 * "Cosa fai oggi?": tutte le schede (prima la prossima della rotazione,
 * poi le altre nell'ordine in cui arriverebbero), l'allenamento libero e,
 * dal "+", anche cardio e pesata.
 * Toccando una scheda si apre la sua anteprima con i kg dell'ultima volta
 * e il pulsante per iniziarla.
 */
export function FinestraNuovo({
  aperta,
  soloPesi = false,
  onChiudi,
}: {
  aperta: boolean;
  /** Vero da "Scegli un altro": mostra solo gli allenamenti con i pesi. */
  soloPesi?: boolean;
  onChiudi: () => void;
}) {
  const schede = useLiveQuery(() => db.schede.orderBy('ordine').toArray(), []);
  const sessioni = useLiveQuery(() => db.sessioni.toArray(), []);
  const esercizi = useLiveQuery(() => db.esercizi.toArray(), []);
  const cardio = useLiveQuery(() => db.cardio.toArray(), []);
  const [anteprima, setAnteprima] = useState<Scheda | null>(null);
  const [nuovoCardio, setNuovoCardio] = useState<{ tipo: TipoCardio } | null>(null);

  if (!schede || !sessioni || !esercizi || !cardio) return null;

  const prossima = prossimaScheda(schede, sessioni);
  const ultima = ultimaFatta(schede, sessioni);
  // Ordine di rotazione a partire dalla prossima: 2, 3, 4, 1…
  const inizio = prossima ? schede.indexOf(prossima) : 0;
  const inOrdine = schede.map((_, i) => schede[(inizio + i) % schede.length]);

  // Muscoli principali di una scheda, es. "Petto, Dorso, Braccia".
  const muscoli = (s: Scheda) => {
    const nomi = s.voci.map((v) => nomeGruppo(esercizi.find((e) => e.id === v.esercizioId)?.nome ?? ''));
    return [...new Set(nomi)].filter((n) => n !== 'Altro').slice(0, 3).join(', ');
  };

  const apriAnteprima = (s: Scheda) => {
    onChiudi();
    setAnteprima(s);
  };

  return (
    <>
      <Finestra aperta={aperta} titolo="Cosa fai oggi?" onChiudi={onChiudi}>
        <ul className="elenco-righe">
          {inOrdine.map((s) => {
            const fatta = ultimaDellaScheda(s.id, sessioni);
            const eProssima = s === prossima;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  className={`riga-azione${eProssima ? ' evidenza' : ''}`}
                  onClick={() => apriAnteprima(s)}
                >
                  <IconaNumero
                    n={schede.indexOf(s) + 1}
                    tono={eProssima ? 'blu' : s.id === ultima?.schedaId ? 'verde' : 'grigio'}
                  />
                  <span className="riga-azione-testo">
                    <strong>
                      {s.nome}
                      {eProssima && <span className="pastiglia blu">prossimo</span>}
                    </strong>
                    <small>
                      {[muscoli(s) || `${s.voci.length} esercizi`, fatta ? quandoFa(fatta.data) : 'mai fatto'].join(' · ')}
                    </small>
                  </span>
                  <IconChevronRight size={18} aria-hidden="true" />
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              className="riga-azione"
              onClick={() => {
                onChiudi();
                inizia(null);
              }}
            >
              <IconaTinta icona={IconPencilPlus} colore="#e9b44c" />
              <span className="riga-azione-testo">
                <strong>Allenamento libero</strong>
                <small>Senza scheda: scegli gli esercizi al momento</small>
              </span>
              <IconChevronRight size={18} aria-hidden="true" />
            </button>
          </li>
        </ul>
        <p className="nota-finestra">La rotazione riparte da quello che fai oggi.</p>

        {!soloPesi && (
          <>
            <h3 className="titolo-sezione">Cardio e peso</h3>
            <ul className="elenco-righe">
              {(['cyclette', 'corsa'] as const).map((t) => {
                const ultimaC = cardio.filter((c) => c.tipo === t).sort((x, y) => y.data.localeCompare(x.data))[0];
                return (
                  <li key={t}>
                    <button
                      type="button"
                      className="riga-azione"
                      onClick={() => {
                        onChiudi();
                        setNuovoCardio({ tipo: t });
                      }}
                    >
                      <IconaTinta icona={ICONE_CARDIO[t].icona} colore={ICONE_CARDIO[t].colore} />
                      <span className="riga-azione-testo">
                        <strong>{NOMI_CARDIO[t]}</strong>
                        <small>
                          {ultimaC
                            ? `Ultima ${quandoFa(ultimaC.data)} · ${riassuntoCardio(ultimaC)}`
                            : t === 'corsa'
                              ? 'Km, passo e battito'
                              : 'Tempo e battito medio'}
                        </small>
                      </span>
                      <IconChevronRight size={18} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  className="riga-azione"
                  onClick={() => {
                    onChiudi();
                    vai('peso');
                  }}
                >
                  <IconaTinta icona={IconScale} colore="#a884f7" />
                  <span className="riga-azione-testo">
                    <strong>Pesata</strong>
                    <small>Segna il peso di oggi</small>
                  </span>
                  <IconChevronRight size={18} aria-hidden="true" />
                </button>
              </li>
            </ul>
          </>
        )}
      </Finestra>

      <AnteprimaScheda
        scheda={anteprima}
        puoiIniziare
        onChiudi={() => setAnteprima(null)}
        onInizia={(s) => {
          setAnteprima(null);
          inizia(s);
        }}
      />
      <FinestraCardio attivita={nuovoCardio} onChiudi={() => setNuovoCardio(null)} />
    </>
  );
}
