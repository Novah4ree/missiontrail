import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../app/mission.tsx'),
  'utf8',
);
const liveMapSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../app/home-backup.tsx'),
  'utf8',
);
const trailsSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../app/trails.tsx'),
  'utf8',
);
const dashboardComponentSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../components/missions/mission-dashboard-sections.tsx'),
  'utf8',
);
const profileSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../app/profile.tsx'),
  'utf8',
);
const leaderboardSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../app/leaderboard.tsx'),
  'utf8',
);
const activityProviderSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../providers/activity-progress-provider.tsx'),
  'utf8',
);

test('dashboard sections follow the requested above-the-fold order', () => {
  const overview = source.indexOf('<AdventureOverview');
  const missions = source.indexOf('<DailyMissionSection');
  const explore = source.indexOf('<ExploreAction');
  const relics = source.indexOf('<RelicUnlocks');
  const companion = source.indexOf('<CompanionStatus');
  const level = source.indexOf('<ExplorerLevel');
  assert.ok(overview < missions);
  assert.ok(missions < explore);
  assert.ok(explore < relics);
  assert.ok(relics < companion);
  assert.ok(companion < level);
});

test('production mission UI contains no fake activity, weather, streak, or Health controls', () => {
  assert.doesNotMatch(source, /morning walk|perfect weather|peaceful trail nearby/i);
  assert.doesNotMatch(source, /7XP Streak|420XP|Add Health App Walks|Health app walks/i);
  assert.doesNotMatch(source, /StatBox/);
});

test('simulator relic controls are guarded out of production builds', () => {
  assert.match(
    liveMapSource,
    /const ENABLE_RELIC_TEST_MODE\s*=\s*\n?\s*__DEV__ && process\.env\.EXPO_PUBLIC_ENABLE_RELIC_TEST_MODE === 'true'/,
  );
});

test('screen uses shared progression, persisted companion, and activity sources', () => {
  assert.match(source, /getPlayerLevelProgress\(progress\?\.totalXp/);
  assert.match(source, /progress\?\.companion/);
  assert.match(source, /activity\.todaySteps/);
  assert.match(source, /activity\.todayDistanceMiles/);
});

test('every screen that displays the current player level uses the shared engine', () => {
  assert.match(source, /getPlayerLevelProgress\(progress\?\.totalXp/);
  assert.match(profileSource, /getPlayerLevelProgress\(progress\?\.totalXp/);
  assert.match(leaderboardSource, /getPlayerLevelProgress\(progress\?\.totalXp/);
  assert.doesNotMatch(leaderboardSource, /level:\s*42/);
});

test('companion, calorie, streak, and XP labels describe their real categories', () => {
  assert.match(dashboardComponentSource, /No active companion\. Visit the Companion screen to choose one\./);
  assert.match(dashboardComponentSource, /estimated active calories/);
  assert.match(dashboardComponentSource, /XP available/);
  assert.match(dashboardComponentSource, /XP ready to claim/);
  assert.match(dashboardComponentSource, /XP earned/);
  assert.match(dashboardComponentSource, /-Day Streak/);
  assert.doesNotMatch(dashboardComponentSource, /\bBurn\b|7XP Streak|420XP/i);
});

test('companion and level cards do not render zero placeholders while loading', () => {
  assert.match(dashboardComponentSource, /Loading companion status…/);
  assert.match(dashboardComponentSource, /Loading player progression…/);
  assert.match(dashboardComponentSource, /Level … • … XP/);
  assert.match(source, /Loading today’s adventure…/);
});

test('the empty mission state uses the complete recovery guidance', () => {
  assert.match(
    dashboardComponentSource,
    /No missions are available yet\. Pull to refresh or try again shortly\./,
  );
});

test('Start Exploring opens Trails focused on the nearest GPS-sorted trail', () => {
  assert.match(source, /pathname:\s*'\/trails'/);
  assert.match(source, /params:\s*\{\s*focus:\s*'nearest'\s*\}/);
  assert.match(trailsSource, /focus !== 'nearest'/);
  assert.match(trailsSource, /const nearestTrail = discovery\.trails\[0\]/);
  assert.match(trailsSource, /discovery\.locationStatus !== 'granted'/);
});

test('the mission screen respects safe areas', () => {
  assert.match(source, /useSafeAreaInsets/);
  assert.match(source, /paddingTop: safeArea\.top/);
  assert.match(source, /paddingBottom: safeArea\.bottom/);
});

test('activity and mission retries use separate refresh actions', () => {
  assert.match(source, /onRetryActivity=\{\(\) => void activity\.refreshActivity\(\)\}/);
  assert.match(source, /onRetry=\{\(\) => void refresh\(\)\}/);
});

test('activity and mission failures use the correct dashboard sections', () => {
  const overview = dashboardComponentSource.indexOf('export function AdventureOverview');
  const missions = dashboardComponentSource.indexOf('export function DailyMissionSection');
  const activityBanner = dashboardComponentSource.indexOf('styles.activityBanner', overview);
  const missionError = dashboardComponentSource.indexOf('Missions couldn’t be loaded.', missions);

  assert.ok(activityBanner > overview && activityBanner < missions);
  assert.ok(missionError > missions);
  assert.match(activityProviderSource, /Step tracking is unavailable on this device\./);
  assert.match(activityProviderSource, /Walking activity couldn’t update\./);
});

test('a missing native pedometer degrades gracefully instead of breaking every route', () => {
  assert.doesNotMatch(
    activityProviderSource,
    /import\s+\{\s*Pedometer\s*\}\s+from\s+['"]expo-sensors['"]/,
  );
  assert.match(activityProviderSource, /loadPedometerModule/);
  assert.match(activityProviderSource, /moduleEnvelope\.default/);
  assert.match(activityProviderSource, /if \(!Pedometer\)/);
  assert.match(activityProviderSource, /Step tracking is unavailable on this device\./);
});

test('mission cards use transparent vector icons and a large-text-safe reward row', () => {
  assert.match(dashboardComponentSource, /<Ionicons name=\{mission\.icon\}/);
  assert.match(dashboardComponentSource, /<View style=\{styles\.rewardRow\}>/);
  assert.doesNotMatch(dashboardComponentSource, /(?:icon|Icon).*['"`][\p{Extended_Pictographic}]/u);
});
