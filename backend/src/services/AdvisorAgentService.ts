import { db } from '../database';
import { logger } from '../lib/logger';
import { PortfolioService } from './PortfolioService';
import { RebalanceService } from './RebalanceService';

export interface AdvisorContext {
  date: string;
  portfolio: {
    totalValueUsd: number;
    totalCostUsd: number;
    totalProfitUsd: number;
    totalProfitPercent: number;
    categories: Record<string, { valueUsd: number; percentage: number; profitPercent: number }>;
    topAssets: Array<{ symbol: string; name: string; valueUsd: number; profitPercent: number }>;
  };
  rebalance: {
    config: { targets: Record<string, number>; threshold: number };
    needsRebalancing: boolean;
    maxDeviation: number;
    suggestions: Array<{ category: string; action: string; amount: number; currentPct: number; targetPct: number }>;
  };
  risk?: {
    annualizedReturn: number;
    annualizedVolatility: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
  roadmap: Array<{ phase: string; action: string; status: string; priority: string }>;
  recentReports?: Array<{ title: string; health_score: number; created_at: number }>;
}

export interface AdvisorInsights {
  /** 健康度拆解：各维度贡献 */
  healthBreakdown: Array<{ label: string; score: number; max: number; reason: string }>;
  /** 场景压力测试 */
  scenarios: Array<{ name: string; description: string; portfolioImpact: number; impactUsd: number }>;
  /** 集中度分析 */
  concentration: {
    top3Pct: number;
    topAsset: { name: string; pct: number };
    warning: string | null;
  };
  /** 可执行建议（带优先级与分类） */
  actionableItems: Array<{
    text: string;
    priority: 'high' | 'medium' | 'low';
    category: 'rebalance' | 'roadmap' | 'risk' | 'tactical' | 'general';
    action?: string;
  }>;
  /** 一句话总结 */
  summary: string;
}

export interface AdvisorReport {
  title: string;
  content: string;
  health_score: number;
  suggestions: string[];
  insights?: AdvisorInsights;
}

export class AdvisorAgentService {
  private portfolioService: PortfolioService;
  private rebalanceService: RebalanceService;

  constructor() {
    this.portfolioService = new PortfolioService();
    this.rebalanceService = new RebalanceService();
  }

  async gatherContext(): Promise<AdvisorContext> {
    const summary = await this.portfolioService.getPortfolioSummary();
    const config = this.rebalanceService.getRebalanceConfig();
    let analysis: Awaited<ReturnType<RebalanceService['calculateRebalanceSuggestions']>> | null = null;
    try {
      analysis = await this.rebalanceService.calculateRebalanceSuggestions();
    } catch (_) {
      /* ignore */
    }

    let risk: AdvisorContext['risk'];
    try {
      const history = this.portfolioService.getPortfolioHistory(90);
      if (history.length >= 30) {
        const returns: number[] = [];
        for (let i = 1; i < history.length; i++) {
          const prev = history[i - 1].totalValueUsd;
          const curr = history[i].totalValueUsd;
          if (prev > 0) returns.push((curr - prev) / prev);
        }
        const filtered = returns.filter(r => Math.abs(r) <= 0.3);
        if (filtered.length >= 10) {
          const mean = filtered.reduce((a, b) => a + b, 0) / filtered.length;
          const var_ = filtered.reduce((s, r) => s + (r - mean) ** 2, 0) / filtered.length;
          const vol = Math.sqrt(var_);
          let peak = 0, maxDd = 0;
          for (const h of history) {
            if (h.totalValueUsd > peak) peak = h.totalValueUsd;
            const dd = peak > 0 ? (peak - h.totalValueUsd) / peak : 0;
            if (dd > maxDd) maxDd = dd;
          }
          risk = {
            annualizedReturn: Math.pow(1 + mean, 252) - 1,
            annualizedVolatility: vol * Math.sqrt(252),
            sharpeRatio: vol > 0 ? (mean / vol) * Math.sqrt(252) : 0,
            maxDrawdown: maxDd,
          };
        }
      }
    } catch (_) {
      /* ignore */
    }

    const roadmapRows = db.prepare(`
      SELECT phase, action, status, priority FROM rebalance_roadmap
      WHERE status != 'done' ORDER BY created_at DESC LIMIT 10
    `).all() as Array<{ phase: string; action: string; status: string; priority: string }>;

    const recentReports = db.prepare(`
      SELECT title, health_score, created_at FROM advisor_reports
      ORDER BY created_at DESC LIMIT 5
    `).all() as Array<{ title: string; health_score: number; created_at: number }>;

    const topAssets = (summary.mergedAssets || [])
      .sort((a, b) => b.totalValueUsd - a.totalValueUsd)
      .slice(0, 8)
      .map(a => ({
        symbol: a.symbol,
        name: a.name,
        valueUsd: a.totalValueUsd,
        profitPercent: a.profitPercent,
      }));

    return {
      date: new Date().toISOString().slice(0, 10),
      portfolio: {
        totalValueUsd: summary.totalValueUsd,
        totalCostUsd: summary.totalCostUsd,
        totalProfitUsd: summary.totalProfitUsd,
        totalProfitPercent: summary.totalProfitPercent,
        categories: Object.fromEntries(
          Object.entries(summary.categories).map(([cat, catSummary]) => [
            cat,
            {
              valueUsd: catSummary.valueUsd,
              percentage: catSummary.percentage,
              profitPercent: catSummary.profitPercent,
            },
          ])
        ),
        topAssets,
      },
      rebalance: {
        config: config
          ? {
              targets: config.targets,
              threshold: config.threshold,
            }
          : { targets: { crypto: 0.4, stock: 0.4, gold: 0.2 }, threshold: 0.05 },
        needsRebalancing: analysis?.needsRebalancing ?? false,
        maxDeviation: analysis?.maxDeviation ?? 0,
        suggestions: (analysis?.suggestions ?? []).map(s => ({
          category: s.category,
          action: s.action,
          amount: s.amount,
          currentPct: s.currentPct * 100,
          targetPct: s.targetPct * 100,
        })),
      },
      risk,
      roadmap: roadmapRows,
      recentReports: recentReports.length > 0 ? recentReports : undefined,
    };
  }

