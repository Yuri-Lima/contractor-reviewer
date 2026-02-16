import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

@Injectable()
export class EncryptionService {
  private readonly key: Buffer | null;

  constructor(private configService: ConfigService) {
    const keyHex = this.configService.get<string>('PARSER_KEYS_ENCRYPTION_KEY');
    if (!keyHex || keyHex.length !== KEY_LENGTH * 2) {
      this.key = null;
      return;
    }
    this.key = Buffer.from(keyHex, 'hex');
  }

  private ensureKey(): Buffer {
    if (!this.key) {
      throw new Error(
        'PARSER_KEYS_ENCRYPTION_KEY is not set. Generate with: openssl rand -hex 32',
      );
    }
    return this.key;
  }

  encrypt(plaintext: string): string {
    const key = this.ensureKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  decrypt(ciphertext: string): string {
    const key = this.ensureKey();
    const buf = Buffer.from(ciphertext, 'base64');
    if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error('Invalid encrypted payload');
    }
    const iv = buf.subarray(0, IV_LENGTH);
    const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }
}
