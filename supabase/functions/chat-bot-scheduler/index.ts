// Supabase Edge Function: chat-bot-scheduler
// Randomly posts a "persona" message into public.chat_messages.
//
// - Supports two rooms via request body: { room_id: 'global' | 'war-room' }
// - Uses negative telegram_id for personas so they look like "humans" in UI.
//
// Deploy:
//   supabase functions deploy chat-bot-scheduler
//
// Optional auth:
//   Set CRON_SECRET and call with header: x-cron-secret: <CRON_SECRET>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

// 1) Personas + messages (Global)
const GLOBAL_BOTS = [
  { name: 'SoccerKing', id: -101 },
  { name: 'CityFan99', id: -102 },
  { name: 'BetHunter', id: -103 },
  { name: 'Alex_K', id: -104 },
  { name: 'OddsWatcher', id: -105 },
  { name: 'LineMover', id: -106 },
  { name: 'WhaleRadar', id: -107 },
  { name: 'ValueHunt', id: -108 },
  { name: 'SharpTalk', id: -109 },
  { name: 'EPL_Insider', id: -110 },
];

const GLOBAL_MESSAGES = [
  'Odds are dropping fast!',
  'Ref is absolutely blind today.',
  "I'm going all in on Home.",
  'Anyone following the copy trade?',
  'What a save!',
  'That line move is crazy…',
  'Late goal incoming, I can feel it.',
  'Volume spike just hit the book.',
  'HDP looks safer than 1X2 here.',
  'Keep an eye on corners — tempo is rising.',
];

// 2) Personas + messages (War Room)
const WAR_ROOM_BOTS = [
  { name: 'OddsFlow_AI', id: -999 },
  { name: 'SmartMoney_Bot', id: -998 },
  { name: 'Risk_Manager', id: -997 },
  { name: 'LiquidityScanner', id: -996 },
  { name: 'LineWatch', id: -995 },
];

const WAR_ROOM_MESSAGES = [
  '🚨 Volatility alert detected on the current match.',
  '📉 Home Win odds dropped sharply in the last 10 mins.',
  'Target acquired: Heavy volume on Over 2.5.',
  'Market sentiment shifting toward Away.',
  'Liquidity spike detected — watch the next tick.',
  'HDP pressure building…',
  'OU line is being defended by the book.',
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function insertMessage(params: {
  supabase: ReturnType<typeof createClient>;
  telegram_id: number;
  username: string;
  content: string;
  room_id: string;
}) {
  const { supabase, ...payload } = params;

  // Try insert including type='text' (if column exists), otherwise fallback.
  const tryWithType = await supabase
    .from('chat_messages')
    .insert({ ...payload, type: 'text' } as any);

  if (!tryWithType.error) return { error: null as any };

  const msg = String((tryWithType.error as any)?.message ?? '').toLowerCase();
  const typeColumnMissing = msg.includes('column') && msg.includes('type');
  if (!typeColumnMissing) return { error: tryWithType.error };

  const tryWithoutType = await supabase.from('chat_messages').insert(payload as any);
  return { error: tryWithoutType.error };
}

Deno.serve(async (req) => {
  // Handle CORS
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
    // 2) Parse request payload (choose room + probability)
    const body = (await req.json().catch(() => ({}))) as any;
    const room_id = body?.room_id === 'war-room' ? 'war-room' : 'global';
    const send_probability_raw = Number(body?.send_probability ?? 1.0);
    const send_probability =
      Number.isFinite(send_probability_raw) && send_probability_raw >= 0 && send_probability_raw <= 1
        ? send_probability_raw
        : 1.0;

    // Random skip mechanism (natural timing)
    if (Math.random() > send_probability) {
      return json({ success: true, skipped: true, room: room_id });
    }

    // 3) Choose script by room
    const selectedPersona = room_id === 'war-room' ? pickRandom(WAR_ROOM_BOTS) : pickRandom(GLOBAL_BOTS);
    const selectedMessage = room_id === 'war-room' ? pickRandom(WAR_ROOM_MESSAGES) : pickRandom(GLOBAL_MESSAGES);

    // 4) Init Supabase client (Service Role to bypass RLS writes)
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 5) Insert into DB
    const { error } = await insertMessage({
      supabase,
      telegram_id: selectedPersona.id,
      username: selectedPersona.name,
      content: selectedMessage,
      room_id,
    });

    if (error) throw error;

    return json({ success: true, room: room_id, bot: selectedPersona.name });
  } catch (error: any) {
    return json({ success: false, error: error?.message ?? String(error) }, 500);
  }
});


