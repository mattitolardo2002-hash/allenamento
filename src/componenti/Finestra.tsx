import { useEffect, type ReactNode } from 'react';

// Finestra che sale dal basso: comoda da raggiungere col pollice.
// Sostituisce gli alert del browser, che su iPhone sono brutti e poco chiari.
export function Finestra({
  aperta,
  titolo,
  onChiudi,
  children,
}: {
  aperta: boolean;
  titolo: string;
  onChiudi: () => void;
  children: ReactNode;
}) {
  // Blocca lo scorrimento della pagina sotto la finestra; Esc chiude (sul Mac).
  useEffect(() => {
    if (!aperta) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onChiudi();
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', esc);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', esc);
    };
  }, [aperta, onChiudi]);

  if (!aperta) return null;

  return (
    <div className="velo" onClick={onChiudi}>
      <div
        className="finestra"
        role="dialog"
        aria-modal="true"
        aria-label={titolo}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="finestra-testa">
          <h2>{titolo}</h2>
          <button type="button" className="pulsante-icona" onClick={onChiudi} aria-label="Chiudi">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="finestra-corpo">{children}</div>
      </div>
    </div>
  );
}

/** Chiede conferma prima di un'azione che non si può annullare (es. eliminare). */
export function Conferma({
  aperta,
  titolo,
  testo,
  etichetta,
  onConferma,
  onAnnulla,
}: {
  aperta: boolean;
  titolo: string;
  testo: string;
  etichetta: string;
  onConferma: () => void;
  onAnnulla: () => void;
}) {
  return (
    <Finestra aperta={aperta} titolo={titolo} onChiudi={onAnnulla}>
      <p className="testo-tenue">{testo}</p>
      <div className="fila-pulsanti">
        <button type="button" className="pulsante" onClick={onAnnulla}>
          Annulla
        </button>
        <button type="button" className="pulsante pericolo" onClick={onConferma}>
          {etichetta}
        </button>
      </div>
    </Finestra>
  );
}
