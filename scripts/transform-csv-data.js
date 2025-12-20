import fs from 'fs';
import path from 'path';

// File paths
const prematchesPath = '/Users/dd/Downloads/prematches_rows.csv';
const handicapPath = '/Users/dd/Downloads/Handicap_rows (1).csv';
const overUnderPath = '/Users/dd/Downloads/OverUnder_rows (1).csv';
const moneylinePath = '/Users/dd/Downloads/moneyline 1x2_rows (1).csv';

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    if (values.length >= headers.length) {
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });
      rows.push(row);
    }
  }
  
  return rows;
}

// Parse all CSV files
const prematches = parseCSV(prematchesPath);
const handicaps = parseCSV(handicapPath);
const overUnders = parseCSV(overUnderPath);
const moneylines = parseCSV(moneylinePath);

console.log(`Parsed: ${prematches.length} matches, ${handicaps.length} handicaps, ${overUnders.length} over/unders, ${moneylines.length} moneylines`);

// Helper function to format time
function formatTime(dateStr) {
  if (!dateStr) return 'TBD';
  try {
    const date = new Date(dateStr);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return 'TBD';
  }
}

// Helper function to determine status
function getStatus(statusShort, statusElapsed) {
  if (statusShort === 'FT' || statusShort === 'NS') {
    return 'PRE_MATCH';
  }
  if (statusShort === 'LIVE' || (statusElapsed && parseInt(statusElapsed) > 0)) {
    return 'LIVE';
  }
  return 'PRE_MATCH';
}

// Helper function to format score
function formatScore(goalsHome, goalsAway, statusShort) {
  // Always show score if goals exist, even for NS (not started) matches
  if (goalsHome !== undefined && goalsAway !== undefined && goalsHome !== null && goalsAway !== null) {
    return `${goalsHome}-${goalsAway}`;
  }
  return undefined;
}

// Helper function to format date
function formatDate(dateStr) {
  if (!dateStr) return undefined;
  try {
    const date = new Date(dateStr);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const day = date.getDate();
    return `${months[date.getMonth()]} ${day}`;
  } catch {
    return undefined;
  }
}

