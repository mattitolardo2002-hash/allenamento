import { useState } from 'react';
import { lunediDi, spostaData } from '../logica/settimana';
import { impostaSettimana, useObiettivi, type Obiettivi } from '../logica/obiettivi';
import { Finestra } from './Finestra';

/** "2–8 nov" (o "28 ott – 3 nov" a cavallo di due mesi). */
export function etichettaSettimana(lunedi: string): string {
  const [a, m, g] = lunedi.split('-').map(Number);
  const inizio = new Date(a, m - 1, g);
  const fine = new Date(a, m - 1, g + 6);
  const mese = (d: Date) => d.toLocaleDateString('it-IT', { month: 'short' });
  return inizio.getMonth() === fine.getMonth()
    ? `${inizio.getDate()}–${fine.getDate()} ${mese(fine)}`
    : `${inizio.getDate()} ${mese(inizio)} – ${fine.getDate()} ${mese(fine)}`;
}

/**
 * Obiettivi di una settimana precisa: si può mettere 0 ai pesi o al cardio
 * (settimana di pausa, vacanza, infortunio…) senza toccare quelli predefiniti.
 * Le modifiche si salvano subito.
 */
export function FinestraObiettiviSettimana({ aperta, onChiudi }: { aperta: boolean; onChiudi: () => void }) {
  const obiettivi = useObiettivi();
  const corrente = lunediDi(new Date());
  const [lunedi, setLunedi] = useState(corrente);

  if (!obiettivi) return null;
  const valori = obiettivi.di(lunedi);
  const personalizzata = obiettivi.eccezioni.has(lunedi);
  const cambia = (campo: keyof Obiettivi, n: number) => impostaSettimana(lunedi, { ...valori, [campo]: n });

  // Settimane personalizzate da oggi in poi, per vederle tutte insieme.
  const prossime = [...obiettivi.eccezioni.entries()]
    .filter(([l]) => l >= corrente)
    .sort(([x], [y]) => x.localeCompare(y));

  return (
    <Finestra aperta={aperta} titolo="Obiettivi della settimana" onChiudi={onChiudi}>
      <div className="naviga-periodo">
        <button
          type="button"
          className="pulsante-icona"
          aria-label="Settimana precedente"
          disabled={lunedi <= corrente}
          onClick={() => setLunedi(spostaData(lunedi, -7))}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <span>
          <strong>{etichettaSettimana(lunedi)}</strong>
          <small className="testo-tenue">
            {lunedi === corrente ? 'questa settimana' : lunedi === spostaData(corrente, 7) ? 'la prossima' : ' '}
          </small>
        </span>
        <button
          type="button"
          className="pulsante-icona"
          aria-label="Settimana successiva"
          onClick={() => setLunedi(spostaData(lunedi, 7))}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      <div className="elenco-obiettivi">
        {(
          [
            ['pesi', 'Allenamenti con i pesi'],
            ['cardio', 'Sedute di cardio'],
          ] as const
        ).map(([campo, etichetta]) => (
          <div key={campo} className="obiettivo">
            <span>
              {etichetta}
              <small className="testo-tenue">
                {valori[campo] === 0 ? 'Settimana di pausa' : `Predefinito: ${obiettivi.predefiniti[campo]}`}
              </small>
            </span>
            <div className="contatore">
              <button
                type="button"
                aria-label="Uno in meno"
                disabled={valori[campo] <= 0}
                onClick={() => cambia(campo, valori[campo] - 1)}
              >
                −
              </button>
              <output>{valori[campo]}</output>
              <button
                type="button"
                aria-label="Uno in più"
                disabled={valori[campo] >= 7}
                onClick={() => cambia(campo, valori[campo] + 1)}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="testo-tenue piccolo">
        Metti 0 per una settimana di pausa: quell’anello sparisce dalla home e la serie di settimane di fila
        non si interrompe. Gli obiettivi predefiniti si cambiano in Altro.
      </p>
      {personalizzata && (
        <button type="button" className="pulsante largo" onClick={() => impostaSettimana(lunedi, null)}>
          Torna ai predefiniti per questa settimana
        </button>
      )}

      {prossime.length > 0 && (
        <>
          <h3 className="titolo-sezione">Settimane personalizzate</h3>
          <ul className="elenco-scelta">
            {prossime.map(([l, o]) => (
              <li key={l}>
                <button type="button" className="voce-scelta" onClick={() => setLunedi(l)}>
                  <span>{etichettaSettimana(l)}</span>
                  <span className="testo-tenue piccolo">
                    Pesi {o.pesi === 0 ? 'pausa' : o.pesi} · Cardio {o.cardio === 0 ? 'pausa' : o.cardio}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Finestra>
  );
}
