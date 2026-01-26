import {
  Keypair,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  Operation,
  Asset,
  Memo,
  Account,
  Horizon,
} from "stellar-sdk";
import { Server } from "stellar-sdk/lib/horizon";
import { config } from "../../config";
import { StellarError, InternalServerError } from "../../utils/errors";

export class StellarService {
  private server: Server;
  private networkPassphrase: string;

  constructor() {
    this.server = new Server(config.stellar.horizonUrl);
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
      if (error instanceof StellarError) throw error;
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
        (balance) => balance.asset_type === "native",
      );

      return nativeBalance?.balance || "0";
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Request failed with status code 404")
      ) {
        return "0";
      }
      throw new StellarError("Failed to get account balance", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Sends payment from one account to another
   * Returns transaction hash on success
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
      const sourcePublicKey = sourceKeypair.publicKey();

      // Load source account
      const sourceAccount = await this.server.loadAccount(sourcePublicKey);

      // Build transaction
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

      // Add memo if provided (used for linking to internal transaction ID)
      if (memo) {
        transaction.addMemo(Memo.text(memo));
      }

      const builtTransaction = transaction.build();
      builtTransaction.sign(sourceKeypair);

      // Submit transaction
      const result = await this.server.submitTransaction(builtTransaction);

      return {
        hash: result.hash,
        ledger: result.ledger,
      };
    } catch (error) {
      if (error instanceof Error) {
        // Parse Stellar error details
        if ("response" in error) {
          // const horizonError = error as Horizon.HorizonApi.ErrorResponseData;
          const horizonError =
            error as unknown as Horizon.HorizonApi.ErrorResponseData;

          throw new StellarError("Stellar transaction failed", {
            error: error.message,
            // extras: horizonError.extras,
          });
        }
        throw new StellarError("Payment failed", { error: error.message });
      }
      throw new StellarError("Unknown payment error");
    }
  }

  /**
   * Gets transaction details by hash
   */
  async getTransaction(
    hash: string,
  ): Promise<Horizon.ServerApi.TransactionRecord | null> {
    try {
      const transaction = await this.server
        .transactions()
        .transaction(hash)
        .call();
      return transaction;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Request failed with status code 404")
      ) {
        return null;
      }
      throw new StellarError("Failed to get transaction", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Validates if an account exists on the network
   */
  async accountExists(publicKey: string): Promise<boolean> {
    try {
      await this.server.loadAccount(publicKey);
      return true;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Request failed with status code 404")
      ) {
        return false;
      }
      throw new StellarError("Failed to check account existence", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Validates Stellar public key format
   */
  isValidPublicKey(publicKey: string): boolean {
    try {
      Keypair.fromPublicKey(publicKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Stream payments to an account (for monitoring incoming transactions)
   */
  streamPayments(
    publicKey: string,
    onPayment: (payment: Horizon.ServerApi.PaymentOperationRecord) => void,
  ): () => void {
    const stream = this.server
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
          console.error("Payment stream error:", error);
        },
      });

    return () => stream();
  }
}

export const stellarService = new StellarService();