// Transform prematches to Match format
const transformedMatches = prematches.map((pm, idx) => {
  const status = getStatus(pm.status_short, pm.status_elapsed);
  const score = formatScore(pm.goals_home, pm.goals_away, pm.status_short);
  
  // Find the latest signal for this fixture
  const fixtureId = parseInt(pm.fixture_id) || parseInt(pm.id);
  
  // Get latest signals for this fixture (try to match by fixture_id)
  const latestHandicap = handicaps
    .filter(h => {
      const hFixtureId = parseInt(h.fixture_id);
      return hFixtureId === fixtureId;
    })
    .sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
      const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
      return dateB - dateA;
    })[0];
  
  const latestOverUnder = overUnders
    .filter(ou => {
      const ouFixtureId = parseInt(ou.fixture_id);
      return ouFixtureId === fixtureId;
    })
    .sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
      const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
      return dateB - dateA;
    })[0];
  
  const latestMoneyline = moneylines
    .filter(m => {
      const mFixtureId = parseInt(m.fixture_id);
      return mFixtureId === fixtureId;
    })
    .sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
      const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
      return dateB - dateA;
    })[0];
  
  // Determine which signal to use (priority: handicap > over/under > moneyline)
  // Include "持仓" signals but mark them differently
  let signal = 'N/A';
  let odds = 1.0;
  let confidence = 50;
  let guruComment = '';
  
  if (latestHandicap && latestHandicap.signal) {
    signal = latestHandicap.selection || `Handicap ${latestHandicap.line}`;
    odds = parseFloat(latestHandicap.home_odds || latestHandicap.away_odds || 1.88) || 1.88;
    if (latestHandicap.signal.includes('🟢')) confidence = 85;
    else if (latestHandicap.signal.includes('🔥')) confidence = 90;
    else if (latestHandicap.signal.includes('持仓')) confidence = 60;
    else confidence = 70;
    guruComment = latestHandicap.commentary_malaysia || latestHandicap.stacking_plan_description || '';
  } else if (latestOverUnder && latestOverUnder.signal) {
    signal = `Over ${latestOverUnder.line}`;
    odds = parseFloat(latestOverUnder.over || 1.88) || 1.88;
    if (latestOverUnder.signal.includes('🟢')) confidence = 85;
    else if (latestOverUnder.signal.includes('持仓')) confidence = 60;
    else confidence = 70;
    guruComment = latestOverUnder.commentary_malaysia || latestOverUnder.stacking_plan_description || '';
  } else if (latestMoneyline && latestMoneyline.signal) {
    signal = latestMoneyline.selection || 'Home Win';
    odds = parseFloat(latestMoneyline.moneyline_1x2_home || latestMoneyline.moneyline_1x2_away || 2.0) || 2.0;
    if (latestMoneyline.signal.includes('🟢')) confidence = 85;
    else if (latestMoneyline.signal.includes('🔥')) confidence = 90;
    else if (latestMoneyline.signal.includes('坐稳')) confidence = 60;
    else confidence = 70;
    guruComment = latestMoneyline.commentary_malaysia || latestMoneyline.stacking_plan_description || '';
  }
  
  // Determine tags
  const tags = [];
  if (pm.type === 'In Play') tags.push('🔥 Live');
  if (confidence >= 85) tags.push('⚡️ High Confidence');
  if (odds >= 2.0) tags.push('💎 Value Bet');
  
  const match = {
    id: parseInt(pm.id) || idx + 1,
    league: pm.league_name || 'Unknown League',
    home: pm.home_name || 'Home',
    away: pm.away_name || 'Away',
    time: status === 'LIVE' && pm.status_elapsed ? `LIVE ${pm.status_elapsed}'` : formatTime(pm.start_date_msia),
    status: status,
    isStarred: false,
    tags: tags.length > 0 ? tags : [], // Tags are for War Room only, not displayed on home page
    tagColor: confidence >= 85 ? 'neon-green' : confidence >= 70 ? 'neon-purple' : 'neon-blue',
    analysis: {
      signal: signal,
      odds: odds,
      confidence: confidence,
      guruComment: guruComment.substring(0, 200) // Limit length
    }
  };
  
  // Add optional fields
  if (score) {
    match.score = score;
  }
  
  const formattedDate = formatDate(pm.start_date_msia);
  if (formattedDate) {
    match.date = formattedDate;
  }
  
  if (pm.home_logo) {
    match.homeLogo = pm.home_logo;
  }
  
  if (pm.away_logo) {
    match.awayLogo = pm.away_logo;
  }
  
  return match;
});

// Transform signals to SignalItem format
const transformedSignals = [];

// Add handicap signals (include all except pure "观望")
handicaps.forEach((h, idx) => {
  if (h.signal && !h.signal.includes('观望')) {
    const pm = prematches.find(p => (parseInt(p.fixture_id) || p.id) === (parseInt(h.fixture_id) || h.id));
    transformedSignals.push({
      id: transformedSignals.length + 1,
      type: 'analysis',
      category: 'hdp',
      league: h.league_name || 'Unknown',
      time: h.clock ? `LIVE ${h.clock}'` : 'PRE',
      status: h.clock ? 'LIVE' : 'PRE_MATCH',
      timestamp: h.clock ? `${h.clock}'` : 'PRE',
      title: `${h.home_name} vs ${h.away_name}`,
      strategy: h.signal,
      suggestion: h.selection || `Line ${h.line}`,
      reasoning: h.market_analysis_trend_direction || h.stacking_plan_description || '',
      stats: [
        `趋势: ${h.market_analysis_trend_direction || 'N/A'}`,
        `变盘: ${h.market_analysis_odds_check || 'N/A'}`,
        `抽水: ${h.market_analysis_vig_status || 'N/A'}`
      ],
      guruComment: h.commentary_malaysia || h.stacking_plan_description || ''
    });
  }
});

