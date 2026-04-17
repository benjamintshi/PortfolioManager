import express from 'express';
import { db } from '../database';
import { logger } from '../lib/logger';
import { encrypt, decrypt, maskApiKey } from '../lib/crypto';

const router = express.Router();

// --------------- Platforms ---------------

// GET / — List all platforms with nested sub_accounts
router.get('/', (req, res) => {
  try {
    const platforms = db.prepare(`
      SELECT id, name, display_name, type, icon,
        api_key_encrypted, api_secret_encrypted, api_passphrase_encrypted,
        sync_enabled, last_sync_at, last_sync_status, last_sync_error,
        created_at, updated_at
      FROM platforms
      ORDER BY created_at ASC
    `).all() as Array<Record<string, unknown>>;

    const subAccounts = db.prepare(`
      SELECT id, platform_id, name, display_name, account_type, sync_enabled, created_at
      FROM sub_accounts
      ORDER BY created_at ASC
    `).all() as Array<Record<string, unknown>>;

    const subAccountsByPlatform = new Map<number, Array<Record<string, unknown>>>();
    for (const sa of subAccounts) {
      const platformId = sa.platform_id as number;
      if (!subAccountsByPlatform.has(platformId)) {
        subAccountsByPlatform.set(platformId, []);
      }
      subAccountsByPlatform.get(platformId)!.push({
        id: sa.id,
        name: sa.name,
        displayName: sa.display_name,
        accountType: sa.account_type,
        syncEnabled: sa.sync_enabled,
        createdAt: sa.created_at,
      });
    }

    const data = platforms.map((p) => {
      const subs = subAccountsByPlatform.get(p.id as number) ?? [];
      const hasApiKey = Boolean(p.api_key_encrypted);

      return {
        id: p.id,
        name: p.name,
        displayName: p.display_name,
        type: p.type,
        icon: p.icon,
        hasApiKey,
        apiKeyMasked: hasApiKey ? maskApiKey(decrypt(p.api_key_encrypted as string)) : null,
        syncEnabled: p.sync_enabled,
        lastSyncAt: p.last_sync_at,
        lastSyncStatus: p.last_sync_status,
        lastSyncError: p.last_sync_error,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        subAccountCount: subs.length,
        subAccounts: subs,
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    logger.error('获取平台列表失败:', error);
    res.status(500).json({ success: false, error: '获取平台列表失败' });
  }
});

// POST / — Create platform
router.post('/', (req, res) => {
  try {
    const { name, displayName, type, icon } = req.body;

    if (!name || !displayName || !type) {
      return res.status(400).json({ success: false, error: '缺少必填字段: name, displayName, type' });
    }

    const validTypes = ['exchange', 'manual'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, error: '无效的平台类型，必须为 exchange 或 manual' });
    }

    const existing = db.prepare('SELECT id FROM platforms WHERE name = ?').get(name);
    if (existing) {
      return res.status(409).json({ success: false, error: '平台名称已存在' });
    }

    const result = db.prepare(
      'INSERT INTO platforms (name, display_name, type, icon) VALUES (?, ?, ?, ?)'
    ).run(name, displayName, type, icon ?? null);

    res.status(201).json({
      success: true,
      data: { id: result.lastInsertRowid },
    });
  } catch (error) {
    logger.error('创建平台失败:', error);
    res.status(500).json({ success: false, error: '创建平台失败' });
  }
});

// PUT /:id — Update platform
router.put('/:id', (req, res) => {
  try {
    const platformId = parseInt(req.params.id);
    if (isNaN(platformId)) {
      return res.status(400).json({ success: false, error: '无效的平台ID' });
    }

    const { displayName, icon } = req.body;

    const platform = db.prepare('SELECT id FROM platforms WHERE id = ?').get(platformId);
    if (!platform) {
      return res.status(404).json({ success: false, error: '平台不存在' });
    }

    db.prepare(
      'UPDATE platforms SET display_name = COALESCE(?, display_name), icon = COALESCE(?, icon), updated_at = ? WHERE id = ?'
    ).run(displayName ?? null, icon ?? null, Date.now(), platformId);

    res.json({ success: true, message: '平台更新成功' });
  } catch (error) {
    logger.error('更新平台失败:', error);
    res.status(500).json({ success: false, error: '更新平台失败' });
  }
});

// DELETE /:id — Delete platform (CASCADE deletes sub_accounts + holdings)
router.delete('/:id', (req, res) => {
  try {
    const platformId = parseInt(req.params.id);
    if (isNaN(platformId)) {
      return res.status(400).json({ success: false, error: '无效的平台ID' });
    }

    const result = db.prepare('DELETE FROM platforms WHERE id = ?').run(platformId);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: '平台不存在' });
    }

    res.json({ success: true, message: '平台已删除' });
  } catch (error) {
    logger.error('删除平台失败:', error);
    res.status(500).json({ success: false, error: '删除平台失败' });
  }
});

