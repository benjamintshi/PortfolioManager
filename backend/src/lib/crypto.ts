import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { logger } from './logger';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('ENCRYPTION_KEY 环境变量未配置或格式错误（需要 64 字符 hex string）');
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * AES-256-GCM 加密
 * 返回格式: iv:authTag:encrypted (hex encoded)
 */
export function encrypt(text: string): string {
  text = text.trim();
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * AES-256-GCM 解密
 */
export function decrypt(data: string): string {
  const key = getEncryptionKey();
  const parts = data.split(':');
  if (parts.length !== 3) {
    throw new Error('加密数据格式错误');
  }
  const [ivHex, tagHex, encHex] = parts;
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

/**
 * 脱敏显示 API Key（只保留末 4 位）
 */
export function maskApiKey(key: string): string {
  if (key.length <= 4) return '****';
  return `${'*'.repeat(key.length - 4)}${key.slice(-4)}`;
}

/**
 * 生成随机 ENCRYPTION_KEY（用于初始化）
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex');
}
