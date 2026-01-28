import { z } from "zod";
import { WALLET_STATUS } from "../../utils/constants";

/**
 * Zod schemas for wallet-related API validation
 * These validate incoming HTTP request data
 */

// Fund wallet request (no body needed currently, but prepared for future)
export const fundWalletSchema = z.object({
  // Currently no body params needed for testnet funding
  // Future: Could add custom amount for other funding methods
  // amount: z.number().positive().optional()
});

export type FundWalletInput = z.infer<typeof fundWalletSchema>;

// Sync balance request (no body needed)
export const syncBalanceSchema = z.object({
  // No params needed - syncs current user's wallet
});

export type SyncBalanceInput = z.infer<typeof syncBalanceSchema>;

// Update wallet status (admin only)
export const updateWalletStatusSchema = z.object({
  status: z.enum(
    [WALLET_STATUS.ACTIVE, WALLET_STATUS.FROZEN, WALLET_STATUS.CLOSED],
    {
      error: () => ({ message: "Status must be ACTIVE, FROZEN, or CLOSED" }),
    },
  ),
});

export type UpdateWalletStatusInput = z.infer<typeof updateWalletStatusSchema>;

// Get wallet by ID params (admin only)
export const getWalletByIdParamsSchema = z.object({
  walletId: z.string().uuid("Invalid wallet ID format"),
});

export type GetWalletByIdParams = z.infer<typeof getWalletByIdParamsSchema>;

// Stellar public key validation helper
export const stellarPublicKeySchema = z
  .string()
  .regex(/^G[A-Z0-9]{55}$/, "Invalid Stellar public key format");

export type StellarPublicKey = z.infer<typeof stellarPublicKeySchema>;

// Stellar secret key validation (INTERNAL USE ONLY - never expose in API)
export const stellarSecretKeySchema = z
  .string()
  .regex(/^S[A-Z0-9]{55}$/, "Invalid Stellar secret key format");

export type StellarSecretKey = z.infer<typeof stellarSecretKeySchema>;

// Amount validation helper (for XLM amounts)
export const xlmAmountSchema = z
  .string()
  .regex(/^\d+(\.\d{1,7})?$/, "Invalid XLM amount format")
  .refine(
    (val) => {
      const num = parseFloat(val);
      return num > 0 && num <= 100000000; // Max 100M XLM
    },
    { message: "Amount must be positive and reasonable" },
  );

export type XLMAmount = z.infer<typeof xlmAmountSchema>;

// Withdraw request schema (future feature - not implemented yet)
export const withdrawRequestSchema = z.object({
  destinationAddress: stellarPublicKeySchema,
  amount: xlmAmountSchema,
  memo: z.string().max(28).optional(), // Stellar memo max 28 bytes
});

export type WithdrawRequestInput = z.infer<typeof withdrawRequestSchema>;