// PUT /:id/api-key — Set API key
router.put('/:id/api-key', (req, res) => {
  try {
    const platformId = parseInt(req.params.id);
    if (isNaN(platformId)) {
      return res.status(400).json({ success: false, error: '无效的平台ID' });
    }

    const { apiKey, apiSecret, apiPassphrase } = req.body;
    if (!apiKey || !apiSecret) {
      return res.status(400).json({ success: false, error: '缺少必填字段: apiKey, apiSecret' });
    }

    const platform = db.prepare('SELECT id FROM platforms WHERE id = ?').get(platformId);
    if (!platform) {
      return res.status(404).json({ success: false, error: '平台不存在' });
    }

    const encryptedKey = encrypt(apiKey);
    const encryptedSecret = encrypt(apiSecret);
    const encryptedPassphrase = apiPassphrase ? encrypt(apiPassphrase) : null;

    db.prepare(`
      UPDATE platforms
      SET api_key_encrypted = ?, api_secret_encrypted = ?, api_passphrase_encrypted = ?,
          sync_enabled = 1, updated_at = ?
      WHERE id = ?
    `).run(encryptedKey, encryptedSecret, encryptedPassphrase, Date.now(), platformId);

    res.json({
      success: true,
      data: { apiKeyMasked: maskApiKey(apiKey) },
    });
  } catch (error) {
    logger.error('设置API密钥失败:', error);
    res.status(500).json({ success: false, error: '设置API密钥失败' });
  }
});

// DELETE /:id/api-key — Remove API key
router.delete('/:id/api-key', (req, res) => {
  try {
    const platformId = parseInt(req.params.id);
    if (isNaN(platformId)) {
      return res.status(400).json({ success: false, error: '无效的平台ID' });
    }

    const platform = db.prepare('SELECT id FROM platforms WHERE id = ?').get(platformId);
    if (!platform) {
      return res.status(404).json({ success: false, error: '平台不存在' });
    }

    db.prepare(`
      UPDATE platforms
      SET api_key_encrypted = NULL, api_secret_encrypted = NULL, api_passphrase_encrypted = NULL,
          sync_enabled = 0, updated_at = ?
      WHERE id = ?
    `).run(Date.now(), platformId);

    res.json({ success: true, message: 'API密钥已移除' });
  } catch (error) {
    logger.error('移除API密钥失败:', error);
    res.status(500).json({ success: false, error: '移除API密钥失败' });
  }
});

// --------------- Sub-accounts ---------------

// POST /:id/sub-accounts — Add sub-account to platform
router.post('/:id/sub-accounts', (req, res) => {
  try {
    const platformId = parseInt(req.params.id);
    if (isNaN(platformId)) {
      return res.status(400).json({ success: false, error: '无效的平台ID' });
    }

    const { name, displayName, accountType } = req.body;
    if (!name || !displayName || !accountType) {
      return res.status(400).json({ success: false, error: '缺少必填字段: name, displayName, accountType' });
    }

    const validAccountTypes = ['spot', 'earn', 'futures', 'margin', 'funding', 'unified', 'fund', 'gold', 'other'];
    if (!validAccountTypes.includes(accountType)) {
      return res.status(400).json({ success: false, error: `无效的账户类型，必须为: ${validAccountTypes.join(', ')}` });
    }

    const platform = db.prepare('SELECT id FROM platforms WHERE id = ?').get(platformId);
    if (!platform) {
      return res.status(404).json({ success: false, error: '平台不存在' });
    }

    const existing = db.prepare('SELECT id FROM sub_accounts WHERE platform_id = ? AND name = ?').get(platformId, name);
    if (existing) {
      return res.status(409).json({ success: false, error: '该平台下已存在同名子账户' });
    }

    const result = db.prepare(
      'INSERT INTO sub_accounts (platform_id, name, display_name, account_type) VALUES (?, ?, ?, ?)'
    ).run(platformId, name, displayName, accountType);

    res.status(201).json({
      success: true,
      data: { id: result.lastInsertRowid },
    });
  } catch (error) {
    logger.error('创建子账户失败:', error);
    res.status(500).json({ success: false, error: '创建子账户失败' });
  }
});

