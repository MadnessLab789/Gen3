/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 深度重定义：从紫色转向更专业的黑金调
        background: '#0A0A0A', // 纯粹的深黑背景
        surface: {
          DEFAULT: '#161616',  // 基础卡片颜色
          light: '#1F1F1F',    // 悬浮或高亮卡片
          accent: '#262626',   // 边框或分割线
        },
        neon: {
          gold: '#FFD700',       // 标准霓虹金
          'gold-muted': '#E2B05E', // 用于长文本的低饱和金，不刺眼
          green: '#4ADE80',      // 柔和的成功绿 (VIP Active)
          red: '#FF453A',        // 报错红
          blue: '#0A84FF',       // 链接蓝
        }
      },
      fontFamily: {
        // UI 字体：追求简洁干净
        sans: ['Inter', 'system-ui', 'sans-serif'],
        // 数据字体：强制等宽，确保赔率、金额、ID 对齐不抖动
        mono: ['"JetBrains Mono"', '"Roboto Mono"', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        // 进阶建议中的金光流动渐变
        'gold-card': 'linear-gradient(135deg, rgba(255,215,0,0.1) 0%, rgba(255,215,0,0) 50%, rgba(255,215,0,0.05) 100%)',
        'dark-gradient': 'linear-gradient(to bottom, #161616, #0A0A0A)',
        'betting-blue-grad': 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)',
        'betting-orange-grad': 'linear-gradient(135deg, #92400E 0%, #F59E0B 100%)',
        'betting-purple-grad': 'linear-gradient(135deg, #5B21B6 0%, #8B5CF6 100%)',
      },
      boxShadow: {
        // 增加一个极细微的金色发光效果
        'gold-glow': '0 0 15px -3px rgba(255, 215, 0, 0.2)',
        'inner-light': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
      },
      letterSpacing: {
        tightest: '-.075em',
        widest: '.2em',
      }
    },
  },
  plugins: [],
}