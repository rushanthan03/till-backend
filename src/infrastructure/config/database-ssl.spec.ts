import { databaseSsl } from './database-ssl';

describe('database SSL setting', () => {
  it('is off in development by default and on in production by default', () => {
    expect(databaseSsl({ NODE_ENV: 'development' })).toBe(false);
    expect(databaseSsl({})).toBe(false);
    expect(databaseSsl({ NODE_ENV: 'production' })).toEqual({ rejectUnauthorized: false });
  });
  it('can be switched off in production for a private-network database', () => {
    expect(databaseSsl({ NODE_ENV: 'production', DATABASE_SSL: 'false' })).toBe(false);
  });
  it('strict mode demands a trusted certificate', () => {
    expect(databaseSsl({ NODE_ENV: 'production', DATABASE_SSL: 'strict' })).toEqual({ rejectUnauthorized: true });
  });
  it('can be switched on outside production', () => {
    expect(databaseSsl({ NODE_ENV: 'development', DATABASE_SSL: 'true' })).toEqual({ rejectUnauthorized: false });
  });
});
