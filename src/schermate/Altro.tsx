import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, leggiImpostazione, nuovoId, scriviImpostazione } from '../dati/db';
import { PREDEFINITI } from '../logica/obiettivi';
import type { Esercizio } from '../dati/tipi';
import { consegnaFile, preparaEsportazione, segnaEsportati, type Backup } from '../dati/esportazione';
import { importaBackup, leggiBackup } from '../dati/importazione';
import { dataBreve, dataLocale } from '../logica/formato';
import { numeroGiorno } from '../logica/peso';
import { Conferma, Finestra } from '../componenti/Finestra';
import { ModuloEsercizio, NOMI_TIPO, semplifica } from '../componenti/SceltaEsercizio';

// Sezione Altro: backup, esportazione per Notion, importazione ed esercizi.
export function Altro() {
  return (
    <>
      <h1 className="titolo-pagina">Altro</h1>
      <StatoBackup />
      <Obiettivo />
      <Esporta />
      <Importa />
      <GestioneEsercizi />
      <p className="testo-tenue piccolo centrato spazio-sopra">Allenamento · versione {__VERSIONE__}</p>
    </>
  );
}

/** Quando è stato fatto l'ultimo backup e se il browser protegge i dati. */
function StatoBackup() {
  const ultimo = useLiveQuery(() => leggiImpostazione('ultimoBackup').then((v) => v ?? null), []);
  const [protetto, setProtetto] = useState<boolean | null>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setProtetto).catch(() => setProtetto(null));
  }, []);

  if (ultimo === undefined) return null;
  const giorni = ultimo ? numeroGiorno(dataLocale()) - numeroGiorno(dataLocale(new Date(ultimo))) : null;
  const daFare = giorni === null || giorni >= 7;

  return (
    <section className={`riquadro stato-backup${daFare ? ' avviso' : ''}`}>
      <span className="etichetta-sopra">Ultimo backup</span>
      <span className="scheda-nome">
        {ultimo === null
          ? 'Mai fatto'
          : `${dataBreve(dataLocale(new Date(ultimo)))} · ${giorni === 0 ? 'oggi' : giorni === 1 ? 'ieri' : `${giorni} giorni fa`}`}
      </span>
      <p className="testo-tenue piccolo">
        I dati esistono solo su questo dispositivo. Esporta il file JSON almeno una volta a settimana e salvalo in File
        o iCloud: se perdi o resetti il telefono, lo ripristini con “Importa backup”.
        {protetto === false && ' Il browser non garantisce la conservazione: aggiungi l’app alla schermata Home.'}
      </p>
    </section>
  );
}

/** Obiettivi settimanali (pesi e cardio), usati per gli anelli nella home. */
function Obiettivo() {
  const pesi = useLiveQuery(
    () => leggiImpostazione('obiettivoSettimanale').then((v) => Number(v) || PREDEFINITI.pesi),
    [],
  );
  const cardio = useLiveQuery(
    () => leggiImpostazione('obiettivoCardio').then((v) => Number(v) || PREDEFINITI.cardio),
    [],
  );
  if (!pesi || !cardio) return null;

  return (
    <>
      <h2 className="titolo-sezione">Obiettivi settimanali</h2>
      <section className="riquadro elenco-obiettivi">
        <RigaObiettivo
          etichetta="Allenamenti con i pesi"
          valore={pesi}
          onCambia={(n) => scriviImpostazione('obiettivoSettimanale', String(n))}
        />
        <RigaObiettivo
          etichetta="Sedute di cardio"
          valore={cardio}
          onCambia={(n) => scriviImpostazione('obiettivoCardio', String(n))}
        />
      </section>
    </>
  );
}

function RigaObiettivo({
  etichetta,
  valore,
  onCambia,
}: {
  etichetta: string;
  valore: number;
  onCambia: (n: number) => void;
}) {
  return (
    <div className="obiettivo">
      <span>
        {etichetta}
        <small className="testo-tenue">a settimana</small>
      </span>
      <div className="contatore">
        <button type="button" aria-label="Uno in meno" disabled={valore <= 1} onClick={() => onCambia(valore - 1)}>
          −
        </button>
        <output>{valore}</output>
        <button type="button" aria-label="Uno in più" disabled={valore >= 7} onClick={() => onCambia(valore + 1)}>
          +
        </button>
      </div>
    </div>
  );
}

