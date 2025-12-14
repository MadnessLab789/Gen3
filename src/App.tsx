import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import './App.css';

// 1. 解决 TypeScript 红线问题的“说明书”
declare global {
  interface Window {
    Telegram: {
      WebApp: {
        initDataUnsafe: {
          user?: {
            id: number;
            username?: string;
            first_name?: string;
          };
        };
        ready: () => void;
        expand: () => void;
      };
    };
  }
}

// 2. 初始化 Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function App() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('radar');
  // 👇 删除了那个会导致报错的 user 变量，只保留 profile
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const initApp = async () => {
      // A. 通知 Telegram WebApp 准备就绪
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
      }

      const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
      
      // 如果没有 TG 用户，停止加载
      if (!tgUser) {
        console.log("No TG User detected.");
        setLoading(false); 
        return;
      }

      const telegramId = tgUser.id;
      const email = `${telegramId}@oddsflow.user`;
      const password = `secret_${telegramId}`;

      try {
        // B. 尝试登录
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        let userId = signInData.user?.id;

        // C. 如果登录失败，自动注册
        if (signInError) {
          const { data: signUpData } = await supabase.auth.signUp({
            email,
            password
          });
          userId = signUpData.user?.id;

          if (userId) {
            await supabase.from('users').insert({
              id: userId,
              telegram_id: telegramId,
              username: tgUser.username || "User",
              first_name: tgUser.first_name || "",
              vip_level: 'free'
            });
          }
        }

        // D. 获取资料
        if (userId) {
          const { data: profileData } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
          
          // 这里不再设置 unused user state，只设置 profile
          setProfile(profileData || { username: tgUser.username, vip_level: 'free' });
        }

      } catch (error) {
        console.error("Auth error:", error);
      } finally {
        setLoading(false);
      }
    };

    initApp();
  }, []);

  // 加载动画
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: '#fff' }}>
        <div className="loader">Loading OddsFlow...</div>
      </div>
    );
  }

  // --- 👇 漂亮的 UI 界面 👇 ---
  return (
    <div className="app-container" style={{ background: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: 'Arial, sans-serif', paddingBottom: '80px' }}>
      
      {/* 顶部导航 */}
      <header style={{ padding: '15px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b' }}>
        <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#38bdf8' }}>OddsFlow Radar</div>
        <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px' }}>
          {profile?.username ? `@${profile.username}` : 'Guest'}
          <span style={{ padding: '2px 8px', borderRadius: '10px', background: profile?.vip_level === 'vip' ? '#eab308' : '#475569', color: 'white', fontSize: '10px', fontWeight: 'bold' }}>
            {profile?.vip_level?.toUpperCase() || 'FREE'}
          </span>
        </div>
      </header>

      {/* 内容区域 */}
      <main style={{ padding: '20px' }}>
        {activeTab === 'radar' && (
          <div className="animate-fade-in">
            <h2 style={{ color: '#38bdf8', marginTop: 0 }}>📡 Live Market Radar</h2>
            <div style={{ background: '#1e293b', padding: '20px', borderRadius: '16px', marginTop: '15px', border: '1px solid #334155', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>📊</div>
              <p style={{ color: '#94a3b8' }}>Scanning 250+ pairs for whale activity...</p>
            </div>
            <div style={{ marginTop: '20px', display: 'grid', gap: '12px' }}>
              <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '15px', borderRadius: '12px', borderLeft: '4px solid #38bdf8' }}>
                <div style={{ fontWeight: 'bold', color: '#38bdf8' }}>BTC/USDT</div>
                <div style={{ fontSize: '12px', color: '#cbd5e1' }}>Large Buy Wall Detected (Binance)</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'vip' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '60px', marginBottom: '10px' }}>👑</div>
            <h2 style={{ margin: '10px 0' }}>Upgrade to VIP</h2>
            <button style={{ marginTop: '20px', background: 'linear-gradient(135deg, #38bdf8, #3b82f6)', border: 'none', padding: '15px 30px', borderRadius: '30px', color: 'white', fontWeight: 'bold' }}>Get Premium</button>
          </div>
        )}

        {activeTab === 'profile' && (
          <div>
            <h2 style={{ marginTop: 0 }}>👤 Profile</h2>
            <div style={{ background: '#1e293b', padding: '20px', borderRadius: '16px', border: '1px solid #334155' }}>
              <p>ID: <span style={{ fontFamily: 'monospace' }}>{profile?.telegram_id}</span></p>
              <p>Level: <span style={{ color: '#38bdf8' }}>{profile?.vip_level}</span></p>
            </div>
          </div>
        )}
      </main>

      {/* 底部 Tab 栏 */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#1e293b', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'space-around', padding: '15px 0' }}>
        <button onClick={() => setActiveTab('radar')} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>📡</button>
        <button onClick={() => setActiveTab('vip')} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>👑</button>
        <button onClick={() => setActiveTab('profile')} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>👤</button>
      </nav>
    </div>
  );
}

export default App;