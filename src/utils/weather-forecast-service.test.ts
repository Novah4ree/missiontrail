import assert from 'node:assert/strict';
import test from 'node:test';

import {
  describeWeatherCode,
  parseTrailDailyForecast,
} from '../services/weather-forecast-service.ts';

test('maps WMO weather codes to readable trail conditions', () => {
  assert.equal(describeWeatherCode(0), 'Clear skies');
  assert.equal(describeWeatherCode(63), 'Rain');
  assert.equal(describeWeatherCode(95), 'Thunderstorms');
});

test('parses the first local forecast day and its safety metrics', () => {
  assert.deepEqual(parseTrailDailyForecast({
    daily: {
      time: ['2026-07-29'],
      weather_code: [2],
      temperature_2m_max: [78.4],
      temperature_2m_min: [61.1],
      precipitation_probability_max: [15],
      wind_speed_10m_max: [11.8],
      uv_index_max: [7.2],
    },
  }), {
    date: '2026-07-29',
    weatherCode: 2,
    summary: 'Partly cloudy',
    temperatureMaxF: 78.4,
    temperatureMinF: 61.1,
    precipitationProbabilityPercent: 15,
    windSpeedMaxMph: 11.8,
    uvIndexMax: 7.2,
  });
});

test('rejects incomplete forecast payloads', () => {
  assert.throws(
    () => parseTrailDailyForecast({ daily: { time: ['2026-07-29'] } }),
    /weather code/,
  );
});
