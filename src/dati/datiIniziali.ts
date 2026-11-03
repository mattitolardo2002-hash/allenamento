import type { Esercizio, Scheda, VoceScheda } from './tipi';

// Le schede di partenza, caricate solo al primo avvio.
// Dopo si modificano dall'app, non da qui.

export const ESERCIZI_INIZIALI: Esercizio[] = [
  { id: 'trazioni', nome: 'Trazioni', tipo: 'zavorra', perLato: false },
  { id: 'dip', nome: 'Dip', tipo: 'zavorra', perLato: false },
  { id: 'military-press', nome: 'Military press', tipo: 'carico', perLato: false },
  { id: 'spinte-manubri', nome: 'Spinte con manubri', tipo: 'carico', perLato: true },
  { id: 'pec-fly', nome: 'Pec fly', tipo: 'carico', perLato: false },
  { id: 'alzate-laterali', nome: 'Alzate laterali', tipo: 'carico', perLato: true },
  { id: 'alzate-laterali-macchina', nome: 'Alzate laterali al macchinario', tipo: 'carico', perLato: false },
  { id: 'curl', nome: 'Curl', tipo: 'carico', perLato: false },
  { id: 'curl-manubri', nome: 'Curl con manubri', tipo: 'carico', perLato: true },
  { id: 'curl-corda', nome: 'Curl alla corda presa supina', tipo: 'carico', perLato: false },
  { id: 'tricipiti-cavo', nome: 'Tricipiti al cavo', tipo: 'carico', perLato: false },
  { id: 'leg-raise', nome: 'Leg raise', tipo: 'corpo', perLato: false },
  { id: 'chest-press', nome: 'Chest press', tipo: 'carico', perLato: false },
  { id: 'lat-machine', nome: 'Lat machine', tipo: 'carico', perLato: false },
  { id: 'pulley-triangolo', nome: 'Pulley triangolo stretto', tipo: 'carico', perLato: false },
  { id: 'leg-press-monogamba', nome: 'Leg press monogamba', tipo: 'carico', perLato: true },
  { id: 'leg-extension', nome: 'Leg extension', tipo: 'carico', perLato: false },
  { id: 'leg-curl', nome: 'Leg curl', tipo: 'carico', perLato: false },
];

// Scorciatoia per scrivere le voci in modo compatto.
const v = (esercizioId: string, serie: number, rip: string, extra: Partial<VoceScheda> = {}): VoceScheda => ({
  esercizioId,
  serie,
  rip,
  ...extra,
});

export const SCHEDE_INIZIALI: Scheda[] = [
  {
    id: 'allenamento-1',
    nome: 'Allenamento 1',
    ordine: 0,
    voci: [
      v('trazioni', 4, '6', { nota: 'Il numero di serie può variare' }),
      v('dip', 3, '5', { nota: '15 kg' }),
      v('military-press', 3, '5-6', { alternativaId: 'spinte-manubri' }),
      v('pec-fly', 2, '6-8'),
      v('alzate-laterali', 3, '6'),
      v('curl', 3, '6'),
      v('tricipiti-cavo', 3, '6'),
      v('leg-raise', 3, '', { nota: 'Max 3 serie' }),
    ],
  },
  {
    id: 'allenamento-2',
    nome: 'Allenamento 2',
    ordine: 1,
    voci: [
      v('chest-press', 3, '6'),
      v('pec-fly', 2, '6'),
      v('alzate-laterali-macchina', 3, '6'),
      v('lat-machine', 3, '6'),
      v('pulley-triangolo', 3, '6'),
      v('curl-manubri', 3, '6'),
      v('curl-corda', 2, '6'),
      v('tricipiti-cavo', 3, '6'),
      v('leg-raise', 3, '', { nota: 'Max 3 serie' }),
    ],
  },
  {
    id: 'allenamento-3',
    nome: 'Allenamento 3',
    ordine: 2,
    voci: [v('leg-press-monogamba', 3, '6'), v('leg-extension', 3, '6'), v('leg-curl', 3, '6')],
  },
  {
    id: 'allenamento-4',
    nome: 'Allenamento 4',
    ordine: 3,
    voci: [
      v('trazioni', 3, '6'),
      v('dip', 3, '6'),
      v('military-press', 3, '6'),
      v('alzate-laterali', 3, '6'),
      v('pulley-triangolo', 3, '6'),
      v('pec-fly', 2, '6'),
      v('curl', 3, '6'),
      v('curl-corda', 2, '6'),
      v('tricipiti-cavo', 3, '6'),
      v('leg-raise', 3, '', { nota: 'Max 3 serie' }),
    ],
  },
];
