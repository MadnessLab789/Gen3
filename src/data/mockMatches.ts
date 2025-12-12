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
  isStarred: boolean;
  tags: string[];
  tagColor?: string;
  analysis: Analysis;
}

export const MOCK_MATCHES: Match[] = [
  {
    id: 1,
    league: 'Champions League',
    home: 'Arsenal',
    away: 'PSG',
    time: '20:45',
    status: 'PRE_MATCH',
    isStarred: false,
    tags: ['🔥 High Vol', '🐳 Whale Alert'],
    tagColor: 'neon-purple',
    analysis: {
      signal: 'OVER 2.5',
      odds: 1.95,
      confidence: 88,
      guruComment: 'Market indicates heavy volume on Over.'
    }
  },
  {
    id: 2,
    league: 'Premier League',
    home: 'Man City',
    away: 'Liverpool',
    time: 'LIVE 12\'',
    status: 'LIVE',
    score: '0-1',
    isStarred: true, 
    tags: ['⚡️ Sniper Signal'],
    tagColor: 'neon-green',
    analysis: {
      signal: 'HOME WIN',
      odds: 2.10,
      confidence: 92,
      guruComment: 'Early goal implies strong home comeback.'
    }
  },
  {
    id: 3,
    league: 'La Liga',
    home: 'Real Madrid',
    away: 'Getafe',
    time: '22:00',
    status: 'PRE_MATCH',
    isStarred: false,
    tags: ['🔒 Defense Heavy'],
    tagColor: 'neon-blue',
    analysis: {
      signal: 'UNDER 3.5',
      odds: 1.50,
      confidence: 75,
      guruComment: 'Defensive lineup confirmed.'
    }
  }
];