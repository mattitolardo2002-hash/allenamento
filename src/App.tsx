import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { usePosizione, vai } from './navigazione';
import { db } from './dati/db';
import { BarraNavigazione } from './componenti/BarraNavigazione';
import { FinestraNuovo } from './componenti/FinestraNuovo';
import { Allenati } from './schermate/Allenati';
import { Peso } from './schermate/Peso';
import { Progressi } from './schermate/Progressi';
import { Schede } from './schermate/Schede';
import { Altro } from './schermate/Altro';

// Struttura generale: contenuto della sezione scelta + barra in basso con il "+".
export function App() {
  const { sezione, dettaglio } = usePosizione();
  const inCorso = useLiveQuery(() => db.bozza.get('corrente').then((b) => !!b), []) ?? false;
  const [menuNuovo, setMenuNuovo] = useState(false);
  // Durante l'allenamento la barra in basso sparisce: al suo posto c'è il recupero.
  const inAllenamento = sezione === 'allenati' && dettaglio === 'in-corso';

  // All'apertura dell'app: se c'era un allenamento a metà, si riparte da lì.
  useEffect(() => {
    db.bozza.get('corrente').then((b) => {
      if (b && /^(#\/?(allenati)?)?$/.test(location.hash)) vai('allenati', 'in-corso');
    });
  }, []);

  return (
    <>
      <main className={`contenuto${inAllenamento ? ' senza-nav' : ''}`}>
        {/* La chiave cambia a ogni schermata: così parte la dissolvenza d'entrata. */}
        <div className="pagina" key={`${sezione}/${dettaglio ?? ''}`}>
          {sezione === 'allenati' && <Allenati dettaglio={dettaglio} />}
          {sezione === 'peso' && <Peso />}
          {sezione === 'progressi' && <Progressi dettaglio={dettaglio} />}
          {sezione === 'schede' && <Schede dettaglio={dettaglio} />}
          {sezione === 'altro' && <Altro />}
        </div>
      </main>
      {!inAllenamento && (
        <BarraNavigazione
          attiva={sezione}
          inCorso={inCorso}
          onScegli={(id) => vai(id)}
          onPiu={() => (inCorso ? vai('allenati', 'in-corso') : setMenuNuovo(true))}
        />
      )}
      <FinestraNuovo aperta={menuNuovo} onChiudi={() => setMenuNuovo(false)} />
    </>
  );
}
