import { useEffect } from 'react';
import { usePosizione, vai } from './navigazione';
import { db } from './dati/db';
import { BarraNavigazione } from './componenti/BarraNavigazione';
import { Allenati } from './schermate/Allenati';
import { Peso } from './schermate/Peso';
import { Progressi } from './schermate/Progressi';
import { Schede } from './schermate/Schede';
import { Altro } from './schermate/Altro';

// Struttura generale: contenuto della sezione scelta + barra in basso.
export function App() {
  const { sezione, dettaglio } = usePosizione();

  // All'apertura dell'app: se c'era un allenamento a metà, si riparte da lì.
  useEffect(() => {
    db.bozza.get('corrente').then((b) => {
      if (b && /^(#\/?(allenati)?)?$/.test(location.hash)) vai('allenati', 'in-corso');
    });
  }, []);

  return (
    <>
      <main className="contenuto">
        {/* La chiave cambia a ogni schermata: così parte la dissolvenza d'entrata. */}
        <div className="pagina" key={`${sezione}/${dettaglio ?? ''}`}>
          {sezione === 'allenati' && <Allenati dettaglio={dettaglio} />}
          {sezione === 'peso' && <Peso />}
          {sezione === 'progressi' && <Progressi dettaglio={dettaglio} />}
          {sezione === 'schede' && <Schede dettaglio={dettaglio} />}
          {sezione === 'altro' && <Altro />}
        </div>
      </main>
      <BarraNavigazione attiva={sezione} onScegli={(id) => vai(id)} />
    </>
  );
}
