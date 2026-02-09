import {
  Keypair,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  Operation,
  Asset,
  Memo,
  Horizon, // Horizon contains the Server class in v13+
} from "@stellar/stellar-sdk";

import { config } from "../../config";
import { StellarError } from "../../utils/errors";
import logger from "../../utils/logger";
import { getMasterKeyFromVault } from "../../utils/vault";

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
   * @deprecated Use activateAccount for new user onboarding.
   * This method relies on the public Friendbot and is not scalable.
   */
  // async fundWithFriendbot(publicKey: string): Promise<void> {
  //   if (config.stellar.network !== "testnet") {
  //     throw new StellarError("Friendbot only available on testnet");
  //   }

  //   try {
  //     const response = await fetch(
  //       `${config.stellar.friendbotUrl}?addr=${encodeURIComponent(publicKey)}`,
  //     );

  //     console.log("response from stellar service Api", response);
  //     if (!response.ok) {
  //       throw new StellarError(
  //         `Friendbot funding failed: ${response.statusText}`,
  //       );
  //     }
  //   } catch (error) {
  //     throw new StellarError(
  //       "Failed to fund account with Friendbot getting from stellar service",
  //       {
  //         error: error instanceof Error ? error.message : String(error),
  //       },
  //     );
  //   }
  // }

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

  /**
   * Activates a new Stellar account by funding it from the master account.
   * This is the new standard for user wallet creation.
   * @param destinationPublicKey The public key of the new account to activate.
   */
  async activateAccount(destinationPublicKey: string): Promise<void> {
    logger.info(`Activating new account: ${destinationPublicKey}`);
    try {
      const masterSecret = await getMasterKeyFromVault();
      const masterKeypair = Keypair.fromSecret(masterSecret);
      const sourcePublicKey = masterKeypair.publicKey();

      const sourceAccount = await this.server.loadAccount(sourcePublicKey);

      const transaction = new TransactionBuilder(sourceAccount, {
        fee: await this.server.fetchBaseFee().then((fee) => fee.toString()),
        networkPassphrase:
          config.stellar.network === "testnet"
            ? "Test SDF Network ; September 2015"
            : "Public Global Stellar Network ; September 2015",
      })
        .addOperation(
          Operation.createAccount({
            destination: destinationPublicKey,
            startingBalance: config.stellar.newUserStartingBalance,
          }),
        )
        .setTimeout(30)
        .build();

      transaction.sign(masterKeypair);

      const result = await this.server.submitTransaction(transaction);
      logger.info(
        `Successfully activated account ${destinationPublicKey} in transaction: ${result.hash}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `Failed to activate account ${destinationPublicKey}. Error: ${errorMessage}`,
      );

      throw new StellarError("Failed to activate account on Stellar network.", {
        error: errorMessage,
      });
    }
  }
}

export const stellarService = new StellarService();