// PUT /sub-accounts/:id — Update sub-account
router.put('/sub-accounts/:id', (req, res) => {
  try {
    const subAccountId = parseInt(req.params.id);
    if (isNaN(subAccountId)) {
      return res.status(400).json({ success: false, error: '无效的子账户ID' });
    }

    const { displayName, accountType, syncEnabled } = req.body;

    const subAccount = db.prepare('SELECT id FROM sub_accounts WHERE id = ?').get(subAccountId);
    if (!subAccount) {
      return res.status(404).json({ success: false, error: '子账户不存在' });
    }

    if (accountType !== undefined) {
      const validAccountTypes = ['spot', 'earn', 'futures', 'margin', 'funding', 'unified', 'fund', 'gold', 'other'];
      if (!validAccountTypes.includes(accountType)) {
        return res.status(400).json({ success: false, error: `无效的账户类型，必须为: ${validAccountTypes.join(', ')}` });
      }
    }

    db.prepare(`
      UPDATE sub_accounts
      SET display_name = COALESCE(?, display_name),
          account_type = COALESCE(?, account_type),
          sync_enabled = COALESCE(?, sync_enabled)
      WHERE id = ?
    `).run(
      displayName ?? null,
      accountType ?? null,
      syncEnabled !== undefined ? (syncEnabled ? 1 : 0) : null,
      subAccountId
    );

    res.json({ success: true, message: '子账户更新成功' });
  } catch (error) {
    logger.error('更新子账户失败:', error);
    res.status(500).json({ success: false, error: '更新子账户失败' });
  }
});

// DELETE /sub-accounts/:id — Delete sub-account (CASCADE deletes holdings)
router.delete('/sub-accounts/:id', (req, res) => {
  try {
    const subAccountId = parseInt(req.params.id);
    if (isNaN(subAccountId)) {
      return res.status(400).json({ success: false, error: '无效的子账户ID' });
    }

    const result = db.prepare('DELETE FROM sub_accounts WHERE id = ?').run(subAccountId);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: '子账户不存在' });
    }

    res.json({ success: true, message: '子账户已删除' });
  } catch (error) {
    logger.error('删除子账户失败:', error);
    res.status(500).json({ success: false, error: '删除子账户失败' });
  }
});

// POST /:id/sync — Trigger sync for a platform
router.post('/:id/sync', async (req, res) => {
  try {
    const platformId = parseInt(req.params.id);
    if (isNaN(platformId)) {
      return res.status(400).json({ success: false, error: '无效的平台ID' });
    }

    const { ExchangeSyncService } = await import('../services/ExchangeSyncService');
    const syncService = new ExchangeSyncService();
    const result = await syncService.syncPlatform(platformId);

    res.json({ success: result.success, data: { message: result.message } });
  } catch (error) {
    logger.error('触发同步失败:', error);
    res.status(500).json({ success: false, error: '触发同步失败' });
  }
});

// GET /:id/sync-logs — Get sync history
router.get('/:id/sync-logs', (req, res) => {
  try {
    const platformId = parseInt(req.params.id);
    if (isNaN(platformId)) {
      return res.status(400).json({ success: false, error: '无效的平台ID' });
    }

    const limit = parseInt(req.query.limit as string) || 20;

    const { ExchangeSyncService } = require('../services/ExchangeSyncService');
    const syncService = new ExchangeSyncService();
    const logs = syncService.getSyncLogs(platformId, limit);

    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error('获取同步日志失败:', error);
    res.status(500).json({ success: false, error: '获取同步日志失败' });
  }
});

export default router;
