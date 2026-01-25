import crypto from "crypto";
import { config } from "../../config";

const ALGORITHM = "aes-256-gcm";
const KEY = Buffer.from(config.encryption.walletKey, "hex");

export interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
}

/**
 * Encrypts sensitive data using AES-256-GCM
 */
export function encrypt(plaintext: string): EncryptedData {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

/**
 * Decrypts data encrypted with AES-256-GCM
 */
export function decrypt(encryptedData: EncryptedData): string {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    KEY,
    Buffer.from(encryptedData.iv, "hex"),
  );

  decipher.setAuthTag(Buffer.from(encryptedData.authTag, "hex"));

  let decrypted = decipher.update(encryptedData.encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Encrypts Stellar secret key for storage
 */
export function encryptSecretKey(secretKey: string): {
  encryptedSecret: string;
  iv: string;
} {
  const result = encrypt(secretKey);
  // Combine encrypted data and auth tag for storage
  const encryptedSecret = result.encrypted + ":" + result.authTag;
  return {
    encryptedSecret,
    iv: result.iv,
  };
}

/**
 * Decrypts Stellar secret key from storage
 */
export function decryptSecretKey(encryptedSecret: string, iv: string): string {
  const [encrypted, authTag] = encryptedSecret.split(":");
  if (!encrypted || !authTag) {
    throw new Error("Invalid encrypted secret key format");
  }
  return decrypt({ encrypted, iv, authTag });
}
