# Portfolio Manager

个人多资产头寸管理与再平衡建议系统

## 项目概述

Portfolio Manager 是一个完整的个人投资组合管理系统，专注于**看板展示 + 再平衡建议**，支持三大资产类别的投资组合管理：
- **加密货币** - 通过 Binance API 获取实时价格
- **股票基金** - 通过 Yahoo Finance 获取实时价格  
- **黄金** - 通过 Yahoo Finance 获取期货价格

## 核心功能

### 📊 投资组合概览
- 总资产价值显示（USD/CNY 切换）
- 三大类资产配比饼图
- 组合净值历史曲线
- 盈亏统计和分析

### 💰 资产管理
- 手动录入持仓数据
- 资产增删改查
- 交易记录管理
- 实时价格更新

### ⚖️ 再平衡建议
- 目标配比设置
- 偏离度监控
- 具体买卖建议
- 再平衡历史记录

### 📈 投资分析
- 资产相关性矩阵
- 风险指标计算（波动率、夏普比率）
- 最优配比建议
- 最大回撤分析

### 🔔 价格提醒
- 设置目标价提醒（涨破/跌破）
- 每 5 分钟自动检查
- 触发时发送 Telegram 通知

### 🤖 资产管理大师（智能体）
- 每日深度分析组合健康度
- 基于规则的智能分析，零配置开箱即用
- 用户反馈用于自我进化

### 📋 路线图
- 再平衡计划分阶段管理
- 执行进度跟踪
- 分析报告存档

## 技术栈

### 后端
- **框架**: Express + TypeScript
- **数据库**: SQLite (better-sqlite3)
- **定时任务**: node-cron
- **价格API**: Yahoo Finance, Binance API
- **部署**: PM2

### 前端
- **框架**: React + Vite + TypeScript
- **样式**: Tailwind CSS (暗色主题)
- **图表**: Recharts
- **图标**: Lucide React
- **路由**: React Router Dom

## 项目结构

```
portfolio-manager/
├── backend/                    # 后端服务
│   ├── src/
│   │   ├── index.ts           # 服务入口
│   │   ├── database.ts        # 数据库初始化
│   │   ├── routes/            # API 路由
│   │   │   ├── assets.ts      # 资产管理接口
│   │   │   ├── prices.ts      # 价格服务接口
│   │   │   ├── portfolio.ts   # 组合分析接口
│   │   │   ├── rebalance.ts   # 再平衡接口
│   │   │   ├── alerts.ts      # 价格提醒接口
│   │   │   └── roadmap.ts     # 路线图接口
│   │   ├── services/          # 业务服务
│   │   │   ├── PriceService.ts
│   │   │   ├── PortfolioService.ts
│   │   │   ├── RebalanceService.ts
│   │   │   ├── ExchangeRateService.ts
│   │   │   └── NotificationService.ts
│   │   └── lib/
│   │       └── logger.ts      # 日志工具
│   ├── data/                  # SQLite 数据库文件
│   ├── logs/                  # 日志文件
│   ├── package.json
│   ├── tsconfig.json
│   └── ecosystem.config.js    # PM2 配置
├── frontend/                  # 前端应用
│   ├── src/
│   │   ├── components/        # React 组件
│   │   │   ├── Layout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── PieChart.tsx
│   │   │   └── LineChart.tsx
│   │   ├── pages/             # 页面组件
│   │   │   ├── Dashboard.tsx  # 总览页
│   │   │   ├── Assets.tsx     # 资产管理页
│   │   │   ├── Rebalance.tsx  # 再平衡页
│   │   │   ├── Analysis.tsx   # 分析页
│   │   │   ├── PriceAlerts.tsx # 价格提醒页
│   │   │   └── Roadmap.tsx    # 路线图页
│   │   ├── hooks/
│   │   │   └── useApi.ts      # API 请求封装
│   │   ├── utils/
│   │   │   └── format.ts      # 格式化工具
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css          # 样式文件
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── README.md
└── .gitignore
```

## 快速开始

### 环境要求
- Node.js >= 16
- npm 或 yarn
- (可选) PM2 for 生产环境

### 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 开发环境启动

```bash
# 启动后端服务 (端口: 6002)
cd backend
npm run dev

# 启动前端服务 (端口: 3007)
cd frontend
npm run dev
```

访问 http://localhost:3007 查看应用

### 生产环境部署

```bash
# 构建后端
cd backend
npm run build

# 构建前端
cd frontend
npm run build

# 使用 PM2 启动后端
cd backend
pm2 start ecosystem.config.js

# (可选) 启动前端预览服务
cd frontend
pm2 start npm --name "portfolio-frontend" -- run preview
```

## API 接口

### 资产管理
- `GET /api/assets` - 获取所有资产
- `POST /api/assets` - 添加资产
- `PUT /api/assets/:id` - 更新资产
- `DELETE /api/assets/:id` - 删除资产
- `POST /api/assets/:id/transactions` - 记录交易
- `GET /api/assets/:id/transactions` - 获取交易历史

### 价格服务
- `GET /api/prices` - 获取所有价格
- `GET /api/prices/:symbol` - 获取单个价格
- `GET /api/prices/history/:symbol` - 获取历史价格
- `POST /api/prices/update` - 手动更新价格

