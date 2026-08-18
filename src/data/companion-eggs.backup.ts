export type EggElement =
  | 'water'
  | 'fire'
  | 'nature'
  | 'storm'
  | 'earth'
  | 'frost'
  | 'lunar'
  | 'solar'
  | 'cosmic'
  | 'spirit'
  | 'tech'
  | 'void';

export interface CompanionEgg {
  id: string;
  name: string;
  element: EggElement;
  description: string;
  hatchDistanceMiles: number;
  glowColor: string;
  image?: any;
  hatchPool: string[];
}

export const COMPANION_EGGS: CompanionEgg[] = [
  {
    id: 'water-egg',
    name: 'Water Egg',
    element: 'water',
    description:
      'A translucent egg filled with shifting currents of mysterious energy.',
    hatchDistanceMiles: 1.5,
    glowColor: '#45DFFF',
    image: require('../../assets/eggs/water-egg.png'),
    hatchPool: [
      'bubble-slime',
      'aqua-pup',
      'coral-fox',
      'frost-otter',
      'tide-turtle',
      'abyss-dragon',
    ],
  },

  {
    id: 'fire-egg',
    name: 'Fire Egg',
    element: 'fire',
    description:
      'A scorching stone egg with fiery energy burning beneath its shell.',
    hatchDistanceMiles: 1.5,
    glowColor: '#FF8A00',
    image: require('../../assets/eggs/fire-egg.png'),
    hatchPool: [
      'ember-pup',
      'magma-beetle',
      'flame-fox',
      'lava-golem',
      'phoenix-chick',
      'inferno-dragon',
    ],
  },

  {
    id: 'nature-egg',
    name: 'Nature Egg',
    element: 'nature',
    description:
      'An ancient egg covered in vines, moss, and glowing spores.',
    hatchDistanceMiles: 1.75,
    glowColor: '#55FF88',
    hatchPool: [],
  },

  {
    id: 'storm-egg',
    name: 'Storm Egg',
    element: 'storm',
    description:
      'Electric currents dance across the surface of this unstable egg.',
    hatchDistanceMiles: 2,
    glowColor: '#65E8FF',
    hatchPool: [],
  },

  {
    id: 'earth-egg',
    name: 'Earth Egg',
    element: 'earth',
    description:
      'A heavy shell formed from stone, minerals, and ancient earth energy.',
    hatchDistanceMiles: 1.75,
    glowColor: '#D19A66',
    hatchPool: [],
  },

  {
    id: 'frost-egg',
    name: 'Frost Egg',
    element: 'frost',
    description:
      'An impossibly cold egg surrounded by drifting frost crystals.',
    hatchDistanceMiles: 2,
    glowColor: '#B5F4FF',
    hatchPool: [],
  },

  {
    id: 'lunar-egg',
    name: 'Lunar Egg',
    element: 'lunar',
    description:
      'A mysterious egg that becomes brighter beneath the night sky.',
    hatchDistanceMiles: 2.5,
    glowColor: '#C6BDFF',
    hatchPool: [],
  },

  {
    id: 'solar-egg',
    name: 'Solar Egg',
    element: 'solar',
    description:
      'Warm radiant energy pulses from within this sun-powered shell.',
    hatchDistanceMiles: 2.5,
    glowColor: '#FFD95A',
    hatchPool: [],
  },

  {
    id: 'cosmic-egg',
    name: 'Cosmic Egg',
    element: 'cosmic',
    description:
      'Tiny galaxies appear to swirl beneath the shell of this strange egg.',
    hatchDistanceMiles: 3,
    glowColor: '#7DEEFF',
    hatchPool: [],
  },

  {
    id: 'spirit-egg',
    name: 'Spirit Egg',
    element: 'spirit',
    description:
      'An ethereal shell humming with energy from beyond the trail.',
    hatchDistanceMiles: 3,
    glowColor: '#D6FFF6',
    hatchPool: [],
  },

  {
    id: 'tech-egg',
    name: 'Tech Egg',
    element: 'tech',
    description:
      'A mechanical egg containing technology of unknown origin.',
    hatchDistanceMiles: 3.5,
    glowColor: '#00F5FF',
    hatchPool: [],
  },

  {
    id: 'void-egg',
    name: 'Void Egg',
    element: 'void',
    description:
      'Light seems to disappear into the surface of this extremely rare egg.',
    hatchDistanceMiles: 5,
    glowColor: '#9C6CFF',
    hatchPool: [],
  },
];

// Purpose: Returns egg by id.
export function getEggById(id: string) {
  return COMPANION_EGGS.find((egg) => egg.id === id);
}

// Purpose: Returns eggs by element.
export function getEggsByElement(element: EggElement) {
  return COMPANION_EGGS.filter((egg) => egg.element === element);
}
