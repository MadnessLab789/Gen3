import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Bar,
  Cell,
} from 'recharts';

interface OddsDataPoint {
  time: string;
  home: number;
  draw: number;
  away: number;
  volume: number;
}

interface OddsChartProps {
  data?: OddsDataPoint[];
}

// 生成包含高资金点的模拟数据
const generateOddsData = (): OddsDataPoint[] => {
  const data: OddsDataPoint[] = [];
  const highPoints = [4, 9, 13]; // 制造 3 个高资金点
  for (let i = 0; i < 15; i++) {
    const baseShift = (Math.random() - 0.5) * 1.2; // 小漂移
    const volBase = 30 + Math.random() * 40; // 30-70
    const volume = highPoints.includes(i) ? 85 + Math.random() * 12 : Math.min(100, volBase);
    data.push({
      time: `T${String(i).padStart(2, '0')}`,
      home: Math.max(-4, Math.min(4, baseShift + (Math.random() - 0.5) * 2)),
      draw: Math.max(-4, Math.min(4, (Math.random() - 0.5) * 3)),
      away: Math.max(-4, Math.min(4, -baseShift + (Math.random() - 0.5) * 2)),
      volume: Number(volume.toFixed(2)),
    });
  }
  return data;
};

export default function OddsChart({ data }: OddsChartProps) {
  const chartData = data || generateOddsData();

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const p0 = payload[0]?.payload;
      return (
        <div className="bg-surface/95 backdrop-blur-xl border border-neon-gold/30 rounded-lg p-3 shadow-lg">
          <p className="text-xs text-gray-400 mb-2">Time: {p0.time}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm font-mono" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(2)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFC200" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#FFC200" stopOpacity={0.4} />
            </linearGradient>
          </defs>

          {/* 基准线 */}
          <ReferenceLine y={0} stroke="#ffffff" strokeDasharray="4 4" />

          {/* 轴 */}
          <XAxis
            dataKey="time"
            tick={{ fill: '#ccc', fontSize: 10 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.4)' }}
            tickLine={{ stroke: 'rgba(255,255,255,0.4)' }}
          />
          <YAxis
            yAxisId="odds"
            type="number"
            domain={[-5, 5]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#888', fontSize: 10 }}
          />
          <YAxis
            yAxisId="volume"
            type="number"
            domain={[0, 100]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#666', fontSize: 9 }}
            orientation="right"
          />

          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: 8 }}
            iconType="line"
            formatter={(value) => (
              <span className="text-xs font-mono text-gray-300">{value}</span>
            )}
          />

          {/* 资金量柱，置于底层 */}
          <Bar yAxisId="volume" dataKey="volume" barSize={10} radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.volume > 80 ? 'url(#goldGradient)' : '#8B5CF6'}
                fillOpacity={entry.volume > 80 ? 1 : 0.3}
              />
            ))}
          </Bar>

          {/* 赔率线 */}
          <Line
            yAxisId="odds"
            type="monotone"
            dataKey="home"
            name="Home"
            stroke="#00FF9D"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive
            animationDuration={800}
          />
          <Line
            yAxisId="odds"
            type="monotone"
            dataKey="draw"
            name="Draw"
            stroke="#00E0FF"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive
            animationDuration={800}
          />
          <Line
            yAxisId="odds"
            type="monotone"
            dataKey="away"
            name="Away"
            stroke="#FF3B30"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive
            animationDuration={800}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

