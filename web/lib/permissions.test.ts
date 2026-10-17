import { describe, expect, it } from 'vitest';
import { hasTokenPermission, requireFreshLogin, requireTokenPermission } from './permissions';
describe('fresh Auth0 login', () => {
  it('accepts a recent signed auth_time', () => {
    expect(() => requireFreshLogin(Math.floor(Date.now()/1000) - 30)).not.toThrow();
  });
  it.each([undefined, null, '123', NaN, Infinity, 0, Math.floor(Date.now()/1000)+600])('rejects stale or invalid auth_time %s', value => {
    expect(() => requireFreshLogin(value)).toThrow('Sign in again');
  });
});

describe('Auth0 RBAC permissions claim', () => {
  it('does not apply when the token has no permissions claim, so the circle role decides', () => {
    expect(hasTokenPermission(undefined, 'approve:payments')).toBe(true);
  });
  it('allows a token that lists approve:payments', () => {
    expect(() => requireTokenPermission(['read:payments', 'approve:payments'], 'approve:payments')).not.toThrow();
  });
  it.each([[[]], [['read:payments']]])('refuses a token whose claim lacks it: %j', permissions => {
    expect(() => requireTokenPermission(permissions, 'approve:payments')).toThrow('approve:payments permission required');
  });
});
