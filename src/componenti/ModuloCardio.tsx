import { useState } from 'react';
import { db, nuovoId } from '../dati/db';
import type { Cardio, TipoCardio } from '../dati/tipi';
import { dataLocale, durata, leggiNumero, leggiPasso, leggiTempo, numero, passo } from '../logica/formato';
import { Conferma, Finestra } from './Finestra';

export const NOMI_CARDIO: Record<TipoCardio, string> = {
  cyclette: 'Cyclette',
  corsa: 'Corsa',
};

/** Testo breve di un'attività cardio, es. "5,2 km · 5:30/km · 142 bpm". */
export function riassuntoCardio(c: Cardio): string {
  const parti =
    c.tipo === 'corsa'
      ? [`${numero(c.km ?? 0)} km`, c.passoSecKm ? `${passo(c.passoSecKm)}/km` : '', durata(c.durataSec)]
      : [`${Math.round(c.durataSec / 60)} min`];
  if (c.bpmMedio) parti.push(`${c.bpmMedio} bpm`);
  return parti.filter(Boolean).join(' · ');
}

/**
 * Finestra per registrare (o correggere) cyclette e corsa.
 * - Cyclette: tempo + battito medio.
 * - Corsa: km + passo medio + battito medio, minimo e massimo.
 * Il battito è facoltativo (se non hai l'orologio, lo lasci vuoto).
 */
export function FinestraCardio({
  attivita,
  onChiudi,
}: {
  /** Attività da modificare, oppure solo il tipo per crearne una nuova. null = chiusa. */
  attivita: Cardio | { tipo: TipoCardio } | null;
  onChiudi: () => void;
}) {
  const esistente = attivita && 'id' in attivita ? attivita : null;
  return (
    <Finestra
      aperta={attivita !== null}
      titolo={attivita ? `${esistente ? '' : 'Nuova '}${NOMI_CARDIO[attivita.tipo].toLowerCase()}`.replace(/^./, (c) => c.toUpperCase()) : ''}
      onChiudi={onChiudi}
    >
      {attivita && <Modulo key={esistente?.id ?? attivita.tipo} tipo={attivita.tipo} esistente={esistente} onFine={onChiudi} />}
    </Finestra>
  );
}

