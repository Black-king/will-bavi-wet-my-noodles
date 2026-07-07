import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  createQWeatherJwt,
  extractForecastTrack,
  extractObservedTrack,
  extractStormList,
  normalizeQWeatherApiHost,
  normalizeQWeatherData,
  pickCurrentBaviStorm
} from '../src/qweather-normalize.js';

const OUTPUT_PATH = 'data/typhoon-bavi.json';

async function main() {
  const config = readConfig(process.env);
  const token = createQWeatherJwt({
    projectId: config.projectId,
    credentialId: config.credentialId,
    privateKeyPem: config.privateKeyPem,
    nowSeconds: Math.floor(Date.now() / 1000) - 30
  });

  const listPayload = await requestQWeatherJson(config, token, '/v7/tropical/storm-list', {
    basin: config.basin,
    year: String(config.year)
  });
  const storm = pickCurrentBaviStorm(extractStormList(listPayload), config.year);

  if (!storm) {
    throw new Error(`No active/current Bavi storm found in QWeather ${config.year} ${config.basin} storm list.`);
  }

  const stormId = storm.id ?? storm.stormId ?? storm.stormid ?? storm.tcid;
  if (!stormId) {
    throw new Error('Selected Bavi storm does not contain a storm id.');
  }

  const [trackPayload, forecastPayload] = await Promise.all([
    requestQWeatherJson(config, token, '/v7/tropical/storm-track', { stormid: stormId }),
    requestQWeatherJson(config, token, '/v7/tropical/storm-forecast', { stormid: stormId })
  ]);
  const data = normalizeQWeatherData({
    storm,
    observedTrack: extractObservedTrack(trackPayload),
    forecastTrack: extractForecastTrack(forecastPayload),
    updatedAt: new Date().toISOString()
  });

  if (config.dryRun) {
    console.log(JSON.stringify({
      stormId: data.meta.stormId,
      points: data.track.length,
      updatedAt: data.meta.updatedAt
    }, null, 2));
    return;
  }

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`Updated ${OUTPUT_PATH} with ${data.track.length} QWeather track points.`);
}

function readConfig(env) {
  const projectId = requiredEnv(env, 'QWEATHER_PROJECT_ID');
  const credentialId = env.QWEATHER_CREDENTIAL_ID || env.QWEATHER_KEY_ID;
  const privateKeyPem = requiredEnv(env, 'QWEATHER_PRIVATE_KEY').replace(/\\n/g, '\n');

  if (!credentialId) {
    throw new Error('Missing QWEATHER_CREDENTIAL_ID.');
  }

  return {
    projectId,
    credentialId,
    privateKeyPem,
    apiHost: normalizeQWeatherApiHost(env.QWEATHER_API_HOST || 'https://devapi.qweather.com'),
    basin: env.QWEATHER_BASIN || 'NP',
    year: Number(env.QWEATHER_YEAR || new Date().getFullYear()),
    dryRun: process.argv.includes('--dry-run')
  };
}

async function requestQWeatherJson(config, token, pathname, params) {
  const url = new URL(pathname, config.apiHost);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'User-Agent': 'will-bavi-wet-my-noodles-github-actions'
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`QWeather ${pathname} failed with ${response.status}: ${body.slice(0, 300)}`);
  }

  const payload = await response.json();
  const code = payload.code ? String(payload.code) : '200';
  if (code !== '200') {
    throw new Error(`QWeather ${pathname} returned code ${code}: ${JSON.stringify(payload).slice(0, 300)}`);
  }

  return payload;
}

function requiredEnv(env, name) {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }

  return value;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
