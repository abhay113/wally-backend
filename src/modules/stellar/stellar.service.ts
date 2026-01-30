import {
  Keypair,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  Operation,
  Asset,
  Memo,
  Horizon, // Horizon contains the Server class in v13+
} from "stellar-sdk";

import { config } from "../../config";
import { StellarError } from "../../utils/errors";

export class StellarService {
  private server: Horizon.Server; // Explicitly typed for Horizon
  private networkPassphrase: string;

  constructor() {
    // In v13, Server is a named export or accessed via Horizon
    this.server = new Horizon.Server(config.stellar.horizonUrl);

    this.networkPassphrase =
      config.stellar.network === "testnet" ? Networks.TESTNET : Networks.PUBLIC;

    console.log(`✓ Stellar service initialized (${config.stellar.network})`);
  }

  /**
   * Generates a new Stellar keypair
   */
  generateKeypair(): { publicKey: string; secretKey: string } {
    const keypair = Keypair.random();
    return {
      publicKey: keypair.publicKey(),
      secretKey: keypair.secret(),
    };
  }

  /**
   * Funds an account using Friendbot (testnet only)
   */
  async fundWithFriendbot(publicKey: string): Promise<void> {
    if (config.stellar.network !== "testnet") {
      throw new StellarError("Friendbot only available on testnet");
    }

    try {
      const response = await fetch(
        `${config.stellar.friendbotUrl}?addr=${encodeURIComponent(publicKey)}`,
      );

      if (!response.ok) {
        throw new StellarError(
          `Friendbot funding failed: ${response.statusText}`,
        );
      }
    } catch (error) {
      throw new StellarError("Failed to fund account with Friendbot", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Gets account balance in XLM
   */
  async getBalance(publicKey: string): Promise<string> {
    try {
      const account = await this.server.loadAccount(publicKey);
      const nativeBalance = account.balances.find(
        (balance: any) => balance.asset_type === "native",
      );

      return nativeBalance?.balance || "0";
    } catch (error: any) {
      // Modern way to check for 404 in Stellar SDK
      if (error.response?.status === 404) {
        return "0";
      }
      throw new StellarError("Failed to get account balance");
    }
  }

  /**
   * Sends payment from one account to another
   */
  async sendPayment(params: {
    fromSecretKey: string;
    toPublicKey: string;
    amount: string;
    memo?: string;
  }): Promise<{ hash: string; ledger: number }> {
    const { fromSecretKey, toPublicKey, amount, memo } = params;

    try {
      const sourceKeypair = Keypair.fromSecret(fromSecretKey);
      const sourceAccount = await this.server.loadAccount(
        sourceKeypair.publicKey(),
      );

      const transaction = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          Operation.payment({
            destination: toPublicKey,
            asset: Asset.native(),
            amount: amount,
          }),
        )
        .setTimeout(30);

      if (memo) {
        // transaction.addMemo(Memo.text(memo));
        const memoText = memo.length > 28 ? memo.substring(0, 28) : memo;
        transaction.addMemo(Memo.text(memoText));
      }

      const builtTransaction = transaction.build();
      builtTransaction.sign(sourceKeypair);

      const result = await this.server.submitTransaction(builtTransaction);

      return {
        hash: result.hash,
        ledger: result.ledger,
      };
    } catch (error: any) {
      // Latest error parsing for Horizon
      const detail =
        error.response?.data?.extras?.result_codes?.operations?.[0] ||
        error.message;
      throw new StellarError(`Payment failed: ${detail}`);
    }
  }

  /**
   * Stream payments (for monitoring wallet-engine)
   */
  streamPayments(
    publicKey: string,
    onPayment: (payment: Horizon.ServerApi.PaymentOperationRecord) => void,
  ): () => void {
    const closeStream = this.server
      .payments()
      .forAccount(publicKey)
      .cursor("now")
      .stream({
        onmessage: (payment) => {
          if (payment.type === "payment") {
            onPayment(payment as Horizon.ServerApi.PaymentOperationRecord);
          }
        },
        onerror: (error) => {
          console.error("Stellar Stream Error:", error);
        },
      });

    return closeStream;
  }
}

export const stellarService = new StellarService();