function Esporta() {
  const [soloNuovi, setSoloNuovi] = useState(true);
  // I file vengono preparati in anticipo: così al tocco il foglio di
  // condivisione dell'iPhone si apre subito (Safari lo richiede).
  const pronta = useLiveQuery(() => preparaEsportazione(soloNuovi), [soloNuovi]);
  const [chiediConferma, setChiediConferma] = useState(false);
  const [esito, setEsito] = useState('');

  const n = pronta
    ? { sessioni: pronta.sessioniIds.length, pesate: pronta.pesateDate.length, cardio: pronta.cardioIds.length }
    : null;
  const vuota = n !== null && n.sessioni === 0 && n.pesate === 0 && n.cardio === 0;

  return (
    <>
      <h2 className="titolo-sezione">Esporta dati</h2>
      <section className="riquadro modulo">
        <div className="segmenti" role="radiogroup" aria-label="Cosa esportare">
          <button type="button" role="radio" aria-checked={soloNuovi} onClick={() => setSoloNuovi(true)}>
            Solo nuovi
          </button>
          <button type="button" role="radio" aria-checked={!soloNuovi} onClick={() => setSoloNuovi(false)}>
            Tutto
          </button>
        </div>
        <p className="testo-tenue piccolo senza-margine-p">
          {n === null
            ? '…'
            : vuota
              ? soloNuovi
                ? 'Niente di nuovo da esportare: è tutto già esportato.'
                : 'Non ci sono ancora dati.'
              : `${n.sessioni === 1 ? '1 allenamento' : `${n.sessioni} allenamenti`}, ${n.cardio} cardio e ${n.pesate === 1 ? '1 pesata' : `${n.pesate} pesate`}. ` +
                'Quattro file: un JSON completo (backup e Notion) e tre CSV: serie, pesate e cardio.'}
        </p>
        <button
          type="button"
          className="pulsante primario"
          disabled={!pronta || vuota}
          onClick={async () => {
            if (!pronta) return;
            setEsito('');
            if (await consegnaFile(pronta.file)) setChiediConferma(true);
          }}
        >
          Esporta
        </button>
        {esito && <p className="testo-tenue piccolo senza-margine-p">{esito}</p>}
      </section>

      <Finestra aperta={chiediConferma} titolo="Hai salvato i file?" onChiudi={() => setChiediConferma(false)}>
        <p className="testo-tenue">
          Se sì, segno questi dati come esportati: la prossima volta con “Solo nuovi” avrai solo quelli successivi.
        </p>
        <div className="fila-pulsanti">
          <button type="button" className="pulsante" onClick={() => setChiediConferma(false)}>
            Non ancora
          </button>
          <button
            type="button"
            className="pulsante primario"
            onClick={async () => {
              if (pronta) await segnaEsportati(pronta);
              setChiediConferma(false);
              setEsito('Fatto: dati segnati come esportati.');
            }}
          >
            Sì, salvati
          </button>
        </div>
      </Finestra>
    </>
  );
}

function Importa() {
  const input = useRef<HTMLInputElement>(null);
  const [backup, setBackup] = useState<Backup | null>(null);
  const [errore, setErrore] = useState('');
  const [esito, setEsito] = useState('');
  const [sostituisci, setSostituisci] = useState(false);

  const importa = async (modo: 'unisci' | 'sostituisci') => {
    if (!backup) return;
    try {
      await importaBackup(backup, modo);
      setEsito(
        `Importati ${backup.sessioni.length} allenamenti, ${backup.pesate.length} pesate e ${backup.schede.length} schede.`,
      );
    } catch {
      setErrore('Importazione non riuscita: i dati esistenti non sono stati modificati.');
    }
    setBackup(null);
    setSostituisci(false);
  };

  return (
    <>
      <h2 className="titolo-sezione">Importa backup</h2>
      <section className="riquadro modulo">
        <p className="testo-tenue piccolo senza-margine-p">
          Ripristina da un file JSON esportato da questa app, ad esempio per passare i dati dall’iPhone al Mac.
        </p>
        <button type="button" className="pulsante" onClick={() => input.current?.click()}>
          Scegli file JSON…
        </button>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = ''; // permette di scegliere di nuovo lo stesso file
            if (!file) return;
            setErrore('');
            setEsito('');
            try {
              setBackup(await leggiBackup(file));
            } catch (err) {
              setErrore((err as Error).message);
            }
          }}
        />
        {errore && <p className="errore">{errore}</p>}
        {esito && <p className="testo-tenue piccolo senza-margine-p">{esito}</p>}
      </section>

      <Finestra aperta={backup !== null && !sostituisci} titolo="Importa backup" onChiudi={() => setBackup(null)}>
        {backup && (
          <>
            <p className="testo-tenue">
              Backup del {dataBreve(dataLocale(new Date(backup.esportatoIl)))}
              {backup.contenuto === 'nuovi' && ' (solo dati nuovi)'}: {backup.sessioni.length} allenamenti,{' '}
              {backup.cardio?.length ?? 0} cardio, {backup.pesate.length} pesate, {backup.schede.length} schede,{' '}
              {backup.esercizi.length} esercizi.
            </p>
            <p className="testo-tenue piccolo">
              <strong>Unisci</strong> aggiunge i dati del file e aggiorna quelli uguali, senza cancellare nulla.
              <br />
              <strong>Sostituisci tutto</strong> cancella i dati attuali e tiene solo quelli del file.
            </p>
            <div className="fila-pulsanti verticale">
              <button type="button" className="pulsante primario" onClick={() => importa('unisci')}>
                Unisci
              </button>
              <button type="button" className="pulsante pericolo-tenue" onClick={() => setSostituisci(true)}>
                Sostituisci tutto
              </button>
            </div>
          </>
        )}
      </Finestra>

      <Conferma
        aperta={sostituisci}
        titolo="Sostituire tutti i dati?"
        testo="Allenamenti, pesate, schede ed esercizi attuali verranno cancellati e rimpiazzati da quelli del file. L’allenamento in corso resta."
        etichetta="Sostituisci"
        onAnnulla={() => setSostituisci(false)}
        onConferma={() => importa('sostituisci')}
      />
    </>
  );
}

