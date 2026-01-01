import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, Globe, Shield, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import countries from 'i18n-iso-countries';
import enCountries from 'i18n-iso-countries/langs/en.json';

type Prefs = {
  nationality: string;
  favoriteLeagues: string[];
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
    favoriteLeagues: [],
  });
  const [saving, setSaving] = useState(false);
  const [countryQuery, setCountryQuery] = useState('');
  const [countryOpen, setCountryOpen] = useState(false);
  const [nationalityTouched, setNationalityTouched] = useState(false);

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

  const countryList = useMemo(() => {
    try {
      countries.registerLocale(enCountries as any);
    } catch {
      // ignore
    }
    const names = countries.getNames('en', { select: 'official' }) as Record<string, string>;
    const toFlag = (code: string) =>
      code
        .toUpperCase()
        .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));

    return Object.entries(names)
      .map(([code, name]) => ({
        code: code.toUpperCase(),
        name,
        flag: toFlag(code),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return countryList.slice(0, 80);
    return countryList
      .filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
      .slice(0, 80);
  }, [countryList, countryQuery]);

  const leagues = [
    'Premier League',
    'Champions League',
    'La Liga',
    'Serie A',
    'Bundesliga',
    'Ligue 1',
  ];

  // Explicit setters (so Clear Cache can reset UI immediately with clear intent)
  const setNationality = (v: string) => setPrefs((p) => ({ ...p, nationality: v }));
  const setFavoriteLeagues = (v: string[]) => setPrefs((p) => ({ ...p, favoriteLeagues: v }));

  useEffect(() => {
    if (!sb) return;
    if (!Number.isFinite(telegramId) || telegramId <= 0) return;

    let cancelled = false;
    const load = async () => {
      const { data, error } = await sb
        .from('users')
        .select('nationality, favorite_leagues')
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
        favoriteLeagues: Array.isArray(row.favorite_leagues) ? row.favorite_leagues : prev.favoriteLeagues,
      }));
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [sb, telegramId]);

  // Auto-preset nationality via GeoIP (first open only, and only if empty)
  useEffect(() => {
    if (!sb) return;
    if (!Number.isFinite(telegramId) || telegramId <= 0) return;
    if (nationalityTouched) return;
    if (prefs.nationality && prefs.nationality.trim()) return;

    try {
      if (localStorage.getItem('oddsflow_geoip_preset_done') === '1') return;
    } catch {
      // ignore
    }

    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
        if (!res.ok) return;
        const data: any = await res.json();
        const code = String(data?.country_code ?? '').trim().toUpperCase();
        if (!code || code.length !== 2) return;
        if (cancelled) return;

        setPrefs((p) => ({ ...p, nationality: p.nationality ? p.nationality : code }));
        setCountryQuery('');
        try {
          localStorage.setItem('oddsflow_geoip_preset_done', '1');
        } catch {
          // ignore
        }
      } catch {
        // ignore
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [sb, telegramId, prefs.nationality, nationalityTouched]);

  const toggleLeague = (name: string) => {
    setPrefs((prev) => {
      const has = prev.favoriteLeagues.includes(name);
      return {
        ...prev,
        favoriteLeagues: has
          ? prev.favoriteLeagues.filter((x) => x !== name)
          : [...prev.favoriteLeagues, name],
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
        favorite_leagues: prefs.favoriteLeagues,
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
                <button
                  onClick={() => setCountryOpen((v) => !v)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white flex items-center justify-between hover:brightness-110 transition"
                >
                  <span className="font-data">
                    {prefs.nationality
                      ? (() => {
                          const found = countryList.find((c) => c.code === prefs.nationality.toUpperCase());
                          return found ? `${found.flag} ${found.name} (${found.code})` : prefs.nationality;
                        })()
                      : 'Select…'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>

                {countryOpen && (
                  <div className="absolute z-50 mt-2 w-full rounded-xl border border-white/10 bg-surface shadow-[0_0_20px_rgba(0,0,0,0.35)] overflow-hidden">
                    <div className="p-2 border-b border-white/10">
                      <input
                        value={countryQuery}
                        onChange={(e) => {
                          setCountryQuery(e.target.value);
                          setNationalityTouched(true);
                        }}
                        placeholder="Search country…"
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-[12px] text-white font-data"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {filteredCountries.map((c) => (
                        <button
                          key={c.code}
                          onClick={() => {
                            setPrefs((p) => ({ ...p, nationality: c.code }));
                            setNationalityTouched(true);
                            setCountryOpen(false);
                            setCountryQuery('');
                          }}
                          className="w-full px-4 py-2 text-left text-[12px] hover:bg-white/5 flex items-center gap-2"
                        >
                          <span className="w-6">{c.flag}</span>
                          <span className="flex-1 min-w-0 truncate">{c.name}</span>
                          <span className="text-gray-500 font-data">({c.code})</span>
                        </button>
                      ))}
                      {filteredCountries.length === 0 && (
                        <div className="px-4 py-3 text-[12px] text-gray-500 font-mono">No results.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-widest text-gray-500 font-mono mb-2">
                Favorite Games
              </div>
              <div className="flex flex-wrap gap-2">
                {leagues.map((l) => {
                  const active = prefs.favoriteLeagues.includes(l);
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

            <div className="text-[11px] text-gray-500 font-mono">
              Language & Currency can be added after the database fields are ready.
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
                const protectedKeys = [
                  // Supabase / Auth tokens (keep login)
                  'supabase.auth.token',
                  'sb-access-token',
                  'sb-refresh-token',
                  'auth-token',
                  'sb-',
                ];

                try {
                  // Explicitly remove known app keys
                  localStorage.removeItem('oddsflow_favorite_games');
                  localStorage.removeItem('oddsflow_favorite_leagues');
                  localStorage.removeItem('oddsflow_geoip_preset_done');

                  // Remove all oddsflow_* keys except protected auth tokens
                  Object.keys(localStorage).forEach((key) => {
                    const isProtected = protectedKeys.some((p) => key.includes(p));
                    if (isProtected) return;
                    if (key.startsWith('oddsflow_')) localStorage.removeItem(key);
                  });
                } catch {
                  // ignore
                }

                // Force reset in-memory state (even if DB persists preferences)
                setNationality('');
                setFavoriteLeagues([]);
                setCountryQuery('');
                setCountryOpen(false);
                setHideBalance(false);
                setIncognito(false);
                showAlert('Local cache cleared. UI reset.');
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


