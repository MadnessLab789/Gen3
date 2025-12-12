import React from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface PressureChartProps {
  data: any[];
  color?: string;
}

const PressureChart: React.FC<PressureChartProps> = ({ data, color = '#00FF94' }) => {
  return (
    <div style={{ width: '100%', height: 60 }}>
      <ResponsiveContainer>
        <AreaChart data={data}>
          {/* 1. 定义渐变色 (使用标准 HTML 标签 <defs>) */}
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.8}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          
          {/* 2. 绘制波浪 */}
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            fillOpacity={1} 
            fill="url(#colorValue)" 
            strokeWidth={2}
            isAnimationActive={true}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PressureChart;