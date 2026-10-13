import assert from 'node:assert/strict';
import test from 'node:test';
import { getAuthCode } from '../src/auth/callback.ts';

test('auth callback accepts the native and web return addresses', () => {
  assert.equal(getAuthCode('mejordia://auth/callback?code=abc%2B123', 'mejordia://auth/callback'), 'abc+123');
  assert.equal(getAuthCode('http://localhost:8082/auth/callback?code=web', 'http://localhost:8082/auth/callback'), 'web');
});
test('unrelated return URLs cannot exchange a login code', () => {
  for (const url of ['other://auth/callback?code=x', 'mejordia://other/callback?code=x', 'mejordia://auth/else?code=x']) {
    assert.throws(() => getAuthCode(url, 'mejordia://auth/callback'));
  }
  assert.throws(() => getAuthCode('https://other.example/auth/callback?code=x', 'https://app.example/auth/callback'));
});
test('provider denial and missing codes are reported without exposing auth parameters', () => {
  assert.throws(() => getAuthCode('mejordia://auth/callback?error=access_denied&error_description=secret', 'mejordia://auth/callback'), /Google no autorizó/);
  assert.throws(() => getAuthCode('mejordia://auth/callback#error=access_denied', 'mejordia://auth/callback'), /Google no autorizó/);
  assert.throws(() => getAuthCode('mejordia://auth/callback', 'mejordia://auth/callback'), /código de acceso/);
});
