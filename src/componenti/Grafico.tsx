import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { dataBreve, dataConGiorno, numero } from '../logica/formato';
import { numeroGiorno } from '../logica/peso';

export interface Punto {
  data: string;
  valore: number;
}

// Margini interni del grafico (spazio per le etichette degli assi).
const M = { sopra: 12, destra: 12, sotto: 26, sinistra: 40 };
const ALTEZZA = 220;

/**
 * Grafico nel tempo, disegnato a mano in SVG (niente librerie, funziona offline).
 * - `punti`: valori singoli, come pallini grigi;
 * - `linea`: andamento in evidenza (es. media mobile), come linea blu.
 * Toccando o passando sopra compare il dettaglio del giorno più vicino.
 */
export function Grafico({
  punti,
  linea,
  nomePunti,
  nomeLinea,
  unita,
  area = false,
  formato = numero,
  invertito = false,
}: {
  punti: Punto[];
  linea?: Punto[];
  nomePunti: string;
  nomeLinea?: string;
  unita: string;
  /** Riempie con una sfumatura lo spazio sotto la linea. */
  area?: boolean;
  /** Come scrivere i valori (asse e dettaglio): di base numeri all'italiana. */
  formato?: (n: number) => string;
  /** Valori più bassi in alto (es. il passo di corsa: più basso = più veloce). */
  invertito?: boolean;
}) {
  const idSfumatura = useId();
  const contenitore = useRef<HTMLDivElement>(null);
  const [larghezza, setLarghezza] = useState(0);
  const [attivo, setAttivo] = useState<number | null>(null);

  // La larghezza segue quella dello schermo (rotazione, finestra del Mac…).
  useEffect(() => {
    const el = contenitore.current;
    if (!el) return;
    const osserva = new ResizeObserver(([voce]) => setLarghezza(voce.contentRect.width));
    osserva.observe(el);
    return () => osserva.disconnect();
  }, []);

  const tutti = [...punti, ...(linea ?? [])];
  if (!tutti.length) return null;

  // Scale: giorni → x, valori → y (con un po' di aria sopra e sotto).
  const giorni = tutti.map((p) => numeroGiorno(p.data));
  const g0 = Math.min(...giorni);
  const g1 = Math.max(...giorni);
  const valori = tutti.map((p) => p.valore);
  const tacche = taccheY(Math.min(...valori), Math.max(...valori));
  const v0 = tacche[0];
  const v1 = tacche[tacche.length - 1];

  const w = Math.max(larghezza, 200);
  const x = (data: string) =>
    g1 === g0 ? (M.sinistra + w - M.destra) / 2 : M.sinistra + ((numeroGiorno(data) - g0) / (g1 - g0)) * (w - M.sinistra - M.destra);
  const y = (v: number) => {
    const quota = (v - v0) / (v1 - v0);
    return M.sopra + (invertito ? quota : 1 - quota) * (ALTEZZA - M.sopra - M.sotto);
  };

  // Punto più vicino al dito/mouse, cercato tra le date dei pallini.
  const muovi = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left;
    let migliore = 0;
    punti.forEach((p, i) => {
      if (Math.abs(x(p.data) - px) < Math.abs(x(punti[migliore].data) - px)) migliore = i;
    });
    setAttivo(migliore);
  };

  const sel = attivo !== null ? punti[attivo] : null;
  const selLinea = sel && linea?.find((p) => p.data === sel.data);
  const percorso = linea && percorsoMorbido(linea.map((p) => [x(p.data), y(p.valore)]));

  return (
    // Senza `nomeLinea` è una serie sola: pallini e linea dello stesso colore,
    // niente legenda (il titolo sopra il grafico dice già cosa mostra).
    <div className={`grafico${nomeLinea ? '' : ' singola'}`} ref={contenitore}>
      {nomeLinea && (
        <div className="legenda">
          <span>
            <i className="segno-punto" /> {nomePunti}
          </span>
          <span>
            <i className="segno-linea" /> {nomeLinea}
          </span>
        </div>
      )}

      {larghezza > 0 && (
        <svg
          width={w}
          height={ALTEZZA}
          role="img"
          aria-label={`Grafico: ${nomePunti}${nomeLinea ? ` e ${nomeLinea}` : ''}`}
          onPointerMove={muovi}
          onPointerDown={muovi}
          onPointerLeave={() => setAttivo(null)}
        >
          {/* Griglia orizzontale leggera con i valori sull'asse */}
          {tacche.map((t) => (
            <g key={t}>
              <line className="griglia" x1={M.sinistra} x2={w - M.destra} y1={y(t)} y2={y(t)} />
              <text className="asse" x={M.sinistra - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">
                {formato(t)}
              </text>
            </g>
          ))}
          {/* Date di inizio e fine sull'asse orizzontale */}
          <text className="asse" x={M.sinistra} y={ALTEZZA - 6} textAnchor="start">
            {dataBreve(punti[0]?.data ?? tutti[0].data)}
          </text>
          {g1 !== g0 && (
            <text className="asse" x={w - M.destra} y={ALTEZZA - 6} textAnchor="end">
              {dataBreve(punti[punti.length - 1]?.data ?? tutti[tutti.length - 1].data)}
            </text>
          )}

          {sel && <line className="mirino" x1={x(sel.data)} x2={x(sel.data)} y1={M.sopra} y2={ALTEZZA - M.sotto} />}

          {area && percorso && linea && linea.length > 1 && (
            <>
              <defs>
                <linearGradient id={idSfumatura} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" style={{ stopColor: 'var(--colore-linea)', stopOpacity: 0.32 }} />
                  <stop offset="100%" style={{ stopColor: 'var(--colore-linea)', stopOpacity: 0 }} />
                </linearGradient>
              </defs>
              <path
                fill={`url(#${CSS.escape(idSfumatura)})`}
                d={`${percorso}L${x(linea[linea.length - 1].data).toFixed(1)},${ALTEZZA - M.sotto}L${x(linea[0].data).toFixed(1)},${ALTEZZA - M.sotto}Z`}
              />
            </>
          )}
          {punti.map((p) => (
            <circle key={p.data} className="punto" cx={x(p.data)} cy={y(p.valore)} r={punti.length > 60 ? 2.5 : 4} />
          ))}
          {percorso && <path className="linea" d={percorso} />}

          {sel && (
            <>
              <circle className="punto attivo" cx={x(sel.data)} cy={y(sel.valore)} r={5} />
              {selLinea && <circle className="linea-attiva" cx={x(sel.data)} cy={y(selLinea.valore)} r={5} />}
            </>
          )}
        </svg>
      )}

      {/* Dettaglio del punto toccato, sopra il grafico per non finire sotto il dito */}
      {sel && (
        <div
          className="suggerimento"
          style={{ left: Math.min(Math.max(x(sel.data), 70), w - 70) }}
          aria-live="polite"
        >
          <strong>{dataConGiorno(sel.data)}</strong>
          <span>
            {nomePunti}: {formato(sel.valore)} {unita}
          </span>
          {selLinea && nomeLinea && (
            <span>
              {nomeLinea}: {formato(Math.round(selLinea.valore * 10) / 10)} {unita}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Da 3 a 5 valori "tondi" per l'asse verticale, che contengono min e max. */
function taccheY(min: number, max: number): number[] {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const grezzo = (max - min) / 4;
  const potenza = 10 ** Math.floor(Math.log10(grezzo));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * potenza).find((p) => p >= grezzo)!;
  const inizio = Math.floor(min / passo) * passo;
  const fine = Math.ceil(max / passo) * passo;
  const tacche = [];
  for (let t = inizio; t <= fine + passo / 1000; t += passo) tacche.push(Math.round(t * 1000) / 1000);
  return tacche;
}

/**
 * Linea morbida che passa per tutti i punti senza "sforare" sopra o sotto
 * i valori reali (interpolazione monotona: niente gobbe inventate).
 */
function percorsoMorbido(punti: [number, number][]): string {
  if (!punti.length) return '';
  const f = (n: number) => n.toFixed(1);
  if (punti.length < 3) return punti.map(([px, py], i) => `${i ? 'L' : 'M'}${f(px)},${f(py)}`).join('');
  const n = punti.length;
  // Pendenze tra punti vicini e, in ogni punto, pendenza della curva
  // (limitata in modo che la curva non superi mai i valori vicini).
  const d = punti.slice(1).map(([px, py], i) => {
    const dx = px - punti[i][0];
    return dx === 0 ? 0 : (py - punti[i][1]) / dx;
  });
  const m = punti.map(([px], i) => {
    if (i === 0) return d[0];
    if (i === n - 1) return d[n - 2];
    const h0 = px - punti[i - 1][0];
    const h1 = punti[i + 1][0] - px;
    if (h0 + h1 === 0) return 0;
    const p = (d[i - 1] * h1 + d[i] * h0) / (h0 + h1);
    return (Math.sign(d[i - 1]) + Math.sign(d[i])) * Math.min(Math.abs(d[i - 1]), Math.abs(d[i]), 0.5 * Math.abs(p));
  });
  let out = `M${f(punti[0][0])},${f(punti[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = punti[i];
    const [x1, y1] = punti[i + 1];
    const h = (x1 - x0) / 3;
    out += `C${f(x0 + h)},${f(y0 + m[i] * h)} ${f(x1 - h)},${f(y1 - m[i + 1] * h)} ${f(x1)},${f(y1)}`;
  }
  return out;
}
