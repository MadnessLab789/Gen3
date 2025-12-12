/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0f0518',
        surface: '#1F1135',
        'surface-highlight': '#2A1B45',
        neon: {
          gold: '#FFC200',
          green: '#00FF9D',
          purple: '#8B5CF6',
          red: '#FF3B30',
          blue: '#3B82F6'
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', "Liberation Mono", "Courier New", 'monospace'],
      },
    },
  },
  plugins: [],
}
