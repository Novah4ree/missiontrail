import type { ImageSourcePropType } from 'react-native';

// Dedicated egg art has not been added for every catalog entry yet. Static
// fallbacks keep Metro from failing the entire app bundle on missing files.
const WATER_EGG_ART = require('../../assets/eggs/water-egg.png');
const FIRE_EGG_ART = require('../../assets/eggs/fire-egg.png');
const UNDISCOVERED_EGG_ART = require('../../assets/images/relicsIcons/undiscovered.png');

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
  | 'toxic'
  | 'tech'
  | 'void'
  | 'crystal'
  | 'ancient';

export type EggTier =
  | 'Standard'
  | 'Enhanced'
  | 'Rare'
  | 'Epic'
  | 'Legendary';

export interface CompanionEgg {
  id: string;
  name: string;
  element: EggElement;
  tier: EggTier;

  description: string;

  hatchDistanceMiles: number;

  image: ImageSourcePropType;

  glowColor: string;

  hatchPool: string[];

  /**
   * Multiplier used later when rolling
   * higher-rarity companions.
   *
   * 1.0 = normal
   * 1.15 = slightly better
   * 1.35 = strong boost
   * 1.65 = major boost
   * 2.0 = highest permanent boost
   */
  rarityBoost: number;
}

export const COMPANION_EGGS: CompanionEgg[] = [
  // ==================================================
  // WATER
  // ==================================================

  {
    id: 'tidal-heart-egg',
    name: 'Tidal Heart Egg',
    element: 'water',
    tier: 'Standard',
    description:
      'A living sphere of tidal energy pulsing beneath a translucent shell.',
    hatchDistanceMiles: 1.5,
    image: WATER_EGG_ART,
    glowColor: '#45DFFF',
    rarityBoost: 1,
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
    id: 'coral-crown-egg',
    name: 'Coral Crown Egg',
    element: 'water',
    tier: 'Enhanced',
    description:
      'A regal aquatic egg formed from living coral and ocean energy.',
    hatchDistanceMiles: 2,
    image: WATER_EGG_ART,
    glowColor: '#40E0D0',
    rarityBoost: 1.15,
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
    id: 'leviathan-tide-egg',
    name: 'Leviathan Tide Egg',
    element: 'water',
    tier: 'Epic',
    description:
      'Ancient currents coil inside an egg touched by leviathan energy.',
    hatchDistanceMiles: 3.5,
    image: WATER_EGG_ART,
    glowColor: '#00B8D9',
    rarityBoost: 1.65,
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
    id: 'abyssal-kraken-egg',
    name: 'Abyssal Kraken Egg',
    element: 'water',
    tier: 'Legendary',
    description:
      'Something enormous seems to move inside this deep-sea relic egg.',
    hatchDistanceMiles: 5,
    image: WATER_EGG_ART,
    glowColor: '#167D9A',
    rarityBoost: 2,
    hatchPool: [
      'bubble-slime',
      'aqua-pup',
      'coral-fox',
      'frost-otter',
      'tide-turtle',
      'abyss-dragon',
    ],
  },

  // ==================================================
  // FIRE
  // ==================================================

  {
    id: 'inferno-core-egg',
    name: 'Inferno Core Egg',
    element: 'fire',
    tier: 'Standard',
    description:
      'A volcanic shell containing a fiercely burning elemental core.',
    hatchDistanceMiles: 1.5,
    image: FIRE_EGG_ART,
    glowColor: '#FF6B00',
    rarityBoost: 1,
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
    id: 'magmaheart-egg',
    name: 'Magmaheart Egg',
    element: 'fire',
    tier: 'Rare',
    description:
      'Molten veins pulse through this heavy volcanic egg.',
    hatchDistanceMiles: 2.75,
    image: FIRE_EGG_ART,
    glowColor: '#FF4500',
    rarityBoost: 1.35,
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
    id: 'cinder-obsidian-egg',
    name: 'Cinder Obsidian Egg',
    element: 'fire',
    tier: 'Epic',
    description:
      'Black volcanic glass conceals a furnace of unstable energy.',
    hatchDistanceMiles: 4,
    image: FIRE_EGG_ART,
    glowColor: '#FF2A00',
    rarityBoost: 1.65,
    hatchPool: [
      'ember-pup',
      'magma-beetle',
      'flame-fox',
      'lava-golem',
      'phoenix-chick',
      'inferno-dragon',
    ],
  },

  // ==================================================
  // NATURE
  // ==================================================

  {
    id: 'verdant-soul-egg',
    name: 'Verdant Soul Egg',
    element: 'nature',
    tier: 'Standard',
    description:
      'Living vines curl around a shell overflowing with wild energy.',
    hatchDistanceMiles: 1.75,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#55FF88',
    rarityBoost: 1,
    hatchPool: [
      'mossling',
      'bloom-bunny',
      'thorn-fox',
      'mycelium-stag',
      'verdant-guardian',
      'worldroot-dragon',
    ],
  },

  {
    id: 'springbloom-egg',
    name: 'Springbloom Egg',
    element: 'nature',
    tier: 'Enhanced',
    description:
      'A bright living egg awakened by fresh growth and spring energy.',
    hatchDistanceMiles: 2,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#7CFF6B',
    rarityBoost: 1.15,
    hatchPool: [
      'mossling',
      'bloom-bunny',
      'thorn-fox',
      'mycelium-stag',
      'verdant-guardian',
      'worldroot-dragon',
    ],
  },

  {
    id: 'sakura-bloom-egg',
    name: 'Sakura Bloom Egg',
    element: 'nature',
    tier: 'Rare',
    description:
      'Soft petals orbit an egg carrying an unusually peaceful life force.',
    hatchDistanceMiles: 2.75,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#FF8FBD',
    rarityBoost: 1.35,
    hatchPool: [
      'mossling',
      'bloom-bunny',
      'thorn-fox',
      'mycelium-stag',
      'verdant-guardian',
      'worldroot-dragon',
    ],
  },

  {
    id: 'mycelium-dream-egg',
    name: 'Mycelium Dream Egg',
    element: 'nature',
    tier: 'Epic',
    description:
      'Bioluminescent fungal networks pulse beneath this mysterious shell.',
    hatchDistanceMiles: 4,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#8BFFB0',
    rarityBoost: 1.65,
    hatchPool: [
      'mossling',
      'bloom-bunny',
      'thorn-fox',
      'mycelium-stag',
      'verdant-guardian',
      'worldroot-dragon',
    ],
  },

  // ==================================================
  // STORM
  // ==================================================

  {
    id: 'tempest-core-egg',
    name: 'Tempest Core Egg',
    element: 'storm',
    tier: 'Standard',
    description:
      'Lightning continuously circles the storm trapped within.',
    hatchDistanceMiles: 2,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#65E8FF',
    rarityBoost: 1,
    hatchPool: [
      'spark-sprite',
      'thunder-hare',
      'volt-lynx',
      'tempest-roc',
      'storm-titan',
      'skybreaker-dragon',
    ],
  },

  {
    id: 'neon-rift-egg',
    name: 'Neon Rift Egg',
    element: 'storm',
    tier: 'Rare',
    description:
      'Electric fractures tear across a shell charged by unstable energy.',
    hatchDistanceMiles: 3,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#22D3EE',
    rarityBoost: 1.35,
    hatchPool: [
      'spark-sprite',
      'thunder-hare',
      'volt-lynx',
      'tempest-roc',
      'storm-titan',
      'skybreaker-dragon',
    ],
  },

  {
    id: 'storm-resonance-egg',
    name: 'Storm Resonance Egg',
    element: 'storm',
    tier: 'Epic',
    description:
      'Thunder seems to answer every pulse coming from within this egg.',
    hatchDistanceMiles: 4,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#60A5FA',
    rarityBoost: 1.65,
    hatchPool: [
      'spark-sprite',
      'thunder-hare',
      'volt-lynx',
      'tempest-roc',
      'storm-titan',
      'skybreaker-dragon',
    ],
  },

  // ==================================================
  // EARTH
  // ==================================================

  {
    id: 'titanstone-egg',
    name: 'Titanstone Egg',
    element: 'earth',
    tier: 'Standard',
    description:
      'An impossibly dense egg formed from ancient stone.',
    hatchDistanceMiles: 1.75,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#C58A52',
    rarityBoost: 1,
    hatchPool: [
      'pebble-pup',
      'burrow-mole',
      'granite-ram',
      'canyon-golem',
      'titan-mammoth',
      'worldshaker-dragon',
    ],
  },

  {
    id: 'duneheart-egg',
    name: 'Duneheart Egg',
    element: 'earth',
    tier: 'Rare',
    description:
      'Desert winds seem trapped beneath layers of mineral and sand.',
    hatchDistanceMiles: 3,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#E6B566',
    rarityBoost: 1.35,
    hatchPool: [
      'pebble-pup',
      'burrow-mole',
      'granite-ram',
      'canyon-golem',
      'titan-mammoth',
      'worldshaker-dragon',
    ],
  },

  // ==================================================
  // FROST
  // ==================================================

  {
    id: 'glacial-heart-egg',
    name: 'Glacial Heart Egg',
    element: 'frost',
    tier: 'Rare',
    description:
      'An ancient frozen heartbeat echoes beneath layers of enchanted ice.',
    hatchDistanceMiles: 3,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#B5F4FF',
    rarityBoost: 1.35,
    hatchPool: [
      'snow-puff',
      'ice-hare',
      'glacier-lynx',
      'frostwing-owl',
      'glacial-guardian',
      'cryowyrm',
    ],
  },

  // ==================================================
  // LUNAR
  // ==================================================

  {
    id: 'moonveil-egg',
    name: 'Moonveil Egg',
    element: 'lunar',
    tier: 'Standard',
    description:
      'Silver lunar energy drifts beneath its shadowed shell.',
    hatchDistanceMiles: 2.5,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#C6BDFF',
    rarityBoost: 1,
    hatchPool: [
      'moon-mote',
      'crescent-hare',
      'nightveil-fox',
      'eclipse-owl',
      'moonwarden',
      'lunar-wyrm',
    ],
  },

  {
    id: 'dreammoon-egg',
    name: 'Dreammoon Egg',
    element: 'lunar',
    tier: 'Epic',
    description:
      'A sleeping lunar presence seems to dream inside this egg.',
    hatchDistanceMiles: 4,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#B8A7FF',
    rarityBoost: 1.65,
    hatchPool: [
      'moon-mote',
      'crescent-hare',
      'nightveil-fox',
      'eclipse-owl',
      'moonwarden',
      'lunar-wyrm',
    ],
  },

  // ==================================================
  // SOLAR
  // ==================================================

  {
    id: 'sunforge-egg',
    name: 'Sunforge Egg',
    element: 'solar',
    tier: 'Standard',
    description:
      'Solar energy burns steadily inside a forged golden shell.',
    hatchDistanceMiles: 2.5,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#FFD95A',
    rarityBoost: 1,
    hatchPool: [
      'sun-spark',
      'solar-gecko',
      'flare-falcon',
      'sunscarab-guardian',
      'helios-lion',
      'solar-seraph',
    ],
  },

  {
    id: 'sunscarab-egg',
    name: 'Sunscarab Egg',
    element: 'solar',
    tier: 'Epic',
    description:
      'Ancient solar symbols shift across this radiant shell.',
    hatchDistanceMiles: 4,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#FFBD2E',
    rarityBoost: 1.65,
    hatchPool: [
      'sun-spark',
      'solar-gecko',
      'flare-falcon',
      'sunscarab-guardian',
      'helios-lion',
      'solar-seraph',
    ],
  },

  // ==================================================
  // COSMIC
  // ==================================================

  {
    id: 'nebula-heart-egg',
    name: 'Nebula Heart Egg',
    element: 'cosmic',
    tier: 'Standard',
    description:
      'A tiny nebula appears to breathe inside this celestial egg.',
    hatchDistanceMiles: 3,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#7DEEFF',
    rarityBoost: 1,
    hatchPool: [
      'star-mite',
      'nebula-pup',
      'comet-fox',
      'astral-manta',
      'nova-guardian',
      'galaxy-dragon',
    ],
  },

  {
    id: 'astral-nexus-egg',
    name: 'Astral Nexus Egg',
    element: 'cosmic',
    tier: 'Rare',
    description:
      'Multiple streams of astral energy converge inside this shell.',
    hatchDistanceMiles: 3.5,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#8C7DFF',
    rarityBoost: 1.35,
    hatchPool: [
      'star-mite',
      'nebula-pup',
      'comet-fox',
      'astral-manta',
      'nova-guardian',
      'galaxy-dragon',
    ],
  },

  {
    id: 'starlight-nova-egg',
    name: 'Starlight Nova Egg',
    element: 'cosmic',
    tier: 'Epic',
    description:
      'A newborn star burns quietly behind its cosmic shell.',
    hatchDistanceMiles: 4.5,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#A7F3FF',
    rarityBoost: 1.65,
    hatchPool: [
      'star-mite',
      'nebula-pup',
      'comet-fox',
      'astral-manta',
      'nova-guardian',
      'galaxy-dragon',
    ],
  },

  {
    id: 'nova-rift-egg',
    name: 'Nova Rift Egg',
    element: 'cosmic',
    tier: 'Legendary',
    description:
      'Reality appears fractured around this impossibly energetic egg.',
    hatchDistanceMiles: 6,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#6D5CFF',
    rarityBoost: 2,
    hatchPool: [
      'star-mite',
      'nebula-pup',
      'comet-fox',
      'astral-manta',
      'nova-guardian',
      'galaxy-dragon',
    ],
  },

  // ==================================================
  // SPIRIT
  // ==================================================

  {
    id: 'wraithlight-egg',
    name: 'Wraithlight Egg',
    element: 'spirit',
    tier: 'Standard',
    description:
      'Ghostly light drifts in and out of this ethereal shell.',
    hatchDistanceMiles: 3,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#D6FFF6',
    rarityBoost: 1,
    hatchPool: [
      'whisper-wisp',
      'ghost-kitten',
      'veil-hound',
      'soul-raven',
      'wraith-guardian',
      'phantom-wyrm',
    ],
  },

  {
    id: 'spectral-wyrm-egg',
    name: 'Spectral Wyrm Egg',
    element: 'spirit',
    tier: 'Epic',
    description:
      'The shadow of a serpentine spirit circles within.',
    hatchDistanceMiles: 4.5,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#A5F3FC',
    rarityBoost: 1.65,
    hatchPool: [
      'whisper-wisp',
      'ghost-kitten',
      'veil-hound',
      'soul-raven',
      'wraith-guardian',
      'phantom-wyrm',
    ],
  },

  {
    id: 'phantom-dragon-egg',
    name: 'Phantom Dragon Egg',
    element: 'spirit',
    tier: 'Legendary',
    description:
      'An ancient dragon spirit waits behind a nearly weightless shell.',
    hatchDistanceMiles: 6,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#C4B5FD',
    rarityBoost: 2,
    hatchPool: [
      'whisper-wisp',
      'ghost-kitten',
      'veil-hound',
      'soul-raven',
      'wraith-guardian',
      'phantom-wyrm',
    ],
  },

  // ==================================================
  // TOXIC
  // ==================================================

  {
    id: 'venomcore-egg',
    name: 'Venomcore Egg',
    element: 'toxic',
    tier: 'Rare',
    description:
      'Toxic green energy bubbles beneath a dangerously unstable shell.',
    hatchDistanceMiles: 3,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#73FF43',
    rarityBoost: 1.35,
    hatchPool: [
      'venom-sprite',
      'toxin-toad',
      'viper-lynx',
      'plague-moth',
      'venom-titan',
      'toxic-hydra',
    ],
  },

  // ==================================================
  // TECH
  // ==================================================

  {
    id: 'cybercore-egg',
    name: 'Cybercore Egg',
    element: 'tech',
    tier: 'Standard',
    description:
      'Circuits flicker beneath the shell of this mechanical egg.',
    hatchDistanceMiles: 3.5,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#00F5FF',
    rarityBoost: 1,
    hatchPool: [],
  },

  {
    id: 'aegis-core-egg',
    name: 'Aegis Core Egg',
    element: 'tech',
    tier: 'Rare',
    description:
      'A heavily shielded technological core protects whatever waits inside.',
    hatchDistanceMiles: 4,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#38BDF8',
    rarityBoost: 1.35,
    hatchPool: [],
  },

  {
    id: 'tech-resonance-egg',
    name: 'Tech Resonance Egg',
    element: 'tech',
    tier: 'Epic',
    description:
      'Unknown machinery resonates with every movement around it.',
    hatchDistanceMiles: 5,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#22D3EE',
    rarityBoost: 1.65,
    hatchPool: [],
  },

  // ==================================================
  // VOID
  // ==================================================

  {
    id: 'abyss-heart-egg',
    name: 'Abyss Heart Egg',
    element: 'void',
    tier: 'Epic',
    description:
      'Light bends toward the dark core hidden within this egg.',
    hatchDistanceMiles: 5,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#7C3AED',
    rarityBoost: 1.65,
    hatchPool: [],
  },

  {
    id: 'void-requiem-egg',
    name: 'Void Requiem Egg',
    element: 'void',
    tier: 'Legendary',
    description:
      'An ominous rhythm echoes from somewhere beyond the shell.',
    hatchDistanceMiles: 7,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#8B5CF6',
    rarityBoost: 2,
    hatchPool: [],
  },

  // ==================================================
  // CRYSTAL
  // ==================================================

  {
    id: 'prismatic-egg',
    name: 'Prismatic Egg',
    element: 'crystal',
    tier: 'Standard',
    description:
      'Every angle of this crystalline shell reflects a different energy.',
    hatchDistanceMiles: 3,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#E879F9',
    rarityBoost: 1,
    hatchPool: [
      'prism-sprite',
      'gem-gecko',
      'amethyst-fox',
      'aurora-stag',
      'spectrum-guardian',
      'prismatic-dragon',
    ],
  },

  {
    id: 'amethyst-rift-egg',
    name: 'Amethyst Rift Egg',
    element: 'crystal',
    tier: 'Rare',
    description:
      'A violet fracture of crystalline energy cuts through this shell.',
    hatchDistanceMiles: 3.75,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#C084FC',
    rarityBoost: 1.35,
    hatchPool: [
      'prism-sprite',
      'gem-gecko',
      'amethyst-fox',
      'aurora-stag',
      'spectrum-guardian',
      'prismatic-dragon',
    ],
  },

  {
    id: 'riftcrystal-egg',
    name: 'Riftcrystal Egg',
    element: 'crystal',
    tier: 'Epic',
    description:
      'A strange dimensional rift appears trapped inside solid crystal.',
    hatchDistanceMiles: 4.5,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#A78BFA',
    rarityBoost: 1.65,
    hatchPool: [
      'prism-sprite',
      'gem-gecko',
      'amethyst-fox',
      'aurora-stag',
      'spectrum-guardian',
      'prismatic-dragon',
    ],
  },

  {
    id: 'aurora-prism-egg',
    name: 'Aurora Prism Egg',
    element: 'crystal',
    tier: 'Epic',
    description:
      'Aurora-like colors drift endlessly through its faceted shell.',
    hatchDistanceMiles: 5,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#67E8F9',
    rarityBoost: 1.65,
    hatchPool: [
      'prism-sprite',
      'gem-gecko',
      'amethyst-fox',
      'aurora-stag',
      'spectrum-guardian',
      'prismatic-dragon',
    ],
  },

  {
    id: 'spectrum-crown-egg',
    name: 'Spectrum Crown Egg',
    element: 'crystal',
    tier: 'Legendary',
    description:
      'A royal crystalline egg carrying every visible wavelength of energy.',
    hatchDistanceMiles: 6.5,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#F0ABFC',
    rarityBoost: 2,
    hatchPool: [
      'prism-sprite',
      'gem-gecko',
      'amethyst-fox',
      'aurora-stag',
      'spectrum-guardian',
      'prismatic-dragon',
    ],
  },

  // ==================================================
  // ANCIENT
  // ==================================================

  {
    id: 'primordial-egg',
    name: 'Primordial Egg',
    element: 'ancient',
    tier: 'Rare',
    description:
      'An egg seemingly older than every mapped trail.',
    hatchDistanceMiles: 4,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#D6A84B',
    rarityBoost: 1.35,
    hatchPool: [],
  },

  {
    id: 'dragonbound-relic-egg',
    name: 'Dragonbound Relic Egg',
    element: 'ancient',
    tier: 'Epic',
    description:
      'Ancient bindings surround a relic egg marked with draconic symbols.',
    hatchDistanceMiles: 5,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#F59E0B',
    rarityBoost: 1.65,
    hatchPool: [],
  },

  {
    id: 'chronos-gear-egg',
    name: 'Chronos Gear Egg',
    element: 'ancient',
    tier: 'Epic',
    description:
      'Mechanical gears move inside a shell untouched by time.',
    hatchDistanceMiles: 5.5,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#EAB308',
    rarityBoost: 1.65,
    hatchPool: [],
  },

  {
    id: 'celestial-chronometer-egg',
    name: 'Celestial Chronometer Egg',
    element: 'ancient',
    tier: 'Legendary',
    description:
      'Stars and time appear synchronized inside this ancient artifact.',
    hatchDistanceMiles: 7,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#FDE68A',
    rarityBoost: 2,
    hatchPool: [],
  },

  {
    id: 'clockwork-sovereign-egg',
    name: 'Clockwork Sovereign Egg',
    element: 'ancient',
    tier: 'Legendary',
    description:
      'A royal mechanism of forgotten origin protects the creature within.',
    hatchDistanceMiles: 8,
    image: UNDISCOVERED_EGG_ART,
    glowColor: '#FBBF24',
    rarityBoost: 2,
    hatchPool: [],
  },
];

// Purpose: Returns egg by id.
export function getEggById(id: string) {
  return COMPANION_EGGS.find(
    (egg) => egg.id === id
  );
}

// Purpose: Returns eggs by element.
export function getEggsByElement(
  element: EggElement
) {
  return COMPANION_EGGS.filter(
    (egg) => egg.element === element
  );
}

// Purpose: Returns eggs by tier.
export function getEggsByTier(
  tier: EggTier
) {
  return COMPANION_EGGS.filter(
    (egg) => egg.tier === tier
  );
}
