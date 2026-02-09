import vault from "node-vault";
import { config } from "../config";
import { AppError } from "./errors";
import logger from "./logger";

let vaultClient: vault.client | null = null;

const getVaultClient = (): vault.client => {
  if (vaultClient) {
    return vaultClient;
  }

  try {
    const client = vault({
      apiVersion: "v1",
      endpoint: config.vault.address,
      token: config.vault.token,
    });
    logger.info("Vault client initialized successfully.");
    vaultClient = client;
    return client;
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to initialize Vault client",
    );

    throw new AppError(
      "INTERNAL_SERVER_ERROR",
      "Could not initialize Vault client.",
    );
  }
};

export const getMasterKeyFromVault = async (): Promise<string> => {
  try {
    const client = getVaultClient();
    const { data } = await client.read(config.vault.masterSecretPath);
    // For KV v2 secrets engine, the secrets are in a 'data' sub-object
    const secret = data?.data?.[config.vault.masterSecretKeyField];

    if (!secret) {
      throw new Error(
        `Secret field '${config.vault.masterSecretKeyField}' not found at path '${config.vault.masterSecretPath}'`,
      );
    }
    return secret;
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to retrieve master account secret from Vault",
    );

    throw new AppError(
      "INTERNAL_SERVER_ERROR",
      "Failed to retrieve master account secret.",
    );
  }
};
