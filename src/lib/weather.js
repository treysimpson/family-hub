// Open-Meteo — free, no API key. https://open-meteo.com/en/docs
const WESTMINSTER_CO = { latitude: 39.8367, longitude: -105.0372, timezone: 'America/Denver' };

// WMO weather codes -> {icon, desc}, matching the icon set used throughout the app.
const WMO = {
  0: ['☀️', 'Sunny'],
  1: ['🌤️', 'Mostly sunny'],
  2: ['⛅', 'Partly cloudy'],
  3: ['🌥️', 'Cloudy'],
  45: ['🌫️', 'Foggy'],
  48: ['🌫️', 'Foggy'],
  51: ['🌦️', 'Light drizzle'],
  53: ['🌦️', 'Drizzle'],
  55: ['🌦️', 'Heavy drizzle'],
  56: ['🌧️', 'Freezing drizzle'],
  57: ['🌧️', 'Freezing drizzle'],
  61: ['🌧️', 'Light rain'],
  63: ['🌧️', 'Rain'],
  65: ['🌧️', 'Heavy rain'],
  66: ['🌧️', 'Freezing rain'],
  67: ['🌧️', 'Freezing rain'],
  71: ['❄️', 'Light snow'],
  73: ['❄️', 'Snow'],
  75: ['❄️', 'Heavy snow'],
  77: ['❄️', 'Snow grains'],
  80: ['🌦️', 'Rain showers'],
  81: ['🌦️', 'Rain showers'],
  82: ['🌦️', 'Heavy rain showers'],
  85: ['❄️', 'Snow showers'],
  86: ['❄️', 'Snow showers'],
  95: ['⛈️', 'Thunderstorms'],
  96: ['⛈️', 'Thunderstorms'],
  99: ['⛈️', 'Thunderstorms'],
};

const WMO_NIGHT_ICONS = { 0: '🌙', 1: '🌙', 2: '☁️' };

function iconFor(code, isDay = true) {
  if (!isDay && WMO_NIGHT_ICONS[code]) return WMO_NIGHT_ICONS[code];
  return (WMO[code] || WMO[2])[0];
}
function descFor(code, isDay = true) {
  if (!isDay && code === 0) return 'Clear';
  return (WMO[code] || WMO[2])[1];
}

function uvLabel(uv) {
  if (uv >= 11) return `${Math.round(uv)} Extreme`;
  if (uv >= 8) return `${Math.round(uv)} Very High`;
  if (uv >= 6) return `${Math.round(uv)} High`;
  if (uv >= 3) return `${Math.round(uv)} Moderate`;
  return `${Math.round(uv)} Low`;
}

function degToCompass(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

function hourLabel(iso, isNow) {
  if (isNow) return 'Now';
  const d = new Date(iso);
  let h = d.getHours();
  const suffix = h >= 12 ? 'p' : 'a';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}${suffix}`;
}

function timeLabel(iso) {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? 'p' : 'a';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')}${suffix}`;
}

function dayLabel(iso, index) {
  if (index === 0) return 'Today';
  return new Date(iso).toLocaleDateString([], { weekday: 'short' });
}

function fullDayLabel(iso) {
  return new Date(iso).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

export async function fetchWeather({ latitude, longitude, timezone } = WESTMINSTER_CO) {
  const params = new URLSearchParams({
    latitude, longitude, timezone,
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    forecast_days: 8,
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,is_day',
    hourly: 'temperature_2m,weather_code,precipitation_probability,visibility,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max,wind_speed_10m_max,wind_direction_10m_dominant',
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Weather request failed: ${res.status}`);
  const data = await res.json();

  const nowHourIndex = data.hourly.time.findIndex((t) => t === data.current.time.slice(0, 13) + ':00')
    ?? 0;
  const visibilityMeters = data.hourly.visibility?.[Math.max(nowHourIndex, 0)];
  const visibilityMiles = visibilityMeters != null ? Math.round(visibilityMeters / 1609.34) : null;

  const isDayNow = data.current.is_day === 1;
  const now = {
    icon: iconFor(data.current.weather_code, isDayNow),
    temp: Math.round(data.current.temperature_2m),
    desc: descFor(data.current.weather_code, isDayNow),
    location: 'Westminster, CO',
    feelsLike: Math.round(data.current.apparent_temperature),
    high: Math.round(data.daily.temperature_2m_max[0]),
    low: Math.round(data.daily.temperature_2m_min[0]),
    humidity: `${Math.round(data.current.relative_humidity_2m)}%`,
    wind: `${Math.round(data.current.wind_speed_10m)} mph ${degToCompass(data.current.wind_direction_10m)}`,
    uv: uvLabel(data.daily.uv_index_max[0]),
    visibility: visibilityMiles != null ? `${visibilityMiles} mi` : '—',
    sunrise: timeLabel(data.daily.sunrise[0]),
    sunset: timeLabel(data.daily.sunset[0]),
  };

  const hourlyStartIdx = Math.max(nowHourIndex, 0);
  const hourly = data.hourly.time.slice(hourlyStartIdx, hourlyStartIdx + 12).map((t, i) => ({
    time: hourLabel(t, i === 0),
    icon: iconFor(data.hourly.weather_code[hourlyStartIdx + i], data.hourly.is_day[hourlyStartIdx + i] === 1),
    temp: Math.round(data.hourly.temperature_2m[hourlyStartIdx + i]),
    pop: data.hourly.precipitation_probability[hourlyStartIdx + i] > 5
      ? `${data.hourly.precipitation_probability[hourlyStartIdx + i]}%` : '',
  }));

  const allHis = data.daily.temperature_2m_max;
  const allLos = data.daily.temperature_2m_min;
  const globalMax = Math.max(...allHis);
  const globalMin = Math.min(...allLos);
  const range = globalMax - globalMin || 1;

  const daily = data.daily.time.slice(0, 7).map((dateStr, i) => {
    const hi = Math.round(data.daily.temperature_2m_max[i]);
    const lo = Math.round(data.daily.temperature_2m_min[i]);
    const dayStartIdx = data.hourly.time.findIndex((t) => t.startsWith(dateStr));
    const dayHourly = dayStartIdx === -1 ? [] : [0, 2, 4, 6, 8, 10, 12, 14]
      .map((offset) => dayStartIdx + offset)
      .filter((idx) => idx < data.hourly.time.length)
      .map((idx) => [
        hourLabel(data.hourly.time[idx]),
        iconFor(data.hourly.weather_code[idx], data.hourly.is_day[idx] === 1),
        `${Math.round(data.hourly.temperature_2m[idx])}°`,
        data.hourly.precipitation_probability[idx] > 5 ? `${data.hourly.precipitation_probability[idx]}%` : '',
      ]);

    return {
      date: dateStr,
      day: dayLabel(dateStr, i),
      name: fullDayLabel(dateStr),
      icon: iconFor(data.daily.weather_code[i]),
      desc: descFor(data.daily.weather_code[i]),
      hi, lo,
      barWidth: Math.round(((hi - lo) / range) * 100),
      barOffset: Math.round(((lo - globalMin) / range) * 100),
      humidity: now.humidity,
      wind: `${Math.round(data.daily.wind_speed_10m_max[i])} mph ${degToCompass(data.daily.wind_direction_10m_dominant[i])}`,
      uv: uvLabel(data.daily.uv_index_max[i]),
      sunrise: timeLabel(data.daily.sunrise[i]),
      sunset: timeLabel(data.daily.sunset[i]),
      hourly: dayHourly,
    };
  });

  return { now, hourly, daily };
}
