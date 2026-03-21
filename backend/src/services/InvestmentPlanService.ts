import { db } from '../database';

export interface Tranche {
  batch: number;
  entry_low: number;
  entry_high: number;
  allocation_pct: number;
  amount_usd: number;
  status: 'pending' | 'executed' | 'skipped';
  executed_at: number | null;
  actual_price: number | null;
  notes: string | null;
}

export interface InvestmentPlan {
  id: number;
  symbol: string;
  name: string;
  category: string;
  tier: 'core' | 'satellite' | 'hedge';
  direction: 'long' | 'short';
  total_target_usd: number | null;
  status: 'planning' | 'active' | 'partial' | 'completed' | 'cancelled';
  tranches_json: string;
  tranches?: Tranche[];
  stop_loss: number | null;
  stop_loss_note: string | null;
  take_profit: number | null;
  take_profit_note: string | null;
  rationale: string | null;
  created_at: number;
  updated_at: number;
}

export class InvestmentPlanService {
  getAllPlans(): InvestmentPlan[] {
    const stmt = db.prepare(`
      SELECT * FROM investment_plans
      ORDER BY
        CASE status WHEN 'active' THEN 1 WHEN 'partial' THEN 2 WHEN 'planning' THEN 3 WHEN 'completed' THEN 4 WHEN 'cancelled' THEN 5 END,
        updated_at DESC
    `);
    const plans = stmt.all() as InvestmentPlan[];
    return plans.map(p => ({
      ...p,
      tranches: this.parseTranches(p.tranches_json),
    }));
  }

  getPlanById(id: number): InvestmentPlan | null {
    const stmt = db.prepare('SELECT * FROM investment_plans WHERE id = ?');
    const plan = stmt.get(id) as InvestmentPlan | undefined;
    if (!plan) return null;
    return {
      ...plan,
      tranches: this.parseTranches(plan.tranches_json),
    };
  }

  createPlan(data: Omit<InvestmentPlan, 'id' | 'created_at' | 'updated_at' | 'tranches'>): number {
    const stmt = db.prepare(`
      INSERT INTO investment_plans (symbol, name, category, tier, direction, total_target_usd, status, tranches_json, stop_loss, stop_loss_note, take_profit, take_profit_note, rationale)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.symbol,
      data.name,
      data.category,
      data.tier || 'core',
      data.direction,
      data.total_target_usd ?? null,
      data.status || 'planning',
      data.tranches_json || '[]',
      data.stop_loss ?? null,
      data.stop_loss_note ?? null,
      data.take_profit ?? null,
      data.take_profit_note ?? null,
      data.rationale ?? null
    );
    return result.lastInsertRowid as number;
  }

  updatePlan(id: number, updates: Partial<InvestmentPlan>): boolean {
    const allowed = [
      'symbol', 'name', 'category', 'direction',
      'total_target_usd', 'status', 'tranches_json',
      'stop_loss', 'stop_loss_note', 'take_profit', 'take_profit_note',
      'rationale'
    ];
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowed.includes(key) && value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value as any);
      }
    }
    if (fields.length === 0) return false;

    fields.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const stmt = db.prepare(`UPDATE investment_plans SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);
    return result.changes > 0;
  }

  deletePlan(id: number): boolean {
    const stmt = db.prepare('DELETE FROM investment_plans WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  executeTranche(planId: number, trancheIndex: number, actualPrice: number): InvestmentPlan | null {
    const plan = this.getPlanById(planId);
    if (!plan || !plan.tranches) return null;

    if (trancheIndex < 0 || trancheIndex >= plan.tranches.length) return null;

    const tranches = [...plan.tranches];
    const tranche = tranches[trancheIndex];
    if (tranche.status === 'executed') return null;

    tranches[trancheIndex] = {
      ...tranche,
      status: 'executed',
      executed_at: Date.now(),
      actual_price: actualPrice,
    };

    // Determine new plan status
    const executedCount = tranches.filter(t => t.status === 'executed').length;
    const totalCount = tranches.length;
    let newStatus: InvestmentPlan['status'];
    if (executedCount === totalCount) {
      newStatus = 'completed';
    } else if (executedCount > 0) {
      newStatus = 'partial';
    } else {
      newStatus = plan.status;
    }

    const tranchesJson = JSON.stringify(tranches);
    const now = Date.now();
    const stmt = db.prepare(`
      UPDATE investment_plans SET tranches_json = ?, status = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(tranchesJson, newStatus, now, planId);

    return this.getPlanById(planId);
  }

  private parseTranches(json: string): Tranche[] {
    try {
      const parsed = JSON.parse(json || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
