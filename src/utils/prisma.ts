import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "../config"; // Ensure this is your config file that loads dotenv

// Create the connection pool once
const pool = new Pool({
  connectionString: config.database.url,
});

// Create the adapter
const adapter = new PrismaPg(pool);

// Export a single instance of Prisma
export const prisma = new PrismaClient({ adapter });

// Optional: Export the pool if you need to run raw queries elsewhere
export { pool };
