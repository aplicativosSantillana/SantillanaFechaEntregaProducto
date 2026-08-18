import sql from "mssql";

const WRITE_KEYWORDS = /\b(insert|update|delete|drop|alter|truncate|merge|exec|execute|create)\b/i;

const config: sql.config = {
  server: process.env.SQLSERVER_HOST!,
  port: process.env.SQLSERVER_PORT ? Number(process.env.SQLSERVER_PORT) : 1433,
  database: process.env.SQLSERVER_DATABASE!,
  user: process.env.SQLSERVER_USER!,
  password: process.env.SQLSERVER_PASSWORD!,
  options: {
    encrypt: true,
    trustServerCertificate: process.env.SQLSERVER_TRUST_CERT === "true",
  },
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let poolPromise: Promise<sql.ConnectionPool> | null = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect();
  }
  return poolPromise;
}

/**
 * Read-only query against the existing SQL Server. Rejects anything that
 * isn't a SELECT as a code-level backstop; the SQL login itself should also
 * be provisioned with SELECT-only permissions.
 */
export async function queryReadOnly<T = unknown>(
  queryText: string,
  inputs: Record<string, unknown> = {}
): Promise<T[]> {
  const trimmed = queryText.trim();
  if (!/^select\b/i.test(trimmed) || WRITE_KEYWORDS.test(trimmed)) {
    throw new Error("queryReadOnly only accepts plain SELECT statements");
  }

  const pool = await getPool();
  const request = pool.request();
  for (const [key, value] of Object.entries(inputs)) {
    request.input(key, value);
  }
  const result = await request.query<T>(trimmed);
  return result.recordset;
}