/** Elenco degli esercizi: modifica di nome e tipo, eliminazione di quelli mai usati. */
function GestioneEsercizi() {
  const esercizi = useLiveQuery(() => db.esercizi.toArray(), []);
  const schede = useLiveQuery(() => db.schede.toArray(), []);
  const sessioni = useLiveQuery(() => db.sessioni.toArray(), []);
  // Esercizio in modifica; con id vuoto è un esercizio nuovo.
  const [inModifica, setInModifica] = useState<Esercizio | null>(null);
  const [daEliminare, setDaEliminare] = useState<Esercizio | null>(null);

  if (!esercizi || !schede || !sessioni) return null;
  const nuovo = inModifica?.id === '';

  // Un esercizio usato in una scheda o nello storico non si può eliminare.
  const usi = (id: string) => ({
    schede: schede.filter((s) => s.voci.some((v) => v.esercizioId === id || v.alternativaId === id)).length,
    sedute: sessioni.filter((s) => s.esercizi.some((e) => e.esercizioId === id)).length,
  });
  const ordinati = [...esercizi].sort((a, b) => a.nome.localeCompare(b.nome, 'it'));

  return (
    <>
      <h2 className="titolo-sezione">Esercizi</h2>
      <ul className="riquadro elenco-esercizi-gestione">
        {ordinati.map((e) => {
          const u = usi(e.id);
          const libero = u.schede === 0 && u.sedute === 0;
          return (
            <li key={e.id}>
              <button type="button" className="voce-scelta" onClick={() => setInModifica(e)}>
                <span>{e.nome}</span>
                <span className="testo-tenue piccolo">
                  {NOMI_TIPO[e.tipo]}
                  {e.perLato && ' · per lato'} ·{' '}
                  {libero ? 'mai usato' : `${u.schede} schede, ${u.sedute} sedute`}
                </span>
              </button>
              {libero && (
                <button
                  type="button"
                  className="pulsante-icona"
                  aria-label={`Elimina ${e.nome}`}
                  onClick={() => setDaEliminare(e)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 7l10 10M17 7L7 17" />
                  </svg>
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="pulsante largo"
        onClick={() => setInModifica({ id: '', nome: '', tipo: 'carico', perLato: false })}
      >
        + Nuovo esercizio
      </button>
      <p className="testo-tenue piccolo">
        Un esercizio nuovo non deve per forza stare in una scheda: lo trovi anche in “+ Aggiungi esercizio” durante
        l’allenamento. Tocca un esercizio per cambiarne nome o tipo (vale ovunque, storico compreso). Si possono
        eliminare solo quelli mai usati.
      </p>

      <Finestra
        aperta={inModifica !== null}
        titolo={nuovo ? 'Nuovo esercizio' : 'Modifica esercizio'}
        onChiudi={() => setInModifica(null)}
      >
        {inModifica && (
          <ModuloEsercizio
            iniziale={inModifica}
            nomiEsistenti={esercizi.filter((e) => e.id !== inModifica.id).map((e) => semplifica(e.nome))}
            onAnnulla={() => setInModifica(null)}
            onSalva={async (es) => {
              await db.esercizi.put(nuovo ? { ...es, id: nuovoId() } : es);
              setInModifica(null);
            }}
          />
        )}
      </Finestra>

      <Conferma
        aperta={daEliminare !== null}
        titolo="Eliminare l’esercizio?"
        testo={`«${daEliminare?.nome}» verrà tolto dall’elenco.`}
        etichetta="Elimina"
        onAnnulla={() => setDaEliminare(null)}
        onConferma={async () => {
          if (daEliminare) await db.esercizi.delete(daEliminare.id);
          setDaEliminare(null);
        }}
      />
    </>
  );
}
