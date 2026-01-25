import { FastifyRequest, FastifyReply } from "fastify";
import { WalletService } from "./wallet.service";
import { UserService } from "../user/user.service";

const walletService = new WalletService();
const userService = new UserService();

/**
 * Get wallet balance
 */
export async function getBalance(request: FastifyRequest, reply: FastifyReply) {
  const user = await userService.getUserByKeycloakId(request.user.keycloakId);
  const balanceInfo = await walletService.getBalance(user.id);

  return reply.send({
    success: true,
    data: {
      balance: balanceInfo.balance,
      stellarBalance: balanceInfo.stellarBalance,
      synced: balanceInfo.synced,
    },
  });
}

/**
 * Fund wallet using Friendbot (testnet only)
 */
export async function fundWallet(request: FastifyRequest, reply: FastifyReply) {
  const user = await userService.getUserByKeycloakId(request.user.keycloakId);
  const result = await walletService.fundWallet(user.id);

  return reply.send({
    success: true,
    data: result,
  });
}

/**
 * Sync wallet balance with Stellar
 */
export async function syncBalance(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const user = await userService.getUserByKeycloakId(request.user.keycloakId);
  const wallet = await walletService.getWalletByUserId(user.id);
  const balance = await walletService.syncBalance(wallet.id);

  return reply.send({
    success: true,
    data: {
      balance,
    },
  });
}
