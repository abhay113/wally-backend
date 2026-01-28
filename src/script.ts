#!/usr/bin/env node

import crypto from "crypto";
console.log("\n🔐 Generating AES-256 encryption key...\n");

const key = crypto.randomBytes(32).toString("hex");

console.log("Add this to your .env file as WALLET_ENCRYPTION_KEY:");
console.log("\nWALLET_ENCRYPTION_KEY=" + key);
console.log("\n⚠️  Keep this key secret and secure!");
console.log(
  "⚠️  If you lose this key, all encrypted wallet data will be unrecoverable!\n",
);
