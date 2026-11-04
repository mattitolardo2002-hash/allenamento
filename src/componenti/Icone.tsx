import {
  IconArrowBigDownLines, IconArrowBigUpLines, IconBarbell, IconBike, IconGymnastics, IconRun, IconStretching2,
  IconWeight, type Icon,
} from '@tabler/icons-react';
import type { TipoCardio } from '../dati/tipi';

// Gruppi muscolari, riconosciuti dal nome dell'esercizio.
// Servono solo per dare a ogni esercizio un'icona e un colore riconoscibili:
// nei dati non si salva nulla.
type Gruppo = 'petto' | 'dorso' | 'spalle' | 'braccia' | 'gambe' | 'addome' | 'altro';

const GRUPPI: Record<Gruppo, { icona: Icon; colore: string; nome: string }> = {
  petto: { icona: IconBarbell, colore: '#5b9bf5', nome: 'Petto' },
  dorso: { icona: IconArrowBigDownLines, colore: '#4cc3e8', nome: 'Dorso' },
  spalle: { icona: IconArrowBigUpLines, colore: '#a884f7', nome: 'Spalle' },
  braccia: { icona: IconWeight, colore: '#f0965a', nome: 'Braccia' },
  gambe: { icona: IconStretching2, colore: '#3ccf91', nome: 'Gambe' },
  addome: { icona: IconGymnastics, colore: '#e9b44c', nome: 'Addome' },
  altro: { icona: IconBarbell, colore: '#8d96a5', nome: 'Altro' },
};

// Parole chiave → gruppo. L'ordine conta: "leg raise" è addome e "leg curl"
// è gambe (non braccia); "spinte con manubri" in piedi sono spalle.
const PAROLE: [RegExp, Gruppo][] = [
  [/leg raise|crunch|addom|plank|russian|ab wheel|hollow/, 'addome'],
  [/leg (curl|ext|press)|squat|affond|pressa|polpacc|calf|hip thrust|glute|adduttor|abduttor/, 'gambe'],
  [/alzat|military|lento|shoulder|spall|arnold|face pull|tirate|deltoid|spinte con manubri/, 'spalle'],
  [/curl|bicip|tricip|french|push ?down|skull|hammer|martello/, 'braccia'],
  [/trazion| lat |pulley|rematore|row|pull|dorso|stacco|deadlift|hyperext/, 'dorso'],
  [/leg|gamb/, 'gambe'],
  [/chest|pec|panca|bench|spint|dip|croci|petto|push ?up|piegament/, 'petto'],
];

function gruppoDi(nome: string): Gruppo {
  const n = ` ${nome.toLowerCase()} `.replace(/\s+/g, ' ');
  return PAROLE.find(([re]) => re.test(n))?.[1] ?? 'altro';
}

/** Nome del gruppo muscolare (es. "Petto") di un esercizio. */
export function nomeGruppo(nomeEsercizio: string): string {
  return GRUPPI[gruppoDi(nomeEsercizio)].nome;
}

/** Icona colorata in un quadrato arrotondato: il tratto distintivo dell'app. */
export function IconaTinta({
  icona: Ic,
  colore,
  misura = 40,
}: {
  icona: Icon;
  colore: string;
  misura?: number;
}) {
  return (
    <span
      className="icona-tinta"
      style={{
        width: misura,
        height: misura,
        borderRadius: Math.round(misura * 0.32),
        color: colore,
        background: `${colore}24`,
      }}
      aria-hidden="true"
    >
      <Ic size={Math.round(misura * 0.52)} stroke={1.8} />
    </span>
  );
}

/** Icona dell'esercizio, scelta in base al gruppo muscolare. */
export function IconaEsercizio({ nome, misura = 40 }: { nome: string; misura?: number }) {
  const g = GRUPPI[gruppoDi(nome)];
  return <IconaTinta icona={g.icona} colore={g.colore} misura={misura} />;
}

export const ICONE_CARDIO: Record<TipoCardio, { icona: Icon; colore: string }> = {
  cyclette: { icona: IconBike, colore: '#4cc3e8' },
  corsa: { icona: IconRun, colore: '#3ccf91' },
};

/** Icona di una scheda: il suo numero nella rotazione, in un quadrato blu. */
export function IconaNumero({ n, misura = 40, tono = 'blu' }: { n: number; misura?: number; tono?: 'blu' | 'verde' | 'grigio' }) {
  const colori = { blu: '#6aa5f6', verde: '#3ccf91', grigio: '#8d96a5' };
  const c = colori[tono];
  return (
    <span
      className="icona-tinta"
      style={{
        width: misura,
        height: misura,
        borderRadius: Math.round(misura * 0.32),
        color: c,
        background: `${c}22`,
        fontFamily: 'var(--numeri)',
        fontWeight: 600,
        fontSize: Math.round(misura * 0.5),
      }}
      aria-hidden="true"
    >
      {n}
    </span>
  );
}
