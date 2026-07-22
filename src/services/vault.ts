import { supabase } from '../../lib/supabase';
import { cacheServerCollections } from '@/utils/player-progress';

export async function syncServerVaultCache() {
  const { data, error } = await supabase
    .from('user_relic_collections')
    .select('relic_id, collected_at, xp_awarded')
    .order('collected_at', { ascending: true });
  if (error) throw new Error('Vault sync is temporarily unavailable');
  return cacheServerCollections((data ?? []).map((item) => ({
    relicId: item.relic_id,
    collectedAt: item.collected_at,
    xpAwarded: item.xp_awarded,
  })));
}
