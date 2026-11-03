import type { ReactNode } from 'react';
import { SEZIONI, type IdSezione } from '../navigazione';

// Icone a tratto sottile, disegnate su una griglia 24×24.
const ICONE: Record<IdSezione, ReactNode> = {
  allenati: (
    <>
      <path d="M3 12h18" />
      <path d="M6 7v10M3.5 9v6M18 7v10M20.5 9v6" />
    </>
  ),
  peso: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M8.5 9.5a5 5 0 0 1 7 0M12 9.5l1.5-1.5" />
    </>
  ),
  progressi: <path d="M3.5 17.5l5-5 4 3 7.5-8M15 7.5h5v5" />,
  schede: (
    <>
      <rect x="4.5" y="3.5" width="15" height="17" rx="2.5" />
      <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
    </>
  ),
  altro: (
    <>
      <circle cx="6" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="18" cy="12" r="1.2" />
    </>
  ),
};

export function BarraNavigazione({
  attiva,
  onScegli,
}: {
  attiva: IdSezione;
  onScegli: (id: IdSezione) => void;
}) {
  return (
    <nav className="barra-nav" aria-label="Sezioni">
      {SEZIONI.map((s) => (
        <button
          key={s.id}
          type="button"
          className="voce-nav"
          aria-current={s.id === attiva ? 'page' : undefined}
          onClick={() => onScegli(s.id)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {ICONE[s.id]}
          </svg>
          <span>{s.etichetta}</span>
        </button>
      ))}
    </nav>
  );
}
