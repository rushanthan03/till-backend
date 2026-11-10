/** Settings that are fine on a laptop but dangerous on a live server. Checked when the app starts in production. */
export interface ConfigProblems {
  errors: string[];
  warnings: string[];
}

const WEAK = /change-?me|secret|password|example|default|test/i;

export function checkProductionConfig(env: Record<string, string | undefined>): ConfigProblems {
  const errors: string[] = [];
  const warnings: string[] = [];
  const secret = (name: string) => {
    const v = env[name] ?? '';
    if (v.length < 32) errors.push(`${name} must be a random string of at least 32 characters`);
    else if (WEAK.test(v)) errors.push(`${name} looks like a placeholder; generate a real random secret`);
  };
  secret('JWT_ACCESS_TOKEN_SECRET');
  secret('JWT_REFRESH_TOKEN_SECRET');
  if (env.JWT_ACCESS_TOKEN_SECRET && env.JWT_ACCESS_TOKEN_SECRET === env.JWT_REFRESH_TOKEN_SECRET) errors.push('The access and refresh token secrets must be different');
  if (!env.CORS_ORIGINS) errors.push('CORS_ORIGINS must list the web addresses allowed to call the API (comma separated)');
  if ((env.DATABASE_PASSWORD ?? '') === 'root' || (env.DATABASE_PASSWORD ?? '') === 'postgres') errors.push('DATABASE_PASSWORD is a well-known default');
  if ((env.NODE_ENV ?? '') === 'production' && env.DATABASE_SYNCHRONIZE === 'true') errors.push('Automatic table sync must be off in production; use migrations');
  if (!env.PAYMENT_PROVIDER || env.PAYMENT_PROVIDER === 'simulated') warnings.push('PAYMENT_PROVIDER is "simulated": no real card payments are taken');
  if (env.SUPER_ADMIN_PASSWORD && /^(Admin@12345|SuperAdmin@123)$/.test(env.SUPER_ADMIN_PASSWORD)) warnings.push('SUPER_ADMIN_PASSWORD is the documented default: change the super admin password');
  if (env.ENABLE_SWAGGER === 'true') warnings.push('API documentation (Swagger) is enabled in production');
  return { errors, warnings };
}

/** Is this browser origin allowed to call the API? Desktop till (app://till) is always allowed. */
export function isOriginAllowed(origin: string | undefined, allowList: string | undefined, production: boolean): boolean {
  if (!origin) return true; // no Origin header: server-to-server, curl, mobile
  if (origin === 'app://till') return true;
  if (!allowList) return !production;
  return allowList.split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean).includes(origin.replace(/\/$/, ''));
}