function Modulo({ tipo, esistente, onFine }: { tipo: TipoCardio; esistente: Cardio | null; onFine: () => void }) {
  const oggi = dataLocale();
  const testoBpm = (n: number | null | undefined) => (n ? String(n) : '');
  const [data, setData] = useState(esistente?.data ?? oggi);
  const [tempo, setTempo] = useState(esistente && tipo === 'cyclette' ? String(Math.round(esistente.durataSec / 60)) : '');
  const [km, setKm] = useState(esistente?.km ? numero(esistente.km) : '');
  const [passoTesto, setPassoTesto] = useState(esistente?.passoSecKm ? passo(esistente.passoSecKm) : '');
  const [bpmMedio, setBpmMedio] = useState(testoBpm(esistente?.bpmMedio));
  const [bpmMin, setBpmMin] = useState(testoBpm(esistente?.bpmMin));
  const [bpmMax, setBpmMax] = useState(testoBpm(esistente?.bpmMax));
  const [note, setNote] = useState(esistente?.note ?? '');
  const [errore, setErrore] = useState('');
  const [elimina, setElimina] = useState(false);

  // Per la corsa la durata si ricava da km × passo e si mostra mentre scrivi.
  const kmLetti = leggiNumero(km);
  const passoLetto = leggiPasso(passoTesto);
  const durataCorsa = kmLetti && passoLetto ? Math.round(kmLetti * passoLetto) : null;

  /** Battito: vuoto = non indicato; altrimenti un intero plausibile. */
  const leggiBpm = (testo: string, nome: string): number | null | 'errore' => {
    if (!testo.trim()) return null;
    const n = leggiNumero(testo);
    if (n === null || !Number.isInteger(n) || n < 30 || n > 230) {
      setErrore(`${nome}: scrivi un numero di battiti tra 30 e 230.`);
      return 'errore';
    }
    return n;
  };

  const salva = async () => {
    setErrore('');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data > oggi) return setErrore('Scegli una data valida (non nel futuro).');
    const medio = leggiBpm(bpmMedio, 'Battito medio');
    if (medio === 'errore') return;

    let nuova: Cardio;
    const base = { id: esistente?.id ?? nuovoId(), data, tipo, bpmMedio: medio, note: note.trim(), esportato: false };
    if (tipo === 'cyclette') {
      const sec = leggiTempo(tempo);
      if (!sec || sec > 6 * 3600) return setErrore('Scrivi il tempo in minuti, ad esempio 45.');
      nuova = { ...base, durataSec: sec, km: null, passoSecKm: null, bpmMin: null, bpmMax: null };
    } else {
      if (!kmLetti || kmLetti > 200) return setErrore('Scrivi i km percorsi, ad esempio 5,2.');
      if (!passoLetto || passoLetto < 120 || passoLetto > 20 * 60) {
        return setErrore('Scrivi il passo medio come minuti:secondi al km, ad esempio 5:30.');
      }
      const min = leggiBpm(bpmMin, 'Battito minimo');
      if (min === 'errore') return;
      const max = leggiBpm(bpmMax, 'Battito massimo');
      if (max === 'errore') return;
      if ((min && medio && min > medio) || (max && medio && max < medio) || (min && max && min > max)) {
        return setErrore('Controlla i battiti: deve valere minimo ≤ medio ≤ massimo.');
      }
      nuova = { ...base, durataSec: durataCorsa!, km: kmLetti, passoSecKm: passoLetto, bpmMin: min, bpmMax: max };
    }
    await db.cardio.put(nuova);
    onFine();
  };

  return (
    <div className="modulo">
      <label className="campo-etichettato">
        <span>Data</span>
        <input className="campo" type="date" max={oggi} value={data} onChange={(e) => setData(e.target.value)} />
      </label>

      {tipo === 'cyclette' ? (
        <div className="due-colonne">
          <label className="campo-etichettato">
            <span>Tempo (min)</span>
            <input
              className="campo campo-grande"
              inputMode="numeric"
              placeholder="45"
              value={tempo}
              onChange={(e) => setTempo(e.target.value)}
            />
          </label>
          <label className="campo-etichettato">
            <span>Battito medio</span>
            <input
              className="campo campo-grande"
              inputMode="numeric"
              placeholder="bpm"
              value={bpmMedio}
              onChange={(e) => setBpmMedio(e.target.value)}
            />
          </label>
        </div>
      ) : (
        <>
          <div className="due-colonne">
            <label className="campo-etichettato">
              <span>Km</span>
              <input
                className="campo campo-grande"
                inputMode="decimal"
                placeholder="5,2"
                value={km}
                onChange={(e) => setKm(e.target.value)}
              />
            </label>
            <label className="campo-etichettato">
              <span>Passo (min/km)</span>
              <input
                className="campo campo-grande"
                inputMode="decimal"
                placeholder="5:30"
                value={passoTesto}
                onChange={(e) => setPassoTesto(e.target.value)}
              />
            </label>
          </div>
          <p className="testo-tenue piccolo">
            {durataCorsa ? `Tempo totale: ${durata(durataCorsa)}` : 'Il tempo totale si calcola da km e passo.'}
          </p>
          <div className="tre-colonne">
            <label className="campo-etichettato">
              <span>Bpm medio</span>
              <input className="campo" inputMode="numeric" value={bpmMedio} onChange={(e) => setBpmMedio(e.target.value)} />
            </label>
            <label className="campo-etichettato">
              <span>Bpm min</span>
              <input className="campo" inputMode="numeric" value={bpmMin} onChange={(e) => setBpmMin(e.target.value)} />
            </label>
            <label className="campo-etichettato">
              <span>Bpm max</span>
              <input className="campo" inputMode="numeric" value={bpmMax} onChange={(e) => setBpmMax(e.target.value)} />
            </label>
          </div>
        </>
      )}

      <label className="campo-etichettato">
        <span>Note</span>
        <input className="campo" value={note} placeholder="Facoltative" onChange={(e) => setNote(e.target.value)} />
      </label>

      {errore && <p className="errore">{errore}</p>}

      <button type="button" className="pulsante primario grande" onClick={salva}>
        Salva
      </button>
      {esistente && (
        <button type="button" className="pulsante pericolo-tenue" onClick={() => setElimina(true)}>
          Elimina
        </button>
      )}

      <Conferma
        aperta={elimina}
        titolo="Eliminare l’attività?"
        testo="Verrà eliminata definitivamente."
        etichetta="Elimina"
        onAnnulla={() => setElimina(false)}
        onConferma={async () => {
          if (esistente) await db.cardio.delete(esistente.id);
          setElimina(false);
          onFine();
        }}
      />
    </div>
  );
}