// Add over/under signals (include all except pure "观望")
overUnders.forEach((ou, idx) => {
  if (ou.signal && !ou.signal.includes('观望')) {
    transformedSignals.push({
      id: transformedSignals.length + 1,
      type: 'analysis',
      category: 'ou',
      league: ou.league_name || 'Unknown',
      time: ou.clock ? `LIVE ${ou.clock}'` : 'PRE',
      status: ou.clock ? 'LIVE' : 'PRE_MATCH',
      timestamp: ou.clock ? `${ou.clock}'` : 'PRE',
      title: `${ou.home_name} vs ${ou.away_name}`,
      strategy: ou.signal,
      suggestion: `Over ${ou.line}`,
      reasoning: ou.market_analysis_trend_direction || ou.stacking_plan_description || '',
      stats: [
        `趋势: ${ou.market_analysis_trend_direction || 'N/A'}`,
        `变盘: ${ou.market_analysis_odds_check || 'N/A'}`,
        `抽水: ${ou.market_analysis_vig_status || 'N/A'}`
      ],
      guruComment: ou.commentary_malaysia || ou.stacking_plan_description || ''
    });
  }
});

// Add moneyline signals (include all except pure "观望")
moneylines.forEach((m, idx) => {
  if (m.signal && !m.signal.includes('观望')) {
    transformedSignals.push({
      id: transformedSignals.length + 1,
      type: 'sniper',
      category: '1x2',
      league: m.league_name || 'Unknown',
      time: m.clock ? `LIVE ${m.clock}'` : 'PRE',
      status: m.clock ? 'LIVE' : 'PRE_MATCH',
      timestamp: m.clock ? `${m.clock}'` : 'PRE',
      title: `${m.home_name} vs ${m.away_name}`,
      market: m.selection || 'Home Win',
      odds: parseFloat(m.moneyline_1x2_home || m.moneyline_1x2_away || 2.0),
      unit: '+1',
      statusText: 'Active 🎯'
    });
  }
});

// Helper function to remove undefined values
function cleanObject(obj) {
  if (Array.isArray(obj)) {
    return obj.map(cleanObject);
  }
  if (typeof obj === 'object' && obj !== null) {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanObject(value);
      }
    }
    return cleaned;
  }
  return obj;
}

// Generate TypeScript code
const cleanedMatches = transformedMatches.slice(0, 50).map(cleanObject);
const cleanedInitialMatches = transformedMatches.slice(0, 20).map(cleanObject);
const cleanedSignals = transformedSignals.slice(0, 100).map(cleanObject);

// Helper to escape single quotes in strings
function escapeQuotes(str) {
  return str.replace(/'/g, "\\'");
}

// Format as TypeScript with proper quote handling
function formatAsTS(obj, indent = 0) {
  const spaces = '  '.repeat(indent);
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    const items = obj.map(item => `${spaces}  ${formatAsTS(item, indent + 1)}`).join(',\n');
    return `[\n${items}\n${spaces}]`;
  }
  if (typeof obj === 'object' && obj !== null) {
    const entries = Object.entries(obj);
    if (entries.length === 0) return '{}';
    const props = entries.map(([key, value]) => {
      const formatted = formatAsTS(value, indent + 1);
      return `${spaces}  ${key}: ${formatted}`;
    }).join(',\n');
    return `{\n${props}\n${spaces}}`;
  }
  if (typeof obj === 'string') {
    // Use template literals for strings with quotes or special chars
    if (obj.includes("'") || obj.includes('\n')) {
      return `\`${obj.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\``;
    }
    return `'${obj}'`;
  }
  return String(obj);
}

const matchesCode = `// Auto-generated from CSV data - ${new Date().toISOString()}
export const MOCK_MATCHES: Match[] = ${formatAsTS(cleanedMatches)};

export const INITIAL_MATCHES: Match[] = ${formatAsTS(cleanedInitialMatches)};
`;

const signalsCode = `// Auto-generated from CSV data - ${new Date().toISOString()}
export const MOCK_SIGNALS: SignalItem[] = ${formatAsTS(cleanedSignals)};
`;

// Write output files
fs.writeFileSync('/tmp/transformed_matches.ts', matchesCode);
fs.writeFileSync('/tmp/transformed_signals.ts', signalsCode);

console.log(`\n✅ Generated ${transformedMatches.length} matches`);
console.log(`✅ Generated ${transformedSignals.length} signals`);
console.log(`\n📁 Output files:`);
console.log(`   - /tmp/transformed_matches.ts`);
console.log(`   - /tmp/transformed_signals.ts`);

