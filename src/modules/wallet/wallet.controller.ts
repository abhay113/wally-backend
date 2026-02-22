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
      message: balanceInfo.synced
        ? "Balance is in sync with blockchain"
        : "Balance may be out of sync. Try syncing.",
    },
  });
}

/**
 * Fund wallet using Friendbot (testnet only)
 */
// export async function fundWallet(request: FastifyRequest, reply: FastifyReply) {
//   const user = await userService.getUserByKeycloakId(request.user.keycloakId);
//   const result = await walletService.fundWallet(user.id);

//   return reply.send({
//     success: true,
//     data: {
//       balance: result.balance,
//       message: result.message,
//     },
//   });
// }

/**
 * Fund wallet from master account
 */
export async function fundWallet(request: FastifyRequest, reply: FastifyReply) {
  const { amount } = (request.body as { amount?: string }) || {};
  const user = await userService.getUserByKeycloakId(request.user.keycloakId);
  const result = await walletService.fundWallet(user.id, amount);

  return reply.send({
    success: true,
    data: {
      balance: result.balance,
      transactionHash: result.hash,
      message: result.message,
    },
  });
}

/**
 * Sync wallet balance with Stellar network
 */
export async function syncBalance(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  console.log("request body in sync balance controller", request);
  const user = await userService.getUserByKeycloakId(request.user.keycloakId);
  const wallet = await walletService.getWalletByUserId(user.id);
  const balance = await walletService.syncBalance(wallet.id);

  return reply.send({
    success: true,
    data: {
      balance,
      message: "Balance synced successfully",
    },
  });
}
