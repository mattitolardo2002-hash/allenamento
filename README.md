# Allenamento

Web app personale per registrare gli allenamenti in palestra (pesi e corpo libero, anche zavorrato), il cardio (cyclette e corsa) e il peso corporeo. Funziona sull'iPhone come un'app vera (dalla schermata Home) e sul Mac nel browser, **anche senza connessione**.

## Cosa fa

- **Allenati**: scheda proposta per oggi, anelli degli obiettivi settimanali (pesi e cardio), storico. Durante l'allenamento: kg e ripetizioni per ogni serie, "ultima volta" in grigio, record personali (★). Se chiudi l'app a metà, alla riapertura ritrovi tutto.
- **Cardio**: cyclette (tempo, battito medio) e corsa (km, passo, battito medio/minimo/massimo).
- **Peso**: una pesata al giorno, media mobile a 7 giorni, grafico.
- **Progressi**: per ogni esercizio 1RM stimato (Epley) o ripetizioni; per il cardio passo, km, tempo e battito. Record e sedute.
- **Schede**: crei e modifichi le schede quando vuoi, senza toccare il codice.
- **Altro**: obiettivi, esportazione (JSON + CSV, per Notion), importazione backup, elenco esercizi.

## Dove stanno i dati

Solo sul dispositivo, nel database del browser (IndexedDB). Niente server, niente account. iPhone e Mac hanno **archivi separati**: per passare i dati da uno all'altro usa *Altro → Esporta* e poi *Importa backup*.

> Fai un backup (Altro → Esporta → salva in File/iCloud) almeno una volta a settimana: se perdi o resetti il telefono, è l'unico modo per recuperare i dati.

## Avviarla sul Mac (per provarla o modificarla)

Serve [Node.js](https://nodejs.org) (versione LTS).

1. Apri il Terminale nella cartella del progetto.
2. La prima volta installa le dipendenze:
   ```bash
   npm install
   ```
3. Avvia l'app:
   ```bash
   npm run dev
   ```
4. Apri nel browser l'indirizzo mostrato (di solito http://localhost:5173). Dall'iPhone, sullo stesso Wi-Fi, usa l'indirizzo "Network" che compare nel Terminale.

Altri comandi:

| Comando | A cosa serve |
|---|---|
| `npm run build` | Prepara la versione finale nella cartella `dist/` |
| `npm run preview` | Prova in locale la versione finale (anche offline) |
| `npm run icone` | Rigenera le icone in `public/` |

## Pubblicarla (GitHub Pages, gratis)

L'app è pubblicata su **https://mattitolardo2002-hash.github.io/allenamento/**.
Il codice sta nel repository `mattitolardo2002-hash/allenamento` (ramo `main`); la versione online sta nel ramo `gh-pages`.

Per pubblicare una nuova versione dopo una modifica:

```bash
npm run pubblica
```

Lo script (`scripts/pubblica.sh`) costruisce l'app e la carica sul ramo `gh-pages`; dopo un paio di minuti l'indirizzo mostra la versione nuova. Serve aver fatto una volta l'accesso a GitHub dal Mac con lo strumento `gh` (`gh auth login`).

Il repository è **pubblico** (GitHub Pages gratuito lo richiede): online c'è solo il codice, mai i tuoi dati.

## Installarla sull'iPhone

1. Apri **https://mattitolardo2002-hash.github.io/allenamento/** con **Safari** (non Chrome).
2. Tocca il pulsante **Condividi** (il quadrato con la freccia in su).
3. Scorri e tocca **Aggiungi alla schermata Home**, poi **Aggiungi**.
4. Apri l'app dall'icona nella schermata Home. Da qui in poi funziona anche senza rete.

Quando pubblichi una nuova versione, l'app si aggiorna da sola alla riapertura (a volte servono due aperture).

## Struttura del progetto

```
src/
  dati/        database (Dexie/IndexedDB), schede iniziali, esportazione e importazione
  logica/      calcoli: formati italiani, 1RM, media mobile, settimane, record
  schermate/   Allenati, Allenamento in corso, Peso, Progressi, Schede, Altro
  componenti/  finestre, grafico, scelta esercizi, modulo cardio, barra in basso
  stile.css    tutti i colori e gli stili (le variabili in cima cambiano l'aspetto)
public/        icone dell'app
scripts/       generatore delle icone
```

Tecnologie: React + TypeScript + Vite, `vite-plugin-pwa` per l'installazione e l'uso offline, Dexie per il database, grafici SVG fatti a mano, font Inter e Barlow Condensed inclusi nell'app.

## Esportazione per Notion

*Altro → Esporta* produce:

- `allenamento-AAAA-MM-GG.json`: tutto (esercizi, schede, allenamenti, pesate, cardio). Serve anche come backup.
- `allenamento-serie-….csv`: una riga per serie (data, scheda, esercizio, n° serie, kg, rip, riscaldamento, durata, RPE, note).
- `allenamento-pesate-….csv`: data e kg.
- `allenamento-cardio-….csv`: data, tipo, durata, km, passo, battiti.

I CSV usano la virgola come separatore e il punto per i decimali (formato standard letto da Notion e dai fogli di calcolo). Con "Solo nuovi" esporti solo ciò che non hai ancora esportato; ogni elemento ha un id fisso, così chi importa può aggiornare invece di duplicare.
