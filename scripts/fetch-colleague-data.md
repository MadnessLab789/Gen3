# 从 Supabase 获取同事数据的指南

## 目标
从 Supabase 数据库中获取同事的以下数据：
1. **INITIAL_MATCHES** - 第一页的 live/prematch 比赛数据
2. **MOCK_SIGNALS** - War Room 的 Sniper Action 和 Full Analysis 数据

## 步骤 1: 在 Supabase Dashboard 中查询数据

### 1.1 查询比赛数据 (INITIAL_MATCHES)

登录 [Supabase Dashboard](https://app.supabase.com)，进入 SQL Editor，执行以下查询：

```sql
-- 查询所有比赛数据（用于第一页显示）
SELECT 
  id,
  league,
  home,
  away,
  time,
  status,
  score,
  is_starred as "isStarred",
  tags,
  tag_color as "tagColor",
  signal as "analysis.signal",
  odds as "analysis.odds",
  confidence as "analysis.confidence",
  guru_comment as "analysis.guruComment"
FROM matches
ORDER BY created_at DESC
LIMIT 20;
```

**或者如果表结构不同，先查看表结构：**
```sql
-- 查看 matches 表结构
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'matches';
```

### 1.2 查询信号数据 (MOCK_SIGNALS)

```sql
-- 查询 Sniper Action 和 Full Analysis 数据
SELECT 
  id,
  type,
  category,
  league,
  time,
  status,
  timestamp,
  title,
  market,
  odds,
  unit,
  status_text as "statusText",
  strategy,
  suggestion,
  reasoning,
  stats,
  guru_comment as "guruComment"
FROM signals
ORDER BY created_at DESC
LIMIT 20;
```

**或者查看 signals 表结构：**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'signals';
```

## 步骤 2: 导出数据

### 方法 A: 使用 Supabase Dashboard
1. 在 SQL Editor 中执行查询
2. 点击结果下方的 "Download CSV" 或 "Copy" 按钮
3. 将数据保存为 JSON 或 CSV 格式

### 方法 B: 使用 Supabase MCP（如果可用）
可以直接通过 MCP 工具查询数据

### 方法 C: 使用 SQL 导出为 JSON
```sql
-- 导出为 JSON 格式
SELECT json_agg(row_to_json(t))
FROM (
  SELECT * FROM matches ORDER BY created_at DESC LIMIT 20
) t;
```

## 步骤 3: 数据格式转换

获取数据后，需要转换为代码格式：

### INITIAL_MATCHES 格式示例：
```typescript
const INITIAL_MATCHES: Match[] = [
  {
    id: 1,
    league: 'Champions League',
    home: 'Arsenal',
    away: 'PSG',
    time: '20:45',
    status: 'PRE_MATCH', // 或 'LIVE'
    score: undefined, // 或 '0-1'
    isStarred: false,
    tags: ['🔥 High Vol'],
    tagColor: 'neon-purple',
    analysis: {
      signal: 'OVER 2.5',
      odds: 1.95,
      confidence: 88,
      guruComment: 'Market indicates heavy volume.',
    },
    chartData: generateWaveData(), // 这个函数需要保留
  },
  // ... 更多比赛
];
```

### MOCK_SIGNALS 格式示例：
```typescript
const MOCK_SIGNALS: SignalItem[] = [
  {
    id: 1,
    type: 'sniper', // 或 'analysis'
    category: '1x2', // 或 'hdp', 'ou'
    league: 'UEFA CL',
    time: "LIVE 23'",
    status: 'LIVE',
    timestamp: "23'",
    title: 'Qarabağ vs Ajax',
    market: 'AWAY WIN', // 仅 sniper 类型需要
    odds: 3.29, // 仅 sniper 类型需要
    unit: '+1', // 仅 sniper 类型需要
    statusText: 'Holding 💼', // 仅 sniper 类型需要
    strategy: '🟢 追主队', // 仅 analysis 类型需要
    suggestion: 'Home -0.25', // 仅 analysis 类型需要
    reasoning: '...', // 仅 analysis 类型需要
    stats: [...], // 仅 analysis 类型需要
    guruComment: '...', // 仅 analysis 类型需要
  },
  // ... 更多信号
];
```

## 步骤 4: 更新代码

获取数据后，我可以帮你：
1. 将 Supabase 数据转换为 TypeScript 格式
2. 更新 `src/App.tsx` 中的 `INITIAL_MATCHES`
3. 更新 `src/components/WarRoom.tsx` 中的 `MOCK_SIGNALS`
4. 确保所有 Chat 功能代码保持不变

## 快速交接方式

**选项 1: 直接提供 SQL 查询结果**
- 同事在 Supabase Dashboard 执行查询
- 复制查询结果（JSON 或 CSV）
- 你提供给我，我帮你转换并更新代码

**选项 2: 提供表结构信息**
- 同事提供表结构（字段名、数据类型）
- 我创建查询脚本
- 你执行查询后提供结果

**选项 3: 使用 Supabase API**
- 我可以创建一个脚本，直接从 Supabase API 获取数据
- 自动转换为代码格式

## 需要的信息

请提供以下信息之一：
1. **SQL 查询结果**（JSON 或 CSV 格式）
2. **表结构信息**（字段名和类型）
3. **表名**（如果与 `matches` 和 `signals` 不同）

