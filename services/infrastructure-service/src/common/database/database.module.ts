import {
  Module,
  Global,
  Logger,
  OnModuleDestroy,
  Inject,
} from "@nestjs/common";
import { Pool, types } from "pg";

// TIMESTAMP WITHOUT TIME ZONE columns are stored as UTC in PostgreSQL.
// Force UTC interpretation by appending 'Z' before parsing.
types.setTypeParser(1114, (val: string | null) => (val ? new Date(val + "Z") : null));

const logger = new Logger("DatabaseModule");

const databasePoolFactory = async () => {
  const connectionString = process.env.DATABASE_URL;
  const sslEnabled = process.env.DATABASE_SSL === "true";
  const pool = new Pool({
    ...(connectionString
      ? { connectionString }
      : {
          host: process.env.DATABASE_HOST || "localhost",
          port: parseInt(process.env.DATABASE_PORT || "5432", 10),
          user: process.env.DATABASE_USER || "postgres",
          password: process.env.DATABASE_PASSWORD,
          database: process.env.DATABASE_NAME || "marketplace",
        }),
    ssl:
      sslEnabled || connectionString?.includes("sslmode=require")
        ? { rejectUnauthorized: false }
        : false,
    max: parseInt(process.env.DB_POOL_MAX || "20", 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  try {
    const client = await pool.connect();
    logger.log("Database connected successfully");
    client.release();
  } catch (error: any) {
    logger.error("Database connection failed:", error);
    throw error;
  }

  // Handle runtime pool errors (e.g. lost connections) to prevent crashes
  pool.on("error", (err: any) => {
    logger.error("Unexpected database pool error", err);
  });

  return pool;
};

@Global()
@Module({
  providers: [{ provide: "DATABASE_POOL", useFactory: databasePoolFactory }],
  exports: ["DATABASE_POOL"],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject("DATABASE_POOL") private readonly pool: Pool) {}

  async onModuleDestroy() {
    await this.pool.end();
    logger.log("Database pool closed");
  }
}
