import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { formatCurrency, formatPercent } from '@/utils/format'

interface PieChartData {
  name: string
  value: number
  color: string
  amount: number
}

interface PieChartProps {
  data: PieChartData[]
  showLegend?: boolean
  showTooltip?: boolean
  innerRadius?: number
  outerRadius?: number
}

export default function PieChart({
  data,
  showLegend = true,
  showTooltip = true,
  innerRadius = 60,
  outerRadius = 120
}: PieChartProps) {
  // 自定义工具提示
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <div className="flex items-center space-x-2 mb-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: data.color }}
            ></div>
            <span className="font-medium text-popover-foreground">{data.name}</span>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between space-x-8">
              <span className="text-muted-foreground">金额:</span>
              <span className="text-popover-foreground tabular-nums">
                {formatCurrency(data.amount, 'USD')}
              </span>
            </div>
            <div className="flex justify-between space-x-8">
              <span className="text-muted-foreground">占比:</span>
              <span className="text-popover-foreground">
                {data.value.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  // 自定义图例
  const CustomLegend = (props: any) => {
    const { payload } = props
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {payload.map((entry: any, index: number) => (
          <div key={`legend-${index}`} className="flex items-center space-x-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            ></div>
            <span className="text-sm text-foreground">{entry.value}</span>
            <span className="text-sm text-muted-foreground">
              {entry.payload.value.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        暂无数据
      </div>
    )
  }

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            animationBegin={0}
            animationDuration={800}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          
          {showTooltip && <Tooltip content={<CustomTooltip />} />}
          
          {showLegend && <Legend content={<CustomLegend />} />}
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  )
}