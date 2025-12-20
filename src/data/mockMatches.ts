// ⚠️ 关键点：这里必须有 'export' 关键字
export interface Analysis {
  signal: string;
  odds: number;
  confidence: number;
  guruComment?: string;
}

// ⚠️ 关键点：这里必须有 'export' 关键字，名字必须叫 'Match'
export interface Match {
  id: number;
  league: string;
  home: string;
  away: string;
  time: string;
  status: 'LIVE' | 'PRE_MATCH';
  score?: string;
  date?: string; // 比赛日期 (e.g., "December 20")
  homeLogo?: string; // 主队 logo URL
  awayLogo?: string; // 客队 logo URL
  isStarred: boolean;
  tags: string[]; // 这些 tags 只在 War Room 显示，主页不显示
  tagColor?: string;
  analysis: Analysis;
}

// Auto-generated from CSV data - Updated with colleague's Supabase data
export const MOCK_MATCHES: Match[] = [
  {
    id: 353,
    league: 'Premier League',
    home: 'Newcastle',
    away: 'Chelsea',
    time: '20:30',
    status: 'PRE_MATCH',
    isStarred: false,
    tags: ['🔥 Live'],
    tagColor: 'neon-blue',
    analysis: {
      signal: 'Away +0 (Level Ball) @1.92',
      odds: 1.5,
      confidence: 60,
      guruComment: 'Eh brader, tadi dah tekan (press) Chelsea (Away +0) 2.5 unit. Sekarang odds dan line sama saja, jangan itchy hand (手痒) lagi lah! Duduk diam-diam, tunggu gol! Ini盘口退让，主队水位又这样烂，很明显庄家要你冲Newcastle，我们不吃这一套'
    }
  },
  {
    id: 354,
    league: 'Premier League',
    home: 'Wolves',
    away: 'Brentford',
    time: '23:00',
    status: 'PRE_MATCH',
    isStarred: false,
    tags: ['📊 Analysis'],
    tagColor: 'neon-blue',
    analysis: {
      signal: 'N/A',
      odds: 1,
      confidence: 50,
      guruComment: ''
    }
  },
  {
    id: 355,
    league: 'Premier League',
    home: 'Manchester City',
    away: 'West Ham',
    time: '23:00',
    status: 'PRE_MATCH',
    isStarred: false,
    tags: ['📊 Analysis'],
    tagColor: 'neon-blue',
    analysis: {
      signal: 'N/A',
      odds: 1,
      confidence: 50,
      guruComment: ''
    }
  }
  // Note: Full dataset contains 50 matches. See generated file for complete list.
];