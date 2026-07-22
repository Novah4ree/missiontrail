import type { ImageSourcePropType } from 'react-native';

export type RelicRarity = 'Legendary' | 'Epic' | 'Rare' | 'Uncommon' | 'Common';

export type RelicEffectFamily =
  | 'cosmic'
  | 'fire'
  | 'ice'
  | 'storm'
  | 'solar'
  | 'lunar'
  | 'void'
  | 'ocean'
  | 'nature'
  | 'ancient'
  | 'dragon'
  | 'prismatic'
  | 'spirit'
  | 'time';

export type Relic = {
  id: string;
  name: string;
  icon: ImageSourcePropType;
  rarity: RelicRarity;
  effectFamily: RelicEffectFamily;
  primaryColor: string;
  secondaryColor: string;
  particleColors: string[];
  xp: number;
  lore?: string;
  mapPlacement: {
    distanceFeet: number;
    bearingDegrees: number;
  };
};

// Metro must see every image path at build time, so every collectible uses a static require.
// `legendary relics.png` is intentionally excluded because it is a combined reference image.
// `undiscovered.png` is exported below only as the Vault's locked-state artwork.
export const RELIC_ASSETS = {
  cosmicShard: {
    id: 'cosmic-shard', name: 'Cosmic Shard', icon: require('../../assets/images/relicsIcon/cosmicshard.png'),
    rarity: 'Legendary', effectFamily: 'cosmic', primaryColor: '#FFD700', secondaryColor: '#FF7A00',
    particleColors: ['#FFD700', '#FF7A00', '#FF3D81'], xp: 100,
    lore: 'A radiant fragment carrying energy from a distant star.',
    mapPlacement: { distanceFeet: 100, bearingDegrees: 0 },
  },
  nebulaCrystal: {
    id: 'nebula-crystal', name: 'Nebula Crystal', icon: require('../../assets/images/relicsIcon/nebulacrystal.png'),
    rarity: 'Epic', effectFamily: 'cosmic', primaryColor: '#F000FF', secondaryColor: '#6D5CFF',
    particleColors: ['#F000FF', '#6D5CFF', '#00D9FF'], xp: 75,
    lore: 'A crystal formed where colorful clouds of cosmic dust learned to shine.',
    mapPlacement: { distanceFeet: 5, bearingDegrees: 45 },
  },
  starFragment: {
    id: 'star-fragment', name: 'Star Fragment', icon: require('../../assets/images/relicsIcon/starfragment.png'),
    rarity: 'Rare', effectFamily: 'cosmic', primaryColor: '#00D9FF', secondaryColor: '#A7F3FF',
    particleColors: ['#00D9FF', '#A7F3FF', '#FFFFFF'], xp: 50,
    lore: 'A cool blue piece of a star that crossed the galaxy to find you.',
    mapPlacement: { distanceFeet: 500, bearingDegrees: 110 },
  },
  auroraGem: {
    id: 'aurora-gem', name: 'Aurora Gem', icon: require('../../assets/images/relicsIcon/auroragem.png'),
    rarity: 'Epic', effectFamily: 'prismatic', primaryColor: '#F000FF', secondaryColor: '#00F5D4',
    particleColors: ['#F000FF', '#00F5D4', '#7C3AED'], xp: 75,
    lore: 'A shifting gem alive with the colors of the northern sky.',
    mapPlacement: { distanceFeet: 1250, bearingDegrees: 245 },
  },
  eclipseOrb: {
    id: 'eclipse-orb', name: 'Eclipse Orb', icon: require('../../assets/images/relicsIcon/eclipseorb.png'),
    rarity: 'Epic', effectFamily: 'lunar', primaryColor: '#8B5CF6', secondaryColor: '#F5D061',
    particleColors: ['#8B5CF6', '#111827', '#F5D061'], xp: 75,
    lore: 'An orb held forever at the border between radiance and shadow.',
    mapPlacement: { distanceFeet: 1800, bearingDegrees: 315 },
  },
  forgottenIdol: {
    // Keep this legacy ID so existing players do not lose a previously saved collectible.
    id: 'hidden-relic', name: 'Forgotten Idol', icon: require('../../assets/images/relicsIcon/forgottenidol.png'),
    rarity: 'Legendary', effectFamily: 'spirit', primaryColor: '#F6C453', secondaryColor: '#8B5A2B',
    particleColors: ['#F6C453', '#D97706', '#FFF1B8'], xp: 100,
    lore: 'A watchful idol from a civilization erased from every known trail.',
    mapPlacement: { distanceFeet: 850, bearingDegrees: 180 },
  },
  abyssalBubble: {
    id: 'abyssal-bubble', name: 'Abyssal Bubble', icon: require('../../assets/images/relicsIcon/abyssalbubble.png'),
    rarity: 'Rare', effectFamily: 'ocean', primaryColor: '#38BDF8', secondaryColor: '#312E81',
    particleColors: ['#38BDF8', '#818CF8', '#C4B5FD'], xp: 50,
    lore: 'A weightless sphere carrying the hush of the deepest sea.', mapPlacement: { distanceFeet: 260, bearingDegrees: 70 },
  },
  stormCoreElement: {
    id: 'storm-core-element', name: 'Storm Core', icon: require('../../assets/images/relicsIcon/stormcoreelement.png'),
    rarity: 'Legendary', effectFamily: 'storm', primaryColor: '#60A5FA', secondaryColor: '#FDE047',
    particleColors: ['#60A5FA', '#FDE047', '#FFFFFF'], xp: 100,
    lore: 'Thunder circles endlessly inside this captured heart of a tempest.', mapPlacement: { distanceFeet: 340, bearingDegrees: 145 },
  },
  lunarTablet: {
    id: 'lunar-tablet', name: 'Lunar Tablet', icon: require('../../assets/images/relicsIcon/lunartabletcollectible.png'),
    rarity: 'Rare', effectFamily: 'lunar', primaryColor: '#C4B5FD', secondaryColor: '#64748B',
    particleColors: ['#C4B5FD', '#E2E8F0', '#818CF8'], xp: 50,
    lore: 'Moonlit glyphs reveal themselves only beneath an open night sky.', mapPlacement: { distanceFeet: 430, bearingDegrees: 215 },
  },
  phoenixEmberCrystal: {
    id: 'phoenix-ember-crystal', name: 'Phoenix Ember', icon: require('../../assets/images/relicsIcon/phoenixembercrystal.png'),
    rarity: 'Legendary', effectFamily: 'fire', primaryColor: '#FF6B00', secondaryColor: '#FFD166',
    particleColors: ['#FF6B00', '#FF2D55', '#FFD166'], xp: 100,
    lore: 'One bright ember remains after every ending, waiting to begin again.', mapPlacement: { distanceFeet: 610, bearingDegrees: 280 },
  },
  mysticalOracleEye: {
    id: 'mystical-oracle-eye', name: 'Mystical Oracle Eye', icon: require('../../assets/images/relicsIcon/mysticaloracleeye.png'),
    rarity: 'Uncommon', effectFamily: 'spirit', primaryColor: '#C026D3', secondaryColor: '#22D3EE',
    particleColors: ['#C026D3', '#22D3EE', '#F0ABFC'], xp: 35,
    lore: 'Its unblinking gaze remembers paths that have not yet been walked.', mapPlacement: { distanceFeet: 720, bearingDegrees: 335 },
  },
  emeraldHeart: {
    id: 'emerald-heart', name: 'Emerald Heart', icon: require('../../assets/images/relicsIcon/emeraldheart.png'),
    rarity: 'Epic', effectFamily: 'nature', primaryColor: '#10B981', secondaryColor: '#A3E635',
    particleColors: ['#10B981', '#A3E635', '#D9F99D'], xp: 75,
    lore: 'The living pulse of an ancient forest rests within its facets.', mapPlacement: { distanceFeet: 950, bearingDegrees: 25 },
  },
  magmaCrown: {
    id: 'magma-crown', name: 'Magma Crown', icon: require('../../assets/images/relicsIcon/magmacrown.png'),
    rarity: 'Legendary', effectFamily: 'fire', primaryColor: '#EF4444', secondaryColor: '#F59E0B',
    particleColors: ['#EF4444', '#F59E0B', '#FDE68A'], xp: 100,
    lore: 'Forged below the mountains for a ruler who commanded rivers of flame.', mapPlacement: { distanceFeet: 1070, bearingDegrees: 95 },
  },
  radiantSolarSun: {
    id: 'radiant-solar-sun', name: 'Radiant Solar Sun', icon: require('../../assets/images/relicsIcon/radiantsolarsun.png'),
    rarity: 'Epic', effectFamily: 'solar', primaryColor: '#FBBF24', secondaryColor: '#FB7185',
    particleColors: ['#FBBF24', '#FB7185', '#FFF7AE'], xp: 75,
    lore: 'A miniature dawn that never cools and never sets.', mapPlacement: { distanceFeet: 1380, bearingDegrees: 155 },
  },
  ancientMysticalCoin: {
    id: 'ancient-mystical-coin', name: 'Ancient Mystical Coin', icon: require('../../assets/images/relicsIcon/ancientmysticalcoin.png'),
    rarity: 'Common', effectFamily: 'ancient', primaryColor: '#D6A84B', secondaryColor: '#7C4A1D',
    particleColors: ['#D6A84B', '#FDE68A', '#92400E'], xp: 20,
    lore: 'Its two faces promise fortune to explorers brave enough to spend neither.', mapPlacement: { distanceFeet: 1510, bearingDegrees: 205 },
  },
  fossilFang: {
    id: 'fossil-fang', name: 'Fossil Fang', icon: require('../../assets/images/relicsIcon/fossilfang.png'),
    rarity: 'Common', effectFamily: 'ancient', primaryColor: '#D6D3D1', secondaryColor: '#A16207',
    particleColors: ['#D6D3D1', '#F5F5F4', '#A16207'], xp: 20,
    lore: 'A stone fang from a predator older than the first marked trail.', mapPlacement: { distanceFeet: 1660, bearingDegrees: 265 },
  },
  dreamcapSpore: {
    id: 'dreamcap-spore', name: 'Dreamcap Spore', icon: require('../../assets/images/relicsIcon/dreamcapspore.png'),
    rarity: 'Common', effectFamily: 'nature', primaryColor: '#D946EF', secondaryColor: '#4ADE80',
    particleColors: ['#D946EF', '#4ADE80', '#F0ABFC'], xp: 20,
    lore: 'A luminous spore said to grow wherever a traveler dreams outdoors.', mapPlacement: { distanceFeet: 1940, bearingDegrees: 345 },
  },
  levitatingArmoredSeed: {
    id: 'levitating-armored-seed', name: 'Levitating Armored Seed', icon: require('../../assets/images/relicsIcon/levitatingarmoredseed.png'),
    rarity: 'Uncommon', effectFamily: 'nature', primaryColor: '#84CC16', secondaryColor: '#64748B',
    particleColors: ['#84CC16', '#BEF264', '#94A3B8'], xp: 35,
    lore: 'Protected by living armor until it finds soil worthy of its roots.', mapPlacement: { distanceFeet: 2100, bearingDegrees: 40 },
  },
  dragonFlameScale: {
    id: 'dragon-flame-scale', name: 'Dragon Flame Scale', icon: require('../../assets/images/relicsIcon/dragonflamescale.png'),
    rarity: 'Legendary', effectFamily: 'dragon', primaryColor: '#F43F5E', secondaryColor: '#F97316',
    particleColors: ['#F43F5E', '#F97316', '#FDE047'], xp: 100,
    lore: 'A single scale still warm with the breath of a skyborne titan.', mapPlacement: { distanceFeet: 2260, bearingDegrees: 120 },
  },
  elegantGlassFlower: {
    id: 'elegant-glass-flower', name: 'Elegant Glass Flower', icon: require('../../assets/images/relicsIcon/elegantglassflower.png'),
    rarity: 'Uncommon', effectFamily: 'prismatic', primaryColor: '#F9A8D4', secondaryColor: '#67E8F9',
    particleColors: ['#F9A8D4', '#67E8F9', '#FFFFFF'], xp: 35,
    lore: 'Every translucent petal bends the world into a different color.', mapPlacement: { distanceFeet: 2420, bearingDegrees: 175 },
  },
  titanStone: {
    id: 'titan-stone', name: 'Titan Stone', icon: require('../../assets/images/relicsIcon/titanstone.png'),
    rarity: 'Common', effectFamily: 'ancient', primaryColor: '#A8A29E', secondaryColor: '#57534E',
    particleColors: ['#A8A29E', '#D6D3D1', '#78716C'], xp: 20,
    lore: 'A weathered fragment chipped from the armor of a sleeping colossus.', mapPlacement: { distanceFeet: 2580, bearingDegrees: 230 },
  },
  premiumSirenShell: {
    id: 'premium-siren-shell', name: 'Premium Siren Shell', icon: require('../../assets/images/relicsIcon/premiumsirenshell.png'),
    rarity: 'Legendary', effectFamily: 'ocean', primaryColor: '#EC4899', secondaryColor: '#22D3EE',
    particleColors: ['#EC4899', '#22D3EE', '#FCE7F3'], xp: 100,
    lore: 'Hold it close and a distant, impossible song rises from the surf.', mapPlacement: { distanceFeet: 2740, bearingDegrees: 300 },
  },
  tidekeeperTrident: {
    id: 'tidekeeper-trident', name: 'Tidekeeper Trident', icon: require('../../assets/images/relicsIcon/tidekeepertrident.png'),
    rarity: 'Legendary', effectFamily: 'ocean', primaryColor: '#06B6D4', secondaryColor: '#1D4ED8',
    particleColors: ['#06B6D4', '#60A5FA', '#A5F3FC'], xp: 100,
    lore: 'A ceremonial key to the hidden roads beneath the ocean.', mapPlacement: { distanceFeet: 2900, bearingDegrees: 355 },
  },
  frostRuneIceTablet: {
    id: 'frost-rune-ice-tablet', name: 'Frost Rune Ice Tablet', icon: require('../../assets/images/relicsIcon/frostruneicetablet.png'),
    rarity: 'Epic', effectFamily: 'ice', primaryColor: '#7DD3FC', secondaryColor: '#A5B4FC',
    particleColors: ['#7DD3FC', '#E0F2FE', '#A5B4FC'], xp: 75,
    lore: 'Runes remain frozen on its surface even beneath the summer sun.', mapPlacement: { distanceFeet: 3060, bearingDegrees: 55 },
  },
  meteorHeart: {
    id: 'meteor-heart', name: 'Meteor Heart', icon: require('../../assets/images/relicsIcon/meteorheart.png'),
    rarity: 'Legendary', effectFamily: 'cosmic', primaryColor: '#F97316', secondaryColor: '#7C3AED',
    particleColors: ['#F97316', '#FDE047', '#7C3AED'], xp: 100,
    lore: 'The molten center of a voyager that fell burning through the heavens.', mapPlacement: { distanceFeet: 3220, bearingDegrees: 105 },
  },
  eternalFlame: {
    id: 'eternal-flame', name: 'Eternal Flame', icon: require('../../assets/images/relicsIcon/eternalflame.png'),
    rarity: 'Legendary', effectFamily: 'fire', primaryColor: '#FB3B13', secondaryColor: '#FACC15',
    particleColors: ['#FB3B13', '#F97316', '#FACC15'], xp: 100,
    lore: 'A flame without fuel, sheltered through centuries by forgotten hands.', mapPlacement: { distanceFeet: 3380, bearingDegrees: 160 },
  },
  saturnSeal: {
    id: 'saturn-seal', name: 'Saturn Seal', icon: require('../../assets/images/relicsIcon/saturnseal.png'),
    rarity: 'Epic', effectFamily: 'cosmic', primaryColor: '#EAB308', secondaryColor: '#8B5CF6',
    particleColors: ['#EAB308', '#8B5CF6', '#FDE68A'], xp: 75,
    lore: 'Its rings chart an orbit no telescope has ever witnessed.', mapPlacement: { distanceFeet: 3540, bearingDegrees: 220 },
  },
  astralBeacon: {
    id: 'astral-beacon', name: 'Astral Beacon', icon: require('../../assets/images/relicsIcon/astralbeacon.png'),
    rarity: 'Epic', effectFamily: 'cosmic', primaryColor: '#A855F7', secondaryColor: '#22D3EE',
    particleColors: ['#A855F7', '#22D3EE', '#F5D0FE'], xp: 75,
    lore: 'A signal fire for explorers moving between stars and stories.', mapPlacement: { distanceFeet: 3700, bearingDegrees: 275 },
  },
  solarCrown: {
    id: 'solar-crown', name: 'Solar Crown', icon: require('../../assets/images/relicsIcon/solarcrown.png'),
    rarity: 'Legendary', effectFamily: 'solar', primaryColor: '#FACC15', secondaryColor: '#F97316',
    particleColors: ['#FACC15', '#F97316', '#FEF3C7'], xp: 100,
    lore: 'The bright diadem of a monarch who ruled only at midday.', mapPlacement: { distanceFeet: 3860, bearingDegrees: 325 },
  },
  darkMoon: {
    id: 'dark-moon', name: 'Dark Moon', icon: require('../../assets/images/relicsIcon/darkmoon.png'),
    rarity: 'Epic', effectFamily: 'void', primaryColor: '#6366F1', secondaryColor: '#111827',
    particleColors: ['#6366F1', '#A78BFA', '#334155'], xp: 75,
    lore: 'A moon-shaped absence that dims nearby starlight.', mapPlacement: { distanceFeet: 4020, bearingDegrees: 15 },
  },
  cometTear: {
    id: 'comet-tear', name: 'Comet Tear', icon: require('../../assets/images/relicsIcon/comettear.png'),
    rarity: 'Rare', effectFamily: 'cosmic', primaryColor: '#38BDF8', secondaryColor: '#F472B6',
    particleColors: ['#38BDF8', '#F472B6', '#E0F2FE'], xp: 50,
    lore: 'A frozen droplet left behind by a comet crossing the night.', mapPlacement: { distanceFeet: 4180, bearingDegrees: 65 },
  },
  ancientTempleKey: {
    id: 'ancient-temple-key', name: 'Ancient Temple Key', icon: require('../../assets/images/relicsIcon/ancienttemplekey.png'),
    rarity: 'Rare', effectFamily: 'ancient', primaryColor: '#D4A373', secondaryColor: '#78350F',
    particleColors: ['#D4A373', '#FDE68A', '#92400E'], xp: 50,
    lore: 'Its teeth fit a doorway that has not been found for a thousand years.', mapPlacement: { distanceFeet: 4340, bearingDegrees: 115 },
  },
  celestialKey: {
    id: 'celestial-key', name: 'Celestial Key', icon: require('../../assets/images/relicsIcon/celestialkey.png'),
    rarity: 'Legendary', effectFamily: 'cosmic', primaryColor: '#93C5FD', secondaryColor: '#F9A8D4',
    particleColors: ['#93C5FD', '#F9A8D4', '#FFFFFF'], xp: 100,
    lore: 'A key cut for a lock hidden somewhere beyond the visible sky.', mapPlacement: { distanceFeet: 4500, bearingDegrees: 170 },
  },
  ancientProphecyScroll: {
    id: 'ancient-prophecy-scroll', name: 'Ancient Prophecy Scroll', icon: require('../../assets/images/relicsIcon/ancientprophecyscroll.png'),
    rarity: 'Epic', effectFamily: 'ancient', primaryColor: '#E7C27D', secondaryColor: '#9A3412',
    particleColors: ['#E7C27D', '#FDE68A', '#9A3412'], xp: 75,
    lore: 'Its final line appears only after the reader chooses a direction.', mapPlacement: { distanceFeet: 4660, bearingDegrees: 225 },
  },
  eternalHourglass: {
    id: 'eternal-hourglass', name: 'Eternal Hourglass', icon: require('../../assets/images/relicsIcon/eternalhourglass.png'),
    rarity: 'Legendary', effectFamily: 'time', primaryColor: '#F59E0B', secondaryColor: '#8B5CF6',
    particleColors: ['#F59E0B', '#FDE68A', '#8B5CF6'], xp: 100,
    lore: 'Its silver sand falls upward whenever a forgotten moment returns.', mapPlacement: { distanceFeet: 4820, bearingDegrees: 285 },
  },
  sentinelCrest: {
    id: 'sentinel-crest', name: 'Sentinel Crest', icon: require('../../assets/images/relicsIcon/sentinelcrest.png'),
    rarity: 'Uncommon', effectFamily: 'ancient', primaryColor: '#94A3B8', secondaryColor: '#FBBF24',
    particleColors: ['#94A3B8', '#FBBF24', '#E2E8F0'], xp: 35,
    lore: 'The crest of a guardian whose watch continued long after the gate vanished.', mapPlacement: { distanceFeet: 4980, bearingDegrees: 340 },
  },
  crimsonDragonSoul: {
    id: 'crimson-dragon-soul', name: 'Crimson Dragon Soul', icon: require('../../assets/images/relicsIcon/crimsondragonsoul.png'),
    rarity: 'Legendary', effectFamily: 'dragon', primaryColor: '#DC2626', secondaryColor: '#F59E0B',
    particleColors: ['#DC2626', '#FB7185', '#F59E0B'], xp: 100,
    lore: 'A fierce ember of memory from the last crimson dragon.', mapPlacement: { distanceFeet: 5140, bearingDegrees: 30 },
  },
  ancientSpiritMask: {
    id: 'ancient-spirit-mask', name: 'Ancient Spirit Mask', icon: require('../../assets/images/relicsIcon/ancientspiritmask.png'),
    rarity: 'Epic', effectFamily: 'spirit', primaryColor: '#14B8A6', secondaryColor: '#A78BFA',
    particleColors: ['#14B8A6', '#A78BFA', '#CCFBF1'], xp: 75,
    lore: 'Whispers gather behind its eyes whenever the forest becomes still.', mapPlacement: { distanceFeet: 5300, bearingDegrees: 85 },
  },
  crownOfAges: {
    id: 'crown-of-ages', name: 'Crown of Ages', icon: require('../../assets/images/relicsIcon/crownofages.png'),
    rarity: 'Legendary', effectFamily: 'time', primaryColor: '#F6C453', secondaryColor: '#7C3AED',
    particleColors: ['#F6C453', '#7C3AED', '#FEF3C7'], xp: 100,
    lore: 'Every era left one mark upon this crown before passing into legend.', mapPlacement: { distanceFeet: 5460, bearingDegrees: 135 },
  },
  creationTear: {
    id: 'creation-tear', name: 'Creation Tear', icon: require('../../assets/images/relicsIcon/creationtear.png'),
    rarity: 'Legendary', effectFamily: 'prismatic', primaryColor: '#22D3EE', secondaryColor: '#F472B6',
    particleColors: ['#22D3EE', '#F472B6', '#A78BFA'], xp: 100,
    lore: 'A luminous drop said to have fallen when the first horizon formed.', mapPlacement: { distanceFeet: 5620, bearingDegrees: 190 },
  },
  comicEgg: {
    id: 'comic-egg', name: 'Cosmic Egg', icon: require('../../assets/images/relicsIcon/comicegg.png'),
    rarity: 'Epic', effectFamily: 'cosmic', primaryColor: '#A78BFA', secondaryColor: '#34D399',
    particleColors: ['#A78BFA', '#34D399', '#F9A8D4'], xp: 75,
    lore: 'No scholar agrees what waits inside—or why it hums beneath starlight.', mapPlacement: { distanceFeet: 5780, bearingDegrees: 250 },
  },
  prismaticShard: {
    id: 'prismatic-shard', name: 'Prismatic Shard', icon: require('../../assets/images/relicsIcon/prismaticshard.png'),
    rarity: 'Legendary', effectFamily: 'prismatic', primaryColor: '#E879F9', secondaryColor: '#22D3EE',
    particleColors: ['#E879F9', '#22D3EE', '#FDE047'], xp: 100,
    lore: 'A splinter of pure color that paints the air as it turns.', mapPlacement: { distanceFeet: 5940, bearingDegrees: 305 },
  },
  voidPearl: {
    id: 'void-pearl', name: 'Void Pearl', icon: require('../../assets/images/relicsIcon/voidpearl.png'),
    rarity: 'Legendary', effectFamily: 'void', primaryColor: '#7C3AED', secondaryColor: '#0F172A',
    particleColors: ['#7C3AED', '#C084FC', '#334155'], xp: 100,
    lore: 'A perfect pearl formed around a single grain of nothingness.', mapPlacement: { distanceFeet: 6100, bearingDegrees: 350 },
  },
} satisfies Record<string, Relic>;

export const RELICS: Relic[] = Object.values(RELIC_ASSETS);
export const RELICS_BY_ID = Object.fromEntries(RELICS.map((relic) => [relic.id, relic])) as Record<string, Relic>;

export const COSMIC_SHARD = RELIC_ASSETS.cosmicShard;
export const UNDISCOVERED_RELIC_ICON = require('../../assets/images/relicsIcon/undiscovered.png');