  /** 场景压力测试：模拟市场冲击对组合的影响 */
  private computeScenarios(context: AdvisorContext): AdvisorInsights['scenarios'] {
    const { portfolio } = context;
    const total = portfolio.totalValueUsd;
    if (total <= 0) return [];

    const c = portfolio.categories;
    const scenarios: AdvisorInsights['scenarios'] = [];

    // 加密暴跌 30%
    const cryptoCrash = (c.crypto.percentage / 100) * -0.3;
    scenarios.push({
      name: '加密市场暴跌 30%',
      description: '假设加密货币整体下跌 30%，股票、黄金不变',
      portfolioImpact: cryptoCrash * 100,
      impactUsd: total * cryptoCrash,
    });

    // 股市回调 15%
    const stockCorrection = (c.stock.percentage / 100) * -0.15;
    scenarios.push({
      name: '股市回调 15%',
      description: '假设股票基金下跌 15%，加密、黄金不变',
      portfolioImpact: stockCorrection * 100,
      impactUsd: total * stockCorrection,
    });

    // 避险情绪：加密-20%、股票-10%、黄金+5%
    const flightToSafety =
      (c.crypto.percentage / 100) * -0.2 +
      (c.stock.percentage / 100) * -0.1 +
      (c.gold.percentage / 100) * 0.05;
    scenarios.push({
      name: '避险情绪升温',
      description: '加密 -20%、股票 -10%、黄金 +5%',
      portfolioImpact: flightToSafety * 100,
      impactUsd: total * flightToSafety,
    });

    // 全面下跌 10%
    scenarios.push({
      name: '全市场普跌 10%',
      description: '三大类资产均下跌 10%',
      portfolioImpact: -10,
      impactUsd: total * -0.1,
    });

    return scenarios;
  }

  /** 集中度分析 */
  private computeConcentration(context: AdvisorContext): AdvisorInsights['concentration'] {
    const { topAssets } = context.portfolio;
    const total = context.portfolio.totalValueUsd;
    if (total <= 0 || topAssets.length === 0) {
      return { top3Pct: 0, topAsset: { name: '-', pct: 0 }, warning: null };
    }

    const top3Value = topAssets.slice(0, 3).reduce((s, a) => s + a.valueUsd, 0);
    const top3Pct = (top3Value / total) * 100;
    const top = topAssets[0];
    const topPct = (top.valueUsd / total) * 100;

    let warning: string | null = null;
    if (topPct > 40) warning = `${top.name} 占比 ${topPct.toFixed(1)}%，集中度过高，建议分散`;
    else if (top3Pct > 70) warning = `前三大持仓占比 ${top3Pct.toFixed(1)}%，注意分散风险`;

    return {
      top3Pct,
      topAsset: { name: top.name, pct: topPct },
      warning,
    };
  }

