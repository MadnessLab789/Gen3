// @ts-nocheck
"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// 1. 获取环境变量 (如果没有这些变量，控制台会报错)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 2. 初始化 Supabase
const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

export default function MatchList() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    async function fetchMatches() {
      // 安全检查: 如果没连上 Supabase，直接报错
      if (!supabase) {
        console.error("❌ 缺少 Supabase 环境变量!");
        setErrorMsg("Missing Environment Variables");
        setLoading(false);
        return;
      }

      try {
        console.log("⚡️ 开始读取比赛数据...");
        
        // 读取 matches 表，按时间排序
        const { data, error } = await supabase
          .from('matches')
          .select('*')
          .order('start_date', { ascending: true })
          .limit(20);

        if (error) {
          console.error('❌ Supabase 读取失败:', error);
          setErrorMsg(error.message);
        } else {
          console.log("✅ 读取成功:", data);
          setMatches(data || []);
        }
      } catch (err) {
        console.error("❌ 发生意外错误:", err);
        setErrorMsg(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchMatches();
  }, []);

  // 加载中界面
  if (loading) return (
    <div className="w-full max-w-md mx-auto mb-4 p-4 bg-white/5 rounded-xl border border-white/10 text-center">
      <span className="text-gray-400 text-sm animate-pulse">Loading Live Fixtures...</span>
    </div>
  );

  return (
    <div className="w-full max-w-md mx-auto mb-4 space-y-3 p-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
          Upcoming / Live
        </h2>
        {/* 如果有错误，显示在这里 */}
        {errorMsg && <span className="text-xs text-red-400">{errorMsg}</span>}
      </div>

      {/* 滚动列表 */}
      <div className="space-y-3 h-64 overflow-y-auto scrollbar-hide">
        {matches.length === 0 ? (
          <div className="text-gray-500 text-center text-sm py-4 bg-white/5 rounded-xl">
            {errorMsg ? "Data loading failed" : "No matches found (Database is empty?)"}
          </div>
        ) : (
          matches.map((match) => (
            <div key={match.id} className="relative bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-3 flex items-center justify-between shadow-lg hover:bg-white/10 transition-colors">
              
              {/* 左侧: 时间 */}
              <div className="flex flex-col items-center w-14 border-r border-white/10 pr-2 mr-2">
                <span className="text-xs font-mono text-gray-300">
                  {match.start_date ? new Date(match.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded mt-1 min-w-[30px] text-center ${
                  ['LIVE', '1H', '2H', 'HT'].includes(match.status_short)
                    ? 'bg-red-500/20 text-red-400 animate-pulse' 
                    : 'bg-gray-700/50 text-gray-400'
                }`}>
                  {match.status_short || 'NS'}
                </span>
              </div>

              {/* 中间: 队伍 */}
              <div className="flex-1 flex flex-col justify-center space-y-2">
                <div className="flex items-center space-x-2">
                  {match.home_logo && <img src={match.home_logo} alt="Home" className="w-5 h-5 object-contain" />}
                  <span className="text-sm font-medium text-white truncate w-24">{match.home_name || 'Home'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  {match.away_logo && <img src={match.away_logo} alt="Away" className="w-5 h-5 object-contain" />}
                  <span className="text-sm font-medium text-white truncate w-24">{match.away_name || 'Away'}</span>
                </div>
              </div>

              {/* 右侧: 联赛Logo */}
              <div className="opacity-40 grayscale ml-2">
                 {match.league_logo && <img src={match.league_logo} alt="League" className="w-6 h-6 object-contain" />}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}