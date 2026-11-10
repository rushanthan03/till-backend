/**
 * Whether and how to use SSL for the PostgreSQL connection.
 *   DATABASE_SSL=false   no SSL (a database on the same machine or private network, local development)
 *   DATABASE_SSL=true    SSL, accepting the server's certificate (the default in production; typical for managed databases)
 *   DATABASE_SSL=strict  SSL, and the certificate must be valid and trusted
 */
export function databaseSsl(env: { NODE_ENV?: string; DATABASE_SSL?: string }): false | { rejectUnauthorized: boolean } {
  const mode = (env.DATABASE_SSL ?? (env.NODE_ENV === 'production' ? 'true' : 'false')).toLowerCase();
  if (mode === 'false' || mode === '0' || mode === 'off') return false;
  return { rejectUnauthorized: mode === 'strict' };
}