  private generateRuleBased(context: AdvisorContext): AdvisorReport {
    const { portfolio, rebalance, risk, roadmap } = context;
    const parts: string[] = [];
    const healthBreakdown: AdvisorInsights['healthBreakdown'] = [];
    let healthScore = 70;

    // 盈亏维度
    let profitScore = 0;
    if (portfolio.totalProfitPercent > 5) profitScore = 10;
    else if (portfolio.totalProfitPercent > 0) profitScore = 5;
    else if (portfolio.totalProfitPercent < -10) profitScore = -15;
    else if (portfolio.totalProfitPercent < 0) profitScore = -5;
    healthScore += profitScore;
    healthBreakdown.push({
      label: '盈亏表现',
      score: Math.max(0, 10 + profitScore),
      max: 10,
      reason: portfolio.totalProfitPercent >= 0
        ? `当前盈利 ${portfolio.totalProfitPercent.toFixed(1)}%`
        : `当前亏损 ${portfolio.totalProfitPercent.toFixed(1)}%`,
    });

    parts.push(`## 组合概览\n- 总资产: $${portfolio.totalValueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
    parts.push(`- 总成本: $${portfolio.totalCostUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
    parts.push(`- 总盈亏: ${portfolio.totalProfitPercent >= 0 ? '+' : ''}${portfolio.totalProfitPercent.toFixed(2)}%`);

    const categoryNames: Record<string, string> = {
      crypto: '加密货币', stock: '股票基金', gold: '黄金',
      bond: '固定收益', commodity: '大宗商品', reit: '不动产', cash: '现金',
    };
    const allocationLines: string[] = [];
    for (const [cat, catSummary] of Object.entries(portfolio.categories)) {
      const target = rebalance.config.targets[cat];
      const targetStr = target !== undefined ? ` (目标 ${(target * 100).toFixed(0)}%)` : '';
      allocationLines.push(`- ${categoryNames[cat] || cat}: ${catSummary.percentage.toFixed(1)}%${targetStr}`);
    }
    parts.push(`\n## 资产配置\n${allocationLines.join('\n')}`);

    // 配置偏离维度
    let allocScore = 0;
    if (rebalance.needsRebalancing) {
      allocScore = -12;
      healthScore -= 12;
      healthBreakdown.push({
        label: '配置偏离',
        score: 3,
        max: 10,
        reason: `最大偏离 ${(rebalance.maxDeviation * 100).toFixed(1)}%，需再平衡`,
      });
      parts.push(`\n## ⚠️ 再平衡建议\n当前最大偏离 ${(rebalance.maxDeviation * 100).toFixed(1)}%，超过阈值 ${(rebalance.config.threshold * 100).toFixed(0)}%。建议调整：`);
      for (const s of rebalance.suggestions) {
        parts.push(`- ${s.action} ${s.category}: 约 $${Math.abs(s.amount).toFixed(0)} (当前 ${s.currentPct.toFixed(1)}% → 目标 ${s.targetPct.toFixed(1)}%)`);
      }
    } else {
      allocScore = 5;
      healthScore += 5;
      healthBreakdown.push({
        label: '配置偏离',
        score: 10,
        max: 10,
        reason: '配置在目标范围内',
      });
      parts.push(`\n## 配置状态\n配置在目标范围内，无需再平衡`);
    }

    // 风险维度
    if (risk) {
      let riskScore = 5;
      if (risk.sharpeRatio > 1) riskScore = 8;
      if (risk.maxDrawdown > 0.2) riskScore = 2;
      healthScore += riskScore - 5;
      if (risk.maxDrawdown > 0.2) healthScore -= 8;
      healthBreakdown.push({
        label: '风险调整收益',
        score: riskScore,
        max: 10,
        reason: `夏普 ${risk.sharpeRatio.toFixed(2)}，最大回撤 ${(risk.maxDrawdown * 100).toFixed(1)}%`,
      });
      parts.push(`\n## 风险指标\n- 年化收益: ${(risk.annualizedReturn * 100).toFixed(2)}%`);
      parts.push(`- 年化波动率: ${(risk.annualizedVolatility * 100).toFixed(2)}%`);
      parts.push(`- 夏普比率: ${risk.sharpeRatio.toFixed(2)}`);
      parts.push(`- 最大回撤: ${(risk.maxDrawdown * 100).toFixed(2)}%`);
    }

    // 路线图维度
    if (roadmap.length > 0) {
      healthScore -= Math.min(5, roadmap.length);
      healthBreakdown.push({
        label: '执行进度',
        score: Math.max(0, 5 - roadmap.length),
        max: 10,
        reason: `待执行 ${roadmap.length} 项`,
      });
      parts.push(`\n## 路线图提醒\n待执行 ${roadmap.length} 项：`);
      roadmap.slice(0, 5).forEach(r => {
        parts.push(`- [${r.priority}] ${r.action} (${r.phase})`);
      });
    }

    const scenarios = this.computeScenarios(context);
    const concentration = this.computeConcentration(context);

    const actionableItems: AdvisorInsights['actionableItems'] = [];
    if (rebalance.needsRebalancing && rebalance.suggestions.length > 0) {
      const s = rebalance.suggestions[0];
      actionableItems.push({
        text: `${s.action} ${s.category} 约 $${Math.abs(s.amount).toFixed(0)}`,
        priority: rebalance.maxDeviation > 0.1 ? 'high' : 'medium',
        category: 'rebalance',
        action: `rebalance:${s.category}`,
      });
    }
    if (roadmap.length > 0) {
      actionableItems.push({
        text: `推进「${roadmap[0].action}」`,
        priority: roadmap[0].priority === 'high' ? 'high' : 'medium',
        category: 'roadmap',
        action: `roadmap:${roadmap[0].action}`,
      });
    }
    if (portfolio.topAssets.length > 0) {
      const top = portfolio.topAssets[0];
      if (top.profitPercent < -15) {
        actionableItems.push({
          text: `关注 ${top.name}：亏损 ${top.profitPercent.toFixed(1)}%，评估止损或补仓`,
          priority: 'high',
          category: 'tactical',
        });
      } else if (top.profitPercent > 20) {
        actionableItems.push({
          text: `考虑 ${top.name} 部分止盈：盈利 ${top.profitPercent.toFixed(1)}%`,
          priority: 'medium',
          category: 'tactical',
        });
      }
    }
    if (concentration.warning) {
      actionableItems.push({
        text: concentration.warning,
        priority: 'medium',
        category: 'risk',
      });
    }
    actionableItems.push(
      { text: '检查价格提醒，把握做T时机', priority: 'low', category: 'general' },
      { text: '关注资产相关性，保持分散化', priority: 'low', category: 'general' }
    );

    const suggestions = actionableItems.map(a => a.text);

    let summary = '';
    if (healthScore >= 80) summary = '组合健康，配置合理，继续保持纪律执行。';
    else if (healthScore >= 60) summary = '整体良好，有少量优化空间，建议关注再平衡与路线图。';
    else summary = '建议优先处理配置偏离与风险集中问题，再推进其他计划。';

    const insights: AdvisorInsights = {
      healthBreakdown,
      scenarios,
      concentration,
      actionableItems,
      summary,
    };

    return {
      title: `${context.date} 资产健康度报告`,
      content: parts.join('\n'),
      health_score: Math.min(100, Math.max(0, healthScore)),
      suggestions,
      insights,
    };
  }

  async runAnalysis(): Promise<{ id: number; title: string; health_score: number }> {
    const context = await this.gatherContext();
    const report = this.generateRuleBased(context);

    const result = db.prepare(`
      INSERT INTO advisor_reports (report_type, title, content, health_score, suggestions_json, insights_json, total_value_usd)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'daily',
      report.title,
      report.content,
      report.health_score,
      JSON.stringify(report.suggestions || []),
      report.insights ? JSON.stringify(report.insights) : null,
      context.portfolio.totalValueUsd
    );

    const id = result.lastInsertRowid as number;
    logger.info(`资产管理智能体报告已生成: ${report.title} (健康分: ${report.health_score})`);

    return { id, title: report.title, health_score: report.health_score };
  }

  recordFeedback(reportId: number, rating?: number, actedOn?: boolean, notes?: string): void {
    db.prepare(`
      INSERT INTO advisor_feedback (report_id, rating, acted_on, notes)
      VALUES (?, ?, ?, ?)
    `).run(reportId, rating ?? null, actedOn ? 1 : 0, notes ?? null);
  }
}
