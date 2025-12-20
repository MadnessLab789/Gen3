// 从 Supabase 获取同事数据的脚本
// 使用方法: node scripts/fetch-from-supabase.mjs

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 从环境变量读取配置
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ 错误: 请设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY 环境变量');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fetchMatches() {
  console.log('📊 正在获取比赛数据...\n');

  try {
    // 查询比赛数据
    // 注意：根据实际表结构调整字段名
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('❌ 查询错误:', error.message);
      console.log('\n可能的原因:');
      console.log('1. 表名不是 "matches"');
      console.log('2. 字段名不匹配');
      console.log('3. RLS 策略阻止了查询');
      return null;
    }

    console.log(`✅ 获取到 ${data?.length || 0} 条比赛数据\n`);
    return data;
  } catch (err) {
    console.error('❌ 发生错误:', err);
    return null;
  }
}

async function fetchSignals() {
  console.log('📊 正在获取信号数据...\n');

  try {
    // 查询信号数据
    // 注意：根据实际表结构调整字段名
    const { data, error } = await supabase
      .from('signals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('❌ 查询错误:', error.message);
      console.log('\n可能的原因:');
      console.log('1. 表名不是 "signals"');
      console.log('2. 字段名不匹配');
      console.log('3. RLS 策略阻止了查询');
      return null;
    }

    console.log(`✅ 获取到 ${data?.length || 0} 条信号数据\n`);
    return data;
  } catch (err) {
    console.error('❌ 发生错误:', err);
    return null;
  }
}

async function main() {
  console.log('🔍 开始从 Supabase 获取同事的数据...\n');

  // 获取比赛数据
  const matches = await fetchMatches();
  if (matches) {
    const matchesPath = path.join(__dirname, '../data/colleague-matches.json');
    fs.writeFileSync(matchesPath, JSON.stringify(matches, null, 2));
    console.log(`✅ 比赛数据已保存到: ${matchesPath}\n`);
  }

  // 获取信号数据
  const signals = await fetchSignals();
  if (signals) {
    const signalsPath = path.join(__dirname, '../data/colleague-signals.json');
    fs.writeFileSync(signalsPath, JSON.stringify(signals, null, 2));
    console.log(`✅ 信号数据已保存到: ${signalsPath}\n`);
  }

  if (matches || signals) {
    console.log('📝 下一步:');
    console.log('1. 检查生成的数据文件');
    console.log('2. 确认数据格式正确');
    console.log('3. 告诉我可以开始更新代码了');
  } else {
    console.log('\n💡 提示:');
    console.log('如果表名或字段名不同，请提供正确的表结构信息');
    console.log('我可以根据实际表结构调整查询脚本');
  }
}

main();

