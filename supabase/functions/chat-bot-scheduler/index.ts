// Supabase Edge Function: chat-bot-scheduler
// Randomly posts a "persona" message into public.chat_messages.
//
// Stadium Mode:
// - Inserts into public.chat_messages using (sender_id, sender_type, nickname, avatar_url, content).
// - Uses negative sender_id for personas so they look like "humans" in UI.
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
// NOTE: Supabase CLI blocks secrets starting with "SUPABASE_".
// Use SERVICE_ROLE_KEY as the project secret name.
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
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
  sender_id: number;
  sender_type: 'bot' | 'user';
  nickname: string;
  avatar_url?: string | null;
  content: string;
}) {
  const { supabase, ...payload } = params;
  const res = await supabase.from('chat_messages').insert(payload as any);
  return { error: res.error };
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ success: false, error: 'Missing SUPABASE_URL or SERVICE_ROLE_KEY' }, 500);
  }

  // Optional: protect from public abuse
  if (CRON_SECRET) {
    const got = req.headers.get('x-cron-secret') ?? '';
    if (got !== CRON_SECRET) return json({ success: false, error: 'Unauthorized' }, 401);
  }

  try {
    // 2) Parse request payload (Payload Mode)
    // If caller provides (content, nickname, sender_id), we prioritize that payload.
    // If body is empty/invalid (cron), we fall back to the random bot behavior.
    const body = (await req.json().catch(() => null)) as any;

    const hasPayload =
      body &&
      typeof body.content === 'string' &&
      body.content.trim().length > 0 &&
      typeof body.nickname === 'string' &&
      body.nickname.trim().length > 0 &&
      typeof body.sender_id === 'number' &&
      Number.isFinite(body.sender_id);

    // 3) Init Supabase client (Service Role to bypass RLS writes)
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    if (hasPayload) {
      const sender_type =
        body?.sender_type === 'user' || body?.sender_type === 'bot' ? (body.sender_type as 'user' | 'bot') : 'bot';
      const avatar_url = typeof body?.avatar_url === 'string' && body.avatar_url.trim().length > 0 ? body.avatar_url : null;

      const { error } = await insertMessage({
        supabase,
        sender_id: body.sender_id,
        sender_type,
        nickname: body.nickname,
        avatar_url,
        content: body.content,
      });

      if (error) throw error;
      return json({ success: true, mode: 'payload', sender_id: body.sender_id, sender_type, nickname: body.nickname });
    }

    // 3b) Random mode (cron/default): choose script set + probability
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

    // 4) Choose script by room
    const selectedPersona = room_id === 'war-room' ? pickRandom(WAR_ROOM_BOTS) : pickRandom(GLOBAL_BOTS);
    const selectedMessage = room_id === 'war-room' ? pickRandom(WAR_ROOM_MESSAGES) : pickRandom(GLOBAL_MESSAGES);

    // 5) Insert into DB
    const { error } = await insertMessage({
      supabase,
      sender_id: selectedPersona.id,
      sender_type: 'bot',
      nickname: selectedPersona.name,
      avatar_url: null,
      content: selectedMessage,
    });

    if (error) throw error;

    return json({ success: true, mode: 'random', room: room_id, bot: selectedPersona.name });
  } catch (error: any) {
    return json({ success: false, error: error?.message ?? String(error) }, 500);
  }
});


