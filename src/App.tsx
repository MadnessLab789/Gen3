import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import './App.css';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready?: () => void;
        initDataUnsafe?: {
          user?: {
            id?: number;
            username?: string;
            first_name?: string;
          };
        };
      };
    };
  }
}

// 初始化 Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function App() {
  const [status, setStatus] = useState('Initializing...');
  const [user, setUser] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const log = (...args: any[]) => {
    const line = args
      .map((a) => {
        if (typeof a === 'string') return a;
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(' ');
    // eslint-disable-next-line no-console
    console.log('[DEBUG]', ...args);
    setDebugLogs((prev) => [
      `${new Date().toISOString()} ${line}`,
      ...prev,
    ]);
  };

  useEffect(() => {
    const initAuth = async () => {
      setStatus('Checking Telegram Environment...');
      log('Boot', {
        supabaseUrlPresent: Boolean(supabaseUrl),
        supabaseKeyPresent: Boolean(supabaseKey),
        userAgent: navigator.userAgent,
      });

      // 1. 检查 Telegram 环境
      if (!window.Telegram?.WebApp) {
        setErrorMsg('Not running in Telegram!');
        log('Telegram WebApp missing on window');
        return;
      }

      try {
        window.Telegram.WebApp.ready?.();
        log('Telegram WebApp.ready() called');
      } catch (e: any) {
        log('Telegram WebApp.ready() failed', e?.message ?? e);
      }

      const tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
      log('tgUser', tgUser ?? null);
      if (!tgUser) {
        setErrorMsg("Can't get Telegram User Data. Are you connected?");
        // 为了调试，即使没有 TG 数据也允许继续 (模拟 ID) - 生产环境应移除
        // return;
      }

      const telegramId = tgUser?.id || 123456; // Fallback for testing
      const username = tgUser?.username || 'Unknown';
      const email = `${telegramId}@oddsflow.user`;
      const password = `secret_${telegramId}`;

      setStatus(`Logging in as ${username}...`);
      log('Derived credentials', { telegramId, username, email, passwordPreview: password.slice(0, 8) + '…' });

      try {
        // 2. 尝试登录
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        log('signInWithPassword result', { hasData: Boolean(signInData), error: signInError ?? null });

        if (signInError) {
          log('Sign In Failed, trying Sign Up...', signInError.message);
          setStatus('Account not found, creating new user...');

          // 3. 登录失败，尝试注册
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
          });
          log('signUp result', { user: signUpData?.user ?? null, error: signUpError ?? null });

          if (signUpError) {
            throw new Error('SignUp Failed: ' + signUpError.message);
          }

          // 4. 注册成功，插入用户表
          if (signUpData.user) {
            setStatus('Creating User Profile...');
            const { error: dbError } = await supabase.from('users').insert({
              id: signUpData.user.id,
              telegram_id: telegramId,
              username: username, // 存入数据库
              first_name: tgUser?.first_name || '',
              vip_level: 'free',
            });

            if (dbError) {
              // 注意：如果因为重复插入报错，可以忽略
              log('DB Insert Error', dbError);
              // eslint-disable-next-line no-console
              console.error('DB Insert Error:', dbError);
            } else {
              log('DB Insert Success');
            }
          }
        }

        // 最终获取 Session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        log('getSession result', { session: sessionData?.session ? { userId: sessionData.session.user.id, email: sessionData.session.user.email } : null, error: sessionError ?? null });

        if (sessionData.session) {
          setUser(sessionData.session.user);
          setStatus('Login Success!');
        } else {
          throw new Error('No session created.');
        }
      } catch (err: any) {
        const msg = err?.message || 'Unknown Error';
        setErrorMsg(msg);
        log('Caught error', msg);
        // 手机上直接弹窗显示错误
        alert('Login Error: ' + msg);
      }
    };

    initAuth();
  }, []);

  return (
    <div style={{ padding: '20px', color: 'white', background: '#1a1a1a', minHeight: '100vh' }}>
      <h1>OddsFlow Radar Gen3</h1>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.9 }}>
        <div>Supabase URL Present: {String(Boolean(supabaseUrl))}</div>
        <div>Supabase Key Present: {String(Boolean(supabaseKey))}</div>
        <div>Telegram Present: {String(Boolean(window.Telegram?.WebApp))}</div>
      </div>

      {errorMsg && (
        <div style={{ border: '1px solid red', padding: '10px', background: '#330000', marginTop: '20px' }}>
          <h3>⚠️ Error Occurred:</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{errorMsg}</p>
        </div>
      )}

      {!user && !errorMsg && (
        <div style={{ marginTop: '20px' }}>
          <p>Status: {status}</p>
          <div className="loader">Loading...</div>
        </div>
      )}

      {user && (
        <div style={{ border: '1px solid green', padding: '10px', background: '#003300', marginTop: '20px' }}>
          <h2>✅ Logged In!</h2>
          <p>Hi, {user.email}</p>
          <p>Supabase User ID: {user.id}</p>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      )}

      <div style={{ marginTop: 20, border: '1px solid #333', padding: 10, background: '#111' }}>
        <h3 style={{ marginTop: 0 }}>Debug Logs (newest first)</h3>
        <div style={{ maxHeight: 320, overflow: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: 11, whiteSpace: 'pre-wrap' }}>
          {debugLogs.length === 0 ? 'No logs yet.' : debugLogs.join('\n\n')}
        </div>
      </div>
    </div>
  );
}

export default App;