### 组合分析
- `GET /api/portfolio/summary` - 组合概览
- `GET /api/portfolio/history` - 组合历史
- `GET /api/portfolio/correlation` - 相关性矩阵
- `GET /api/portfolio/risk` - 风险指标

### 再平衡
- `GET /api/rebalance/config` - 获取配置
- `PUT /api/rebalance/config` - 更新配置
- `GET /api/rebalance/suggest` - 获取建议
- `POST /api/rebalance/execute` - 记录执行

### 价格提醒
- `GET /api/alerts` - 获取所有提醒
- `GET /api/alerts/with-prices` - 获取提醒及当前价格
- `POST /api/alerts` - 创建提醒
- `PUT /api/alerts/:id` - 更新提醒
- `DELETE /api/alerts/:id` - 删除提醒
- `POST /api/alerts/check` - 手动触发检查

### 路线图
- `GET /api/roadmap` - 获取路线图计划
- `POST /api/roadmap` - 添加计划
- `PUT /api/roadmap/:id` - 更新计划状态
- `DELETE /api/roadmap/:id` - 删除计划
- `GET /api/advisor/reports` - 获取分析报告

### 资产管理智能体
- `POST /api/advisor/analyze` - 触发分析
- `GET /api/advisor/reports` - 获取报告列表
- `GET /api/advisor/reports/:id` - 获取单条报告
- `POST /api/advisor/feedback` - 提交反馈（用于自我进化）

### 通知测试
- `POST /api/notify/test` - 测试 Telegram 通知

### 其他
- `GET /api/exchange-rate` - 获取汇率
- `GET /api/health` - 健康检查

## 定时任务

系统自动执行以下定时任务：

- **每5分钟**: 更新加密货币价格
- **每15分钟**: 更新股票/黄金价格  
- **每小时**: 更新汇率
- **每天00:00**: 生成组合快照
- **每天08:00**: 检查再平衡偏离度，超阈值发送提醒
- **每天21:00**: 发送每日报告
- **每5分钟**: 检查价格提醒，触发时发送 Telegram 通知
- **每天09:00**: 运行资产管理智能体，生成每日分析报告

## 数据库结构

系统使用 SQLite 数据库，主要表结构：

- `assets` - 资产信息
- `transactions` - 交易记录
- `price_cache` - 价格缓存
- `portfolio_snapshots` - 组合快照
- `rebalance_config` - 再平衡配置
- `rebalance_history` - 再平衡历史
- `rebalance_roadmap` - 再平衡路线图
- `price_alerts` - 价格提醒
- `advisor_reports` - 分析报告
- `exchange_rates` - 汇率缓存

## 通知功能

系统支持 Telegram 通知功能：

- 再平衡偏离提醒
- 每日投资报告
- 价格更新失败警告
- 系统状态报告
- **价格提醒**：达到目标价时发送 Telegram 通知

配置环境变量（`backend/.env`）：
```bash
TELEGRAM_BOT_TOKEN=your-bot-token  # 可选
TELEGRAM_CHAT_ID=-5170247327       # 消息中心群
BINANCE_API_URL=http://localhost:4001  # Binance 数据服务，默认 localhost:4001
```

## 配置说明

### 后端配置 (ecosystem.config.js)
```javascript
{
  name: 'portfolio-backend',
  script: 'dist/index.js',
  env: {
    NODE_ENV: 'production',
    PORT: 6002,
    TELEGRAM_CHAT_ID: '-5170247327'
  }
}
```

### 前端配置 (vite.config.ts)
```typescript
{
  server: {
    port: 3007,
    proxy: {
      '/api': 'http://localhost:6002'
    }
  }
}
```

## 注意事项

1. **数据安全**: 数据库文件位于 `backend/data/portfolio.db`，建议定期备份
2. **API频率限制**: Yahoo Finance 有频率限制，系统已实现缓存机制
3. **汇率更新**: USD/CNY 汇率每小时更新一次
4. **价格数据**: 支持手动录入，适合支付宝基金等无 API 的资产
5. **再平衡**: 系统只提供建议，不执行自动交易

## 开发指南

### 添加新资产类别
1. 修改数据库 schema (`database.ts`)
2. 更新 PriceService 添加价格获取逻辑
3. 在前端添加对应的颜色和图标配置

### 添加新API接口
1. 在对应的 route 文件中添加路由
2. 在 service 文件中实现业务逻辑
3. 更新前端 `useApi.ts` 添加接口定义

### 自定义通知
1. 修改 `NotificationService.ts`
2. 添加新的消息模板
3. 在定时任务中调用

## 故障排除

### 常见问题

**后端启动失败**
- 检查端口 6002 是否被占用
- 确认数据库文件权限
- 查看日志文件排查错误

**前端无法加载数据**
- 确认后端服务已启动
- 检查代理配置 (`vite.config.ts`)
- 查看浏览器控制台错误

**价格更新失败**
- 检查网络连接
- 确认 API 服务状态
- 查看 binance-data-infra 服务 (端口 4001)

## 版本历史

### v1.0.0
- 基础功能实现
- 三大资产类别支持
- 再平衡建议功能
- 投资分析报告

## 许可证

MIT License

## 贡献指南

欢迎提交 Issue 和 Pull Request！

## 联系方式

开发者: StarBlue
项目地址: `/Users/starblue/claude/portfolio-manager/`