import { IconBarbell, IconChartLine, IconDots, IconPlayerPlay, IconPlus, IconScale, type Icon } from '@tabler/icons-react';
import { SEZIONI, type IdSezione } from '../navigazione';

const ICONE: Partial<Record<IdSezione, Icon>> = {
  allenati: IconBarbell,
  progressi: IconChartLine,
  peso: IconScale,
  altro: IconDots,
};

// Barra in basso: due sezioni a sinistra, il "+" al centro, due a destra.
// Con un allenamento in corso il "+" diventa verde e lo riprende.
export function BarraNavigazione({
  attiva,
  inCorso,
  onScegli,
  onPiu,
}: {
  attiva: IdSezione;
  inCorso: boolean;
  onScegli: (id: IdSezione) => void;
  onPiu: () => void;
}) {
  const nellaBarra = SEZIONI.filter((s) => s.inBarra);
  // Le schede fanno parte di Allenati: la voce resta accesa.
  const evidenziata = attiva === 'schede' ? 'allenati' : attiva;
  const voce = (s: (typeof SEZIONI)[number]) => {
    const Ic = ICONE[s.id]!;
    return (
      <button
        key={s.id}
        type="button"
        className="voce-nav"
        aria-current={s.id === evidenziata ? 'page' : undefined}
        onClick={() => onScegli(s.id)}
      >
        <Ic size={24} stroke={1.6} aria-hidden="true" />
        <span>{s.etichetta}</span>
      </button>
    );
  };
  return (
    <nav className="barra-nav" aria-label="Sezioni">
      <div className="barra-nav-interno">
        {nellaBarra.slice(0, 2).map(voce)}
        <button
          type="button"
          className={`nav-piu${inCorso ? ' in-corso-nav' : ''}`}
          onClick={onPiu}
          aria-label={inCorso ? 'Riprendi l’allenamento in corso' : 'Nuovo: allenamento, cardio o pesata'}
        >
          {inCorso ? <IconPlayerPlay size={24} stroke={2.2} aria-hidden="true" /> : <IconPlus size={26} stroke={2.2} aria-hidden="true" />}
        </button>
        {nellaBarra.slice(2).map(voce)}
      </div>
    </nav>
  );
}
