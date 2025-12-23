/**
 * Supabase Edge Function: chat-bot-scheduler (War Room "战况播报员")
 *
 * Writes AI match updates into `public.war_room_messages`.
 * It dynamically selects a LIVE fixture_id from `public.prematches` (type === 'inplay').
 *
 * Required columns on war_room_messages:
 * - fixture_id (bigint/int)
 * - sender_type (text)   => 'ai'
 * - sender_name (text)
 * - content (text)
 * - payload (jsonb)      => includes avatar_url
 *
 * Deploy:
 *   supabase functions deploy chat-bot-scheduler
 *
 * Optional auth:
 *   Set CRON_SECRET and call with header: x-cron-secret: <CRON_SECRET>
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

// Prefer Edge Function env vars; fallback to Vite env var name for local dev convenience.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('VITE_SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pixelAvatar(seed: string): string {
  // Deterministic-ish pixel icon using seed; kept tiny to avoid payload bloat
  const color = ['#7C4DFF', '#00E5FF', '#22C55E', '#F59E0B', '#EF4444'][
    Math.abs(seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 5
  ];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" shape-rendering="crispEdges">` +
    `<rect width="32" height="32" fill="#0b1220"/>` +
    `<rect x="6" y="6" width="20" height="20" rx="6" fill="#1f2a44"/>` +
    `<rect x="10" y="12" width="4" height="4" fill="${color}"/>` +
    `<rect x="18" y="12" width="4" height="4" fill="${color}"/>` +
    `<rect x="12" y="20" width="8" height="3" fill="${color}"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

type Persona = {
  sender_name: string;
  avatar_url: string;
  style: 'observer' | 'tactics' | 'market';
};

// “战况观察员”系列（像素头像 + 专业话术）
const PERSONAS: Persona[] = [
  { sender_name: '战况观察员-Alpha', avatar_url: pixelAvatar('alpha'), style: 'observer' },
  { sender_name: '战况观察员-Bravo', avatar_url: pixelAvatar('bravo'), style: 'tactics' },
  { sender_name: '战况观察员-Charlie', avatar_url: pixelAvatar('charlie'), style: 'market' },
  { sender_name: '战况观察员-Delta', avatar_url: pixelAvatar('delta'), style: 'observer' },
  { sender_name: '战况观察员-Echo', avatar_url: pixelAvatar('echo'), style: 'market' },
];

function buildCommentary(persona: Persona, match: any): string {
  const home = String(match?.home_name ?? 'Home');
  const away = String(match?.away_name ?? 'Away');
  const gh = Number(match?.goals_home ?? 0);
  const ga = Number(match?.goals_away ?? 0);
  const status = String(match?.status_short ?? match?.status ?? 'LIVE');
  const elapsed = match?.status_elapsed ?? match?.elapsed ?? null;
  const clock = elapsed !== null && elapsed !== undefined ? `${elapsed}'` : '';

  const score = `${gh}-${ga}`;

  if (persona.style === 'market') {
    return `【战况播报】${home} ${score} ${away} (${status} ${clock})｜盘口/水位波动加剧，建议关注下一次变盘的方向与回撤力度。`;
  }

  if (persona.style === 'tactics') {
    return `【战况播报】${home} ${score} ${away} (${status} ${clock})｜节奏变化明显，若持续压迫则下一次关键机会可能在 3-5 分钟内出现。`;
  }

  return `【战况播报】${home} ${score} ${away} (${status} ${clock})｜当前形势稳定，等待下一次关键事件（进球/红牌/重大变盘）触发信号更新。`;
}

async function pickInplayFixtureId(supabase: ReturnType<typeof createClient>) {
  // Requirement: type === 'inplay'
  const base = supabase
    .from('prematches')
    .select('fixture_id, home_name, away_name, goals_home, goals_away, status_short, status_elapsed, type')
    .limit(50);

  // 1) strict match
  const strict = await base.eq('type', 'inplay');
  if (strict.error) throw strict.error;
  if (Array.isArray(strict.data) && strict.data.length > 0) return pickRandom(strict.data);

  // 2) fallback: common variants (some datasets use "In Play")
  const fallback = await base.ilike('type', '%in%play%');
  if (fallback.error) throw fallback.error;
  if (Array.isArray(fallback.data) && fallback.data.length > 0) return pickRandom(fallback.data);

  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ success: false, error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  // Optional: protect from public abuse
  if (CRON_SECRET) {
    const got = req.headers.get('x-cron-secret') ?? '';
    if (got !== CRON_SECRET) return json({ success: false, error: 'Unauthorized' }, 401);
  }

  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const send_probability_raw = Number(body?.send_probability ?? 1.0);
    const send_probability =
      Number.isFinite(send_probability_raw) && send_probability_raw >= 0 && send_probability_raw <= 1
        ? send_probability_raw
        : 1.0;

    // Random skip mechanism (natural timing)
    if (Math.random() > send_probability) {
      return json({ success: true, skipped: true });
    }

    // Service Role client to bypass RLS writes
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Pick an inplay fixture
    const inplay = await pickInplayFixtureId(sb);
    if (!inplay) {
      return json({ success: true, skipped: true, reason: 'No inplay fixtures found in prematches' });
    }

    const fixture_id = Number(inplay.fixture_id);
    if (!Number.isFinite(fixture_id) || fixture_id <= 0) {
      return json({ success: false, error: `Invalid fixture_id from prematches: ${String(inplay.fixture_id)}` }, 500);
    }

    const persona = pickRandom(PERSONAS);
    const content = buildCommentary(persona, inplay);

    const insertPayload = {
      fixture_id,
      sender_type: 'ai',
      sender_name: persona.sender_name,
      content,
      payload: {
        avatar_url: persona.avatar_url,
        persona: 'war-room-reporter',
        source: 'chat-bot-scheduler',
      },
    };

    const { error } = await sb.from('war_room_messages').insert(insertPayload as any);
    if (error) throw error;

    return json({ success: true, fixture_id, sender_name: persona.sender_name });
  } catch (error: any) {
    return json({ success: false, error: error?.message ?? String(error) }, 500);
  }
});


