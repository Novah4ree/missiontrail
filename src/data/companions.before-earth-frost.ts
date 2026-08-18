export type CompanionRarity =
  | 'Common'
  | 'Uncommon'
  | 'Rare'
  | 'Epic'
  | 'Legendary'
  | 'Mythic';

export interface Companion {
  id: string;
  name: string;
  element: string;
  rarity: CompanionRarity;
  hatchWeight: number;
  description: string;
}

export const COMPANIONS: Companion[] = [
  // =========================
  // WATER COMPANIONS
  // =========================

  {
    id: 'bubble-slime',
    name: 'Bubble Slime',
    element: 'water',
    rarity: 'Common',
    hatchWeight: 45,
    description:
      'A tiny water creature that happily bounces alongside explorers.',
  },

  {
    id: 'aqua-pup',
    name: 'Aqua Pup',
    element: 'water',
    rarity: 'Uncommon',
    hatchWeight: 28,
    description:
      'A playful aquatic companion that loves rivers and lakes.',
  },

  {
    id: 'coral-fox',
    name: 'Coral Fox',
    element: 'water',
    rarity: 'Rare',
    hatchWeight: 15,
    description:
      'A swift fox whose crystalline fur resembles living coral.',
  },

  {
    id: 'frost-otter',
    name: 'Frost Otter',
    element: 'water',
    rarity: 'Epic',
    hatchWeight: 8,
    description:
      'An elusive water companion capable of freezing droplets around itself.',
  },

  {
    id: 'tide-turtle',
    name: 'Tide Turtle',
    element: 'water',
    rarity: 'Legendary',
    hatchWeight: 3,
    description:
      'An ancient guardian said to remember every shoreline it has visited.',
  },

  {
    id: 'abyss-dragon',
    name: 'Abyss Dragon',
    element: 'water',
    rarity: 'Mythic',
    hatchWeight: 1,
    description:
      'An extremely rare dragon born from the deepest unexplored waters.',
  },

  // =========================
  // FIRE COMPANIONS
  // =========================

  {
    id: 'ember-pup',
    name: 'Ember Pup',
    element: 'fire',
    rarity: 'Common',
    hatchWeight: 45,
    description:
      'A small fiery pup whose paws leave tiny glowing embers behind.',
  },

  {
    id: 'magma-beetle',
    name: 'Magma Beetle',
    element: 'fire',
    rarity: 'Uncommon',
    hatchWeight: 28,
    description:
      'A tough little beetle protected by a shell of cooling magma.',
  },

  {
    id: 'flame-fox',
    name: 'Flame Fox',
    element: 'fire',
    rarity: 'Rare',
    hatchWeight: 15,
    description:
      'A clever fire companion with a tail that burns without producing smoke.',
  },

  {
    id: 'lava-golem',
    name: 'Lava Golem',
    element: 'fire',
    rarity: 'Epic',
    hatchWeight: 8,
    description:
      'A powerful creature formed from volcanic rock and molten energy.',
  },

  {
    id: 'phoenix-chick',
    name: 'Phoenix Chick',
    element: 'fire',
    rarity: 'Legendary',
    hatchWeight: 3,
    description:
      'A young phoenix carrying an ancient flame within its tiny wings.',
  },

  {
    id: 'inferno-dragon',
    name: 'Inferno Dragon',
    element: 'fire',
    rarity: 'Mythic',
    hatchWeight: 1,
    description:
      'A nearly mythical dragon capable of producing enormous waves of flame.',
  },

  // =========================
  // NATURE COMPANIONS
  // =========================

  {
    id: 'mossling',
    name: 'Mossling',
    element: 'nature',
    rarity: 'Common',
    hatchWeight: 45,
    description:
      'A tiny forest creature covered in soft moss and glowing sprouts.',
  },

  {
    id: 'bloom-bunny',
    name: 'Bloom Bunny',
    element: 'nature',
    rarity: 'Uncommon',
    hatchWeight: 28,
    description:
      'A lively woodland companion whose footsteps leave tiny flowers behind.',
  },

  {
    id: 'thorn-fox',
    name: 'Thorn Fox',
    element: 'nature',
    rarity: 'Rare',
    hatchWeight: 15,
    description:
      'A swift forest fox protected by living vines and crystalline thorns.',
  },

  {
    id: 'mycelium-stag',
    name: 'Mycelium Stag',
    element: 'nature',
    rarity: 'Epic',
    hatchWeight: 8,
    description:
      'A mysterious stag connected to a glowing underground fungal network.',
  },

  {
    id: 'verdant-guardian',
    name: 'Verdant Guardian',
    element: 'nature',
    rarity: 'Legendary',
    hatchWeight: 3,
    description:
      'An ancient protector awakened whenever the wilderness is threatened.',
  },

  {
    id: 'worldroot-dragon',
    name: 'Worldroot Dragon',
    element: 'nature',
    rarity: 'Mythic',
    hatchWeight: 1,
    description:
      'A mythical dragon said to have grown from the roots beneath the oldest forests.',
  },


  // =========================
  // STORM COMPANIONS
  // =========================

  {
    id: 'spark-sprite',
    name: 'Spark Sprite',
    element: 'storm',
    rarity: 'Common',
    hatchWeight: 45,
    description:
      'A tiny electric creature that crackles whenever it gets excited.',
  },

  {
    id: 'thunder-hare',
    name: 'Thunder Hare',
    element: 'storm',
    rarity: 'Uncommon',
    hatchWeight: 28,
    description:
      'A lightning-fast companion whose ears glow before a storm arrives.',
  },

  {
    id: 'volt-lynx',
    name: 'Volt Lynx',
    element: 'storm',
    rarity: 'Rare',
    hatchWeight: 15,
    description:
      'A stealthy electric predator surrounded by a constantly shifting charge.',
  },

  {
    id: 'tempest-roc',
    name: 'Tempest Roc',
    element: 'storm',
    rarity: 'Epic',
    hatchWeight: 8,
    description:
      'A massive storm bird capable of gathering thunder beneath its wings.',
  },

  {
    id: 'storm-titan',
    name: 'Storm Titan',
    element: 'storm',
    rarity: 'Legendary',
    hatchWeight: 3,
    description:
      'An ancient giant formed from thunderclouds, lightning, and raw atmospheric power.',
  },

  {
    id: 'skybreaker-dragon',
    name: 'Skybreaker Dragon',
    element: 'storm',
    rarity: 'Mythic',
    hatchWeight: 1,
    description:
      'A mythical dragon whose arrival can split the sky with a single roar.',
  },

];

// Purpose: Returns companion by id.
export function getCompanionById(id: string) {
  return COMPANIONS.find(
    (companion) => companion.id === id
  );
}

// Purpose: Returns companions by element.
export function getCompanionsByElement(element: string) {
  return COMPANIONS.filter(
    (companion) => companion.element === element
  );
}

// Purpose: Returns companions by rarity.
export function getCompanionsByRarity(
  rarity: CompanionRarity
) {
  return COMPANIONS.filter(
    (companion) => companion.rarity === rarity
  );
}
