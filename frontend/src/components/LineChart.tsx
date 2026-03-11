import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatCurrency, formatDate } from '@/utils/format'

interface LineChartData {
  date: string
  value: number
  crypto?: number
  stock?: number
  gold?: number
  [key: string]: any
}

interface LineChartProps {
  data: LineChartData[]
  lines?: Array<{
    key: string
    name: string
    color: string
    strokeWidth?: number
    strokeDasharray?: string
  }>
  showGrid?: boolean
  showLegend?: boolean
  showTooltip?: boolean
  height?: number
}

const defaultLines = [
  { key: 'value', name: '总价值', color: '#8884d8', strokeWidth: 3 },
  { key: 'crypto', name: '加密货币', color: '#f7931e', strokeWidth: 2 },
  { key: 'stock', name: '股票基金', color: '#22c55e', strokeWidth: 2 },
  { key: 'gold', name: '黄金', color: '#facc15', strokeWidth: 2 }
]

export default function LineChart({
  data,
  lines = defaultLines,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  height = 320
}: LineChartProps) {
  // 自定义工具提示
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <div className="text-sm font-medium text-popover-foreground mb-2">
            {formatDate(label)}
          </div>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between space-x-4">
                <div className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  ></div>
                  <span className="text-sm text-muted-foreground">{entry.name}:</span>
                </div>
                <span className="text-sm font-medium text-popover-foreground tabular-nums">
                  {formatCurrency(entry.value, 'USD')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )
    }
    return null
  }

  // 自定义X轴标签格式
  const formatXAxis = (tickItem: string) => {
    const date = new Date(tickItem)
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
  }

  // 自定义Y轴标签格式
  const formatYAxis = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    }
    return `$${value.toFixed(0)}`
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-muted-foreground" style={{ height }}>
        暂无数据
      </div>
    )
  }

  // 过滤出实际存在的数据线
  const validLines = lines.filter(line => 
    data.some(item => item[line.key] !== undefined && item[line.key] !== null)
  )

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          {showGrid && (
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="hsl(var(--border))" 
              opacity={0.3}
            />
          )}
          
          <XAxis
            dataKey="date"
            tickFormatter={formatXAxis}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          
          <YAxis
            tickFormatter={formatYAxis}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={60}
          />
          
          {showTooltip && (
            <Tooltip 
              content={<CustomTooltip />}
              cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
            />
          )}
          
          {showLegend && (
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
            />
          )}
          
          {validLines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.name}
              stroke={line.color}
              strokeWidth={line.strokeWidth || 2}
              strokeDasharray={line.strokeDasharray}
              dot={false}
              activeDot={{ 
                r: 4, 
                fill: line.color,
                strokeWidth: 2,
                stroke: 'hsl(var(--background))'
              }}
              animationDuration={800}
              connectNulls={false}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  )
}