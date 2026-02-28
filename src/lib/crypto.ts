import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/config";

const encryptionKey = Buffer.from(env.ENCRYPTION_KEY_HEX, "hex");
const hmacKey = Buffer.from(env.SESSION_SECRET, "utf8");

export function encrypt(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted].map((chunk) => chunk.toString("base64url")).join(".");
}

export function decrypt(serialized: string): string {
  const [ivText, authTagText, cipherText] = serialized.split(".");
  if (!ivText || !authTagText || !cipherText) {
    throw new Error("Malformed encrypted token");
  }

  const iv = Buffer.from(ivText, "base64url");
  const authTag = Buffer.from(authTagText, "base64url");
  const payload = Buffer.from(cipherText, "base64url");

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]);
  return decrypted.toString("utf8");
}

export function signValue(input: string): string {
  return createHmac("sha256", hmacKey).update(input).digest("base64url");
}

export function secureEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}
