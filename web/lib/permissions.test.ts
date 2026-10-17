import { describe, expect, it } from 'vitest';
import { requireFreshLogin } from './permissions';
describe('fresh Auth0 login', () => {
  it('accepts a recent signed auth_time', () => {
    expect(() => requireFreshLogin(Math.floor(Date.now()/1000) - 30)).not.toThrow();
  });
  it.each([undefined, null, '123', NaN, Infinity, 0, Math.floor(Date.now()/1000)+600])('rejects stale or invalid auth_time %s', value => {
    expect(() => requireFreshLogin(value)).toThrow('Sign in again');
  });
});
