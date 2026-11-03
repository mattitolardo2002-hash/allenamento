import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../dati/db';
import type { Pesata } from '../dati/tipi';
import { dataBreve, dataConGiorno, dataLocale, leggiNumero, numero } from '../logica/formato';
import { mediaMobile, numeroGiorno, statistichePeso } from '../logica/peso';
import { Grafico } from '../componenti/Grafico';
import { Conferma } from '../componenti/Finestra';

// Periodi del grafico: giorni da mostrare (null = tutto lo storico).
const PERIODI = [
  { etichetta: '30 gg', giorni: 30 },
  { etichetta: '90 gg', giorni: 90 },
  { etichetta: '1 anno', giorni: 365 },
  { etichetta: 'Tutto', giorni: null },
] as const;

const PAGINA = 15;

export function Peso() {
  const pesate = useLiveQuery(() => db.pesate.orderBy('data').toArray(), []);
  const [periodo, setPeriodo] = useState<number | null>(90);
  const [daEliminare, setDaEliminare] = useState<Pesata | null>(null);
  const [mostrate, setMostrate] = useState(PAGINA);

  if (!pesate) return null;

  const stat = statistichePeso(pesate);
  // La media si calcola su tutto lo storico e poi si ritaglia il periodo,
  // così anche il primo giorno visibile ha la sua media corretta.
  const medie = mediaMobile(pesate);
  const da = periodo === null ? -Infinity : numeroGiorno(dataLocale()) - periodo;
  const visibili = pesate.filter((p) => numeroGiorno(p.data) > da);
  const medieVisibili = medie.filter((m) => numeroGiorno(m.data) > da);

  return (
    <>
      <h1 className="titolo-pagina">Peso</h1>

      {stat && (
        <section className="riquadro peso-cima">
          <span className="etichetta-sopra">Media 7 giorni</span>
          <span className="cifra-display enorme">
            {numero(Math.round(stat.media * 10) / 10)}
            <small> kg</small>
          </span>
          <span className="variazione">
            {stat.variazione === null
              ? 'Variazione: servono almeno 8 giorni di pesate'
              : `${stat.variazione > 0.05 ? '▲' : stat.variazione < -0.05 ? '▼' : '='} ${numero(Math.abs(Math.round(stat.variazione * 10) / 10))} kg in 7 giorni`}
          </span>
          <span className="testo-tenue piccolo">
            Ultima pesata: {numero(stat.ultima.kg)} kg · {dataBreve(stat.ultima.data)}
          </span>
        </section>
      )}

      <NuovaPesata pesate={pesate} />

      {pesate.length > 0 && (
        <>
          <div className="segmenti filtro-periodo" role="radiogroup" aria-label="Periodo del grafico">
            {PERIODI.map((p) => (
              <button
                key={p.etichetta}
                type="button"
                role="radio"
                aria-checked={periodo === p.giorni}
                onClick={() => setPeriodo(p.giorni)}
              >
                {p.etichetta}
              </button>
            ))}
          </div>
          <section className="riquadro">
            {visibili.length ? (
              <Grafico
                punti={visibili.map((p) => ({ data: p.data, valore: p.kg }))}
                linea={medieVisibili.map((m) => ({ data: m.data, valore: m.media }))}
                nomePunti="Pesata"
                nomeLinea="Media 7 gg"
                unita="kg"
                area
              />
            ) : (
              <p className="testo-tenue">Nessuna pesata in questo periodo.</p>
            )}
          </section>
        </>
      )}

      <h2 className="titolo-sezione">Storico</h2>
      {pesate.length === 0 ? (
        <section className="riquadro vuoto">
          <p>Ancora nessuna pesata. Inserisci la prima qui sopra.</p>
        </section>
      ) : (
        <ul className="riquadro elenco-pesate">
          {[...pesate]
            .reverse()
            .slice(0, mostrate)
            .map((p) => (
              <li key={p.data}>
                <span className="testo-tenue">{dataConGiorno(p.data)}</span>
                <strong>{numero(p.kg)} kg</strong>
                <button
                  type="button"
                  className="pulsante-icona"
                  aria-label={`Elimina la pesata del ${dataBreve(p.data)}`}
                  onClick={() => setDaEliminare(p)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 7l10 10M17 7L7 17" />
                  </svg>
                </button>
              </li>
            ))}
        </ul>
      )}
      {pesate.length > mostrate && (
        <button type="button" className="pulsante largo" onClick={() => setMostrate(mostrate + PAGINA)}>
          Mostra altre
        </button>
      )}

      <Conferma
        aperta={daEliminare !== null}
        titolo="Eliminare la pesata?"
        testo={daEliminare ? `${numero(daEliminare.kg)} kg del ${dataConGiorno(daEliminare.data)}.` : ''}
        etichetta="Elimina"
        onAnnulla={() => setDaEliminare(null)}
        onConferma={async () => {
          if (daEliminare) await db.pesate.delete(daEliminare.data);
          setDaEliminare(null);
        }}
      />
    </>
  );
}

/** Inserimento rapido: kg + data (oggi di default). Una pesata al giorno. */
function NuovaPesata({ pesate }: { pesate: Pesata[] }) {
  const oggi = dataLocale();
  const [kg, setKg] = useState('');
  const [data, setData] = useState(oggi);
  const [errore, setErrore] = useState('');
  const [salvata, setSalvata] = useState(false);

  const esistente = pesate.find((p) => p.data === data);

  const salva = async () => {
    const valore = leggiNumero(kg);
    if (valore === null) return setErrore('Scrivi il peso, ad esempio 82,4.');
    if (valore < 20 || valore > 400) return setErrore('Il peso deve essere tra 20 e 400 kg.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return setErrore('Scegli una data valida.');
    if (data > oggi) return setErrore('La data non può essere nel futuro.');
    // `put` sovrascrive l'eventuale pesata dello stesso giorno.
    await db.pesate.put({ data, kg: Math.round(valore * 10) / 10, esportato: false });
    setKg('');
    setErrore('');
    setData(oggi);
    setSalvata(true);
    setTimeout(() => setSalvata(false), 2000);
  };

  return (
    <form
      className="riquadro nuova-pesata"
      onSubmit={(e) => {
        e.preventDefault();
        salva();
      }}
    >
      <div className="nuova-pesata-campi">
        <label className="campo-etichettato">
          <span>Peso (kg)</span>
          <input
            className="campo campo-grande"
            inputMode="decimal"
            placeholder={pesate.length ? numero(pesate[pesate.length - 1].kg) : '82,4'}
            value={kg}
            onChange={(e) => {
              setKg(e.target.value);
              setSalvata(false);
            }}
          />
        </label>
        <label className="campo-etichettato">
          <span>Data</span>
          <input
            className="campo"
            type="date"
            max={oggi}
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </label>
      </div>
      {esistente && !salvata && (
        <p className="testo-tenue piccolo">
          Sostituirà la pesata di quel giorno ({numero(esistente.kg)} kg).
        </p>
      )}
      {errore && <p className="errore">{errore}</p>}
      <button type="submit" className="pulsante primario largo">
        {salvata ? 'Salvata ✓' : 'Salva pesata'}
      </button>
    </form>
  );
}
