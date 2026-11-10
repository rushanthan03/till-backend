import { checkProductionConfig, isOriginAllowed } from './production-checks';

const good = {
  JWT_ACCESS_TOKEN_SECRET: 'k9Qe2vX7mP4tL8zR1nB6yC3wD5uH0jFa',
  JWT_REFRESH_TOKEN_SECRET: 'Zs3Lq8Vn1Mc6Xb9Td2Yr7Hg4Fk0Pw5Ja',
  CORS_ORIGINS: 'https://till.example.com',
  DATABASE_PASSWORD: 'x7Kp!2mQvR9sL',
  NODE_ENV: 'production',
  PAYMENT_PROVIDER: 'stripe',
};

describe('production config checks', () => {
  it('accepts a sound configuration', () => {
    expect(checkProductionConfig(good)).toEqual({ errors: [], warnings: [] });
  });
  it('rejects short, placeholder and identical JWT secrets', () => {
    expect(checkProductionConfig({ ...good, JWT_ACCESS_TOKEN_SECRET: 'short' }).errors.join()).toMatch(/JWT_ACCESS_TOKEN_SECRET/);
    expect(checkProductionConfig({ ...good, JWT_REFRESH_TOKEN_SECRET: 'change-me-to-a-long-random-string-please' }).errors.join()).toMatch(/placeholder/);
    expect(checkProductionConfig({ ...good, JWT_REFRESH_TOKEN_SECRET: good.JWT_ACCESS_TOKEN_SECRET }).errors.join()).toMatch(/different/);
  });
  it('requires CORS origins and a non-default database password', () => {
    expect(checkProductionConfig({ ...good, CORS_ORIGINS: undefined }).errors.join()).toMatch(/CORS_ORIGINS/);
    expect(checkProductionConfig({ ...good, DATABASE_PASSWORD: 'root' }).errors.join()).toMatch(/DATABASE_PASSWORD/);
  });
  it('warns about the simulated card terminal and default super admin password', () => {
    const w = checkProductionConfig({ ...good, PAYMENT_PROVIDER: undefined, SUPER_ADMIN_PASSWORD: 'Admin@12345' }).warnings.join();
    expect(w).toMatch(/simulated/);
    expect(w).toMatch(/SUPER_ADMIN_PASSWORD/);
  });
});

describe('CORS origin check', () => {
  it('allows everything in development', () => {
    expect(isOriginAllowed('http://localhost:5173', undefined, false)).toBe(true);
  });
  it('only allows the listed origins in production, ignoring a trailing slash', () => {
    expect(isOriginAllowed('https://till.example.com', 'https://till.example.com/, https://b.example.com', true)).toBe(true);
    expect(isOriginAllowed('https://evil.example.com', 'https://till.example.com', true)).toBe(false);
  });
  it('blocks all browser origins in production when none are listed', () => {
    expect(isOriginAllowed('https://till.example.com', undefined, true)).toBe(false);
  });
  it('always lets the desktop till and non-browser clients in', () => {
    expect(isOriginAllowed('app://till', 'https://x.com', true)).toBe(true);
    expect(isOriginAllowed(undefined, 'https://x.com', true)).toBe(true);
  });
});
