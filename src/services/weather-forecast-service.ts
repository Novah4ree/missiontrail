export type TrailDailyForecast = {
  date: string;
  weatherCode: number;
  summary: string;
  temperatureMaxF: number;
  temperatureMinF: number;
  precipitationProbabilityPercent: number;
  windSpeedMaxMph: number;
  uvIndexMax: number;
};

type OpenMeteoDailyResponse = {
  daily?: {
    time?: unknown;
    weather_code?: unknown;
    temperature_2m_max?: unknown;
    temperature_2m_min?: unknown;
    precipitation_probability_max?: unknown;
    wind_speed_10m_max?: unknown;
    uv_index_max?: unknown;
  };
};

function firstFiniteNumber(value: unknown, field: string) {
  const first = Array.isArray(value) ? value[0] : undefined;
  if (typeof first !== 'number' || !Number.isFinite(first)) {
    throw new Error(`Forecast response is missing ${field}.`);
  }
  return first;
}

function firstString(value: unknown, field: string) {
  const first = Array.isArray(value) ? value[0] : undefined;
  if (typeof first !== 'string' || !first) {
    throw new Error(`Forecast response is missing ${field}.`);
  }
  return first;
}

export function describeWeatherCode(code: number) {
  if (code === 0) return 'Clear skies';
  if (code === 1) return 'Mostly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 85 && code <= 86) return 'Snow showers';
  if (code >= 95 && code <= 99) return 'Thunderstorms';
  return 'Mixed conditions';
}

export function parseTrailDailyForecast(data: OpenMeteoDailyResponse): TrailDailyForecast {
  const daily = data.daily;
  if (!daily) throw new Error('Forecast response is missing daily weather.');

  const weatherCode = firstFiniteNumber(daily.weather_code, 'weather code');
  return {
    date: firstString(daily.time, 'date'),
    weatherCode,
    summary: describeWeatherCode(weatherCode),
    temperatureMaxF: firstFiniteNumber(daily.temperature_2m_max, 'high temperature'),
    temperatureMinF: firstFiniteNumber(daily.temperature_2m_min, 'low temperature'),
    precipitationProbabilityPercent: firstFiniteNumber(
      daily.precipitation_probability_max,
      'precipitation probability',
    ),
    windSpeedMaxMph: firstFiniteNumber(daily.wind_speed_10m_max, 'wind speed'),
    uvIndexMax: firstFiniteNumber(daily.uv_index_max, 'UV index'),
  };
}

export async function getTrailDailyForecast(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
      'wind_speed_10m_max',
      'uv_index_max',
    ].join(','),
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    timezone: 'auto',
    forecast_days: '1',
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`, { signal });
  if (!response.ok) throw new Error(`Forecast request failed with status ${response.status}.`);
  return parseTrailDailyForecast(await response.json() as OpenMeteoDailyResponse);
}
