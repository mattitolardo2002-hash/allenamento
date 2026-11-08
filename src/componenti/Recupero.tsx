import { useEffect, useState } from 'react';
import { durata } from '../logica/formato';

// Timer di recupero tra una serie e l'altra.
// Parte da solo quando si conferma una serie. L'orario di fine sta nel
// localStorage: se l'app si chiude o si ricarica, il timer continua da dov'era.

const CHIAVE_FINE = 'recupero-fine';
const CHIAVE_TOTALE = 'recupero-totale';
/** Durata predefinita in secondi. */
export const RECUPERO_PREDEFINITO = 120;
const EVENTO = 'recupero-cambiato';

// Il suono di fine va preparato durante un tocco (l'iPhone blocca l'audio
// che parte da solo): lo programmiamo subito per l'istante in cui finisce.
let audio: AudioContext | null = null;
let suono: OscillatorNode[] = [];

function programmaSuono(traSecondi: number) {
  fermaSuono();
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') audio.resume();
    // Tre bip brevi.
    suono = [0, 0.25, 0.5].map((ritardo) => {
      const osc = audio!.createOscillator();
      const vol = audio!.createGain();
      const inizio = audio!.currentTime + traSecondi + ritardo;
      osc.frequency.value = 880;
      vol.gain.setValueAtTime(0, inizio);
      vol.gain.linearRampToValueAtTime(0.25, inizio + 0.01);
      vol.gain.linearRampToValueAtTime(0, inizio + 0.15);
      osc.connect(vol).connect(audio!.destination);
      osc.start(inizio);
      osc.stop(inizio + 0.16);
      return osc;
    });
  } catch {
    // Audio non disponibile: resta l'avviso a schermo.
  }
}

function fermaSuono() {
  suono.forEach((o) => {
    try {
      o.stop();
    } catch {
      /* già fermo */
    }
  });
  suono = [];
}

function leggi() {
  const fine = Number(localStorage.getItem(CHIAVE_FINE)) || null;
  const totale = Number(localStorage.getItem(CHIAVE_TOTALE)) || RECUPERO_PREDEFINITO;
  return { fine, totale };
}

function scrivi(fine: number | null, totale: number) {
  if (fine === null) localStorage.removeItem(CHIAVE_FINE);
  else localStorage.setItem(CHIAVE_FINE, String(fine));
  localStorage.setItem(CHIAVE_TOTALE, String(totale));
  window.dispatchEvent(new Event(EVENTO));
}

/** Fa partire il recupero (da chiamare dentro un tocco, per il suono). */
export function avviaRecupero(secondi = RECUPERO_PREDEFINITO) {
  scrivi(Date.now() + secondi * 1000, secondi);
  programmaSuono(secondi);
}

export function fermaRecupero() {
  fermaSuono();
  scrivi(null, leggi().totale);
}

/** Aggiunge (o toglie, se negativo) secondi al recupero in corso. */
function spostaRecupero(secondi: number) {
  const { fine, totale } = leggi();
  if (fine === null) return;
  const nuovaFine = Math.max(Date.now() + 1000, fine + secondi * 1000);
  scrivi(nuovaFine, Math.max(15, totale + secondi));
  programmaSuono((nuovaFine - Date.now()) / 1000);
}

// Quanto resta visibile l'avviso "Recupero finito".
const AVVISO_MS = 5000;

/** Barra in basso con il conto alla rovescia, +15 s e "Salta". */
export function BarraRecupero() {
  const [stato, setStato] = useState(leggi);
  const [adesso, setAdesso] = useState(Date.now());

  useEffect(() => {
    const aggiorna = () => setStato(leggi());
    window.addEventListener(EVENTO, aggiorna);
    const t = setInterval(() => setAdesso(Date.now()), 250);
    return () => {
      window.removeEventListener(EVENTO, aggiorna);
      clearInterval(t);
    };
  }, []);

  const { fine, totale } = stato;
  const restante = fine === null ? 0 : (fine - adesso) / 1000;
  const finito = fine !== null && restante <= 0;

  // Fine del recupero: vibrazione (dove il telefono la permette), poi l'avviso sparisce.
  useEffect(() => {
    if (!finito) return;
    navigator.vibrate?.([200, 100, 200]);
    const t = setTimeout(fermaRecupero, AVVISO_MS);
    return () => clearTimeout(t);
  }, [finito]);

  if (fine === null || restante < -AVVISO_MS / 1000) return null;

  const r = 21;
  const giro = 2 * Math.PI * r;
  const quota = finito ? 1 : Math.min(1, Math.max(0, restante / totale));

  return (
    <div className={`barra-recupero${finito ? ' finito' : ''}`} role="timer" aria-live={finito ? 'assertive' : 'off'}>
      <svg className="anello-recupero" viewBox="0 0 50 50" aria-hidden="true">
        <circle cx="25" cy="25" r={r} className="anello-fondo" />
        <circle
          cx="25"
          cy="25"
          r={r}
          className="anello-pieno"
          strokeDasharray={`${giro * quota} ${giro}`}
          transform="rotate(-90 25 25)"
        />
      </svg>
      <div className="recupero-testo">
        <span className="etichetta-sopra">{finito ? 'Recupero finito' : 'Recupero'}</span>
        <span className="recupero-tempo">{finito ? 'Vai!' : durata(Math.ceil(restante))}</span>
      </div>
      {!finito && (
        <>
          <button type="button" className="recupero-pulsante" onClick={() => spostaRecupero(-15)} aria-label="Togli 15 secondi">
            −15
          </button>
          <button type="button" className="recupero-pulsante" onClick={() => spostaRecupero(15)} aria-label="Aggiungi 15 secondi">
            +15
          </button>
        </>
      )}
      <button type="button" className="recupero-pulsante primario" onClick={fermaRecupero}>
        {finito ? 'OK' : 'Salta'}
      </button>
    </div>
  );
}
