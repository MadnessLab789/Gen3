/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

type SeedMatch = {
  fixture_id: number;
  league_name: string;
  league_logo?: string | null;
  home_name: string;
  home_logo?: string | null;
  away_name: string;
  away_logo?: string | null;
  start_date_msia: string | number;
  status_short: string;
  score_home?: number | null;
  score_away?: number | null;
  venue_name?: string | null;
};

function toIsoTimestamptz(v: string | number) {
  if (typeof v === 'number' && Number.isFinite(v)) {
    const d = new Date(v);
    return d.toISOString();
  }
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${String(v)}`);
  return d.toISOString();
}

async function main() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL (or VITE_SUPABASE_URL) and SERVICE_ROLE_KEY (service role).');
  }

  const filePath = path.resolve(process.cwd(), 'matches_seed.json');
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) {
    console.warn('[seed-matches] matches_seed.json is empty — nothing to insert.');
    return;
  }

  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('matches_seed.json must be an array of match objects');

  const rows: SeedMatch[] = parsed;
  const payload = rows.map((m) => ({
    fixture_id: m.fixture_id,
    league_name: m.league_name,
    league_logo: m.league_logo ?? null,
    home_name: m.home_name,
    home_logo: m.home_logo ?? null,
    away_name: m.away_name,
    away_logo: m.away_logo ?? null,
    start_date: toIsoTimestamptz(m.start_date_msia),
    status_short: m.status_short,
    score_home: m.score_home ?? null,
    score_away: m.score_away ?? null,
    venue_name: m.venue_name ?? null,
  }));

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Upsert to handle reruns safely.
  const chunkSize = 250;
  for (let i = 0; i < payload.length; i += chunkSize) {
    const batch = payload.slice(i, i + chunkSize);
    const { error } = await supabase.from('matches').upsert(batch, { onConflict: 'fixture_id' });
    if (error) throw error;
    console.log(`[seed-matches] upserted ${i + batch.length}/${payload.length}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


