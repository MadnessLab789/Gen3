import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, Globe, Shield, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

type Prefs = {
  nationality: string;
  favoriteGames: string[];
  language: string;
  currency: string;
};

function readBool(key: string, fallback = false) {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === '1' || v === 'true';
  } catch {
    return fallback;
  }
}

function writeBool(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // ignore
  }
}

export default function SettingsScreen(props: {
  telegramId: number;
  onBack: () => void;
  showAlert: (message: string) => void;
  onHideBalanceChange: (next: boolean) => void;
  onIncognitoChange: (next: boolean) => void;
}) {
  const { telegramId, onBack, showAlert, onHideBalanceChange, onIncognitoChange } = props;
  const sb = supabase;

  const [prefs, setPrefs] = useState<Prefs>({
    nationality: '',
    favoriteGames: [],
    language: 'EN',
    currency: 'USD',
  });
  const [saving, setSaving] = useState(false);

  const [hideBalance, setHideBalance] = useState<boolean>(() => readBool('oddsflow_hide_balance', false));
  const [incognito, setIncognito] = useState<boolean>(() => readBool('oddsflow_incognito_mode', false));

  useEffect(() => {
    onHideBalanceChange(hideBalance);
    writeBool('oddsflow_hide_balance', hideBalance);
  }, [hideBalance, onHideBalanceChange]);

  useEffect(() => {
    onIncognitoChange(incognito);
    writeBool('oddsflow_incognito_mode', incognito);
  }, [incognito, onIncognitoChange]);

  const appVersion = useMemo(() => {
    const v = (import.meta as any)?.env?.VITE_APP_VERSION;
    return String(v || 'v3');
  }, []);

  const leagues = [
    'Premier League',
    'Champions League',
    'La Liga',
    'Serie A',
    'Bundesliga',
    'Ligue 1',
  ];

  useEffect(() => {
    if (!sb) return;
    if (!Number.isFinite(telegramId) || telegramId <= 0) return;

    let cancelled = false;
    const load = async () => {
      const { data, error } = await sb
        .from('users')
        .select('nationality, favorite_games, language, currency')
        .eq('telegram_id', telegramId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.warn('[Settings] load users prefs failed (columns may be missing):', error);
        return;
      }

      const row: any = data ?? {};
      setPrefs((prev) => ({
        nationality: String(row.nationality ?? prev.nationality ?? ''),
        favoriteGames: Array.isArray(row.favorite_games) ? row.favorite_games : prev.favoriteGames,
        language: String(row.language ?? prev.language ?? 'EN'),
        currency: String(row.currency ?? prev.currency ?? 'USD'),
      }));
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [sb, telegramId]);

  const toggleLeague = (name: string) => {
    setPrefs((prev) => {
      const has = prev.favoriteGames.includes(name);
      return {
        ...prev,
        favoriteGames: has ? prev.favoriteGames.filter((x) => x !== name) : [...prev.favoriteGames, name],
      };
    });
  };

  const save = async () => {
    if (!sb) return;
    if (!Number.isFinite(telegramId) || telegramId <= 0) return;

    setSaving(true);
    try {
      const payload: any = {
        nationality: prefs.nationality,
        favorite_games: prefs.favoriteGames,
        language: prefs.language,
        currency: prefs.currency,
      };

      const { error } = await sb.from('users').update(payload).eq('telegram_id', telegramId);
      if (error) {
        console.warn('[Settings] update users failed:', error);
        showAlert('Failed to save settings (DB fields may be missing).');
        return;
      }

      showAlert('Settings saved.');
    } finally {
      setSaving(false);
    }
  };

  const Switch = (p: { value: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => p.onChange(!p.value)}
      className={`w-12 h-7 rounded-full transition flex items-center p-1 border border-white/10 ${
        p.value ? 'bg-neon-gold' : 'bg-white/10'
      }`}
      aria-label="Toggle"
    >
      <span
        className={`w-5 h-5 rounded-full bg-black transition-transform ${
          p.value ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-[96px] px-4 pt-6 max-w-md mx-auto relative font-sans">
      <header className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-xl transition" aria-label="Back">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-gray-500 font-mono">SETTINGS</div>
          <div className="text-lg font-black text-white truncate">Preferences</div>
        </div>
        <button
          onClick={() => void save()}
          disabled={saving || !sb}
          className="ml-auto h-9 px-4 rounded-xl text-xs font-black bg-neon-gold text-black hover:brightness-110 transition disabled:opacity-50 flex items-center gap-2"
        >
          <Check className="w-4 h-4" />
          SAVE
        </button>
      </header>

      {/* Preferences */}
      <div className="premium-card mb-4">
        <div className="premium-card-content">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-gray-500 font-mono">
            <Globe className="w-4 h-4 text-neon-gold" />
            Preferences
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-gray-500 font-mono mb-2">
                Nationality
              </div>
              <div className="relative">
                <select
                  value={prefs.nationality}
                  onChange={(e) => setPrefs((p) => ({ ...p, nationality: e.target.value }))}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white appearance-none"
                >
                  <option value="">Select…</option>
                  {['Malaysia', 'Singapore', 'Indonesia', 'Thailand', 'Vietnam', 'Philippines', 'Other'].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-500 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-widest text-gray-500 font-mono mb-2">
                Favorite Games
              </div>
              <div className="flex flex-wrap gap-2">
                {leagues.map((l) => {
                  const active = prefs.favoriteGames.includes(l);
                  return (
                    <button
                      key={l}
                      onClick={() => toggleLeague(l)}
                      className={`px-3 py-2 rounded-xl text-[11px] font-mono border transition ${
                        active
                          ? 'bg-neon-gold text-black border-neon-gold'
                          : 'bg-white/5 text-white border-white/10 hover:border-neon-gold/30'
                      }`}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-mono mb-2">
                  Language
                </div>
                <select
                  value={prefs.language}
                  onChange={(e) => setPrefs((p) => ({ ...p, language: e.target.value }))}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white"
                >
                  {['EN', 'CN', 'MY'].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-mono mb-2">
                  Currency
                </div>
                <select
                  value={prefs.currency}
                  onChange={(e) => setPrefs((p) => ({ ...p, currency: e.target.value }))}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white"
                >
                  {['USD', 'MYR', 'SGD'].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Privacy */}
      <div className="premium-card mb-4">
        <div className="premium-card-content">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-gray-500 font-mono">
            <Shield className="w-4 h-4 text-neon-gold" />
            Privacy
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-bold text-white">Hide Balance</div>
                <div className="text-[11px] text-gray-500 font-mono">
                  When enabled, Profile balance will display ******.
                </div>
              </div>
              <Switch value={hideBalance} onChange={setHideBalance} />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-bold text-white">Incognito Mode</div>
                <div className="text-[11px] text-gray-500 font-mono">Reduce on-screen identity traces.</div>
              </div>
              <Switch value={incognito} onChange={setIncognito} />
            </div>
          </div>
        </div>
      </div>

      {/* System & About */}
      <div className="premium-card">
        <div className="premium-card-content">
          <div className="text-[10px] uppercase tracking-widest text-gray-500 font-mono">System & About</div>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-white">App Version</div>
              <div className="text-[11px] text-gray-500 font-mono">{appVersion}</div>
            </div>
            <button
              onClick={() => {
                try {
                  localStorage.removeItem('oddsflow_hide_balance');
                  localStorage.removeItem('oddsflow_incognito_mode');
                } catch {
                  // ignore
                }
                setHideBalance(false);
                setIncognito(false);
                showAlert('Cache cleared.');
              }}
              className="h-9 px-4 rounded-xl text-xs font-black bg-white/5 border border-white/10 hover:brightness-110 transition flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4 text-neon-gold" />
              CLEAR CACHE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


