import { supabase } from '../../lib/supabase';

export type CompanionLifeStage = 'baby' | 'teen' | 'adult';

export type EggGrowthProgress = {
  hatchXp: number;
  hatchHp: number;
  hatchPoints: number;
  updatedAt: string | null;
};

export type HatchRegistrationResult = {
  registered: boolean;
  instanceId: string;
  companionId: string;
  activeCompanionId: string | null;
  eggXpTransferred: number;
  eggHpTransferred: number;
  companionLevel: number;
  lifeStage: CompanionLifeStage;
};

function safeNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export async function getEggGrowthProgress(): Promise<EggGrowthProgress> {
  const { data, error } = await supabase.rpc(
    'server_get_my_egg_growth_progress',
  );

  if (error) {
    throw error;
  }

  const result =
    data && typeof data === 'object'
      ? (data as Record<string, unknown>)
      : {};

  return {
    hatchXp: safeNumber(result.hatchXp),
    hatchHp: safeNumber(result.hatchHp),
    hatchPoints: safeNumber(result.hatchPoints),
    updatedAt:
      typeof result.updatedAt === 'string'
        ? result.updatedAt
        : null,
  };
}

export async function registerHatchedCompanion(input: {
  instanceId: string;
  companionId: string;
  eggId: string;
  hatchedAt?: string;
}): Promise<HatchRegistrationResult> {
  const { data, error } = await supabase.rpc(
    'server_register_hatched_companion',
    {
      p_instance_id: input.instanceId,
      p_companion_id: input.companionId,
      p_egg_id: input.eggId,
      p_hatched_at:
        input.hatchedAt ?? new Date().toISOString(),
    },
  );

  if (error) {
    throw error;
  }

  const result =
    data && typeof data === 'object'
      ? (data as Record<string, unknown>)
      : {};

  return {
    registered: Boolean(result.registered),
    instanceId: String(result.instanceId ?? input.instanceId),
    companionId: String(result.companionId ?? input.companionId),
    activeCompanionId:
      typeof result.activeCompanionId === 'string'
        ? result.activeCompanionId
        : null,
    eggXpTransferred: safeNumber(result.eggXpTransferred),
    eggHpTransferred: safeNumber(result.eggHpTransferred),
    companionLevel: Math.max(
      1,
      Math.floor(safeNumber(result.companionLevel) || 1),
    ),
    lifeStage:
      result.lifeStage === 'teen' || result.lifeStage === 'adult'
        ? result.lifeStage
        : 'baby',
  };
}

export function formatLifeStage(stage: CompanionLifeStage) {
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}
