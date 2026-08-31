import assert from 'node:assert/strict';
import test from 'node:test';
import { hashPassword, verifyPassword } from '../src/utils/password.js';

test('a hashed password verifies, a wrong one does not', async () => {
  const hash = await hashPassword('ChangeMe!123');
  assert.notEqual(hash, 'ChangeMe!123');
  assert.equal(await verifyPassword('ChangeMe!123', hash), true);
  assert.equal(await verifyPassword('ChangeMe!124', hash), false);
});

test('the same password hashes differently each time (unique salt)', async () => {
  assert.notEqual(await hashPassword('same'), await hashPassword('same'));
});

test('the clerk-managed sentinel can never be logged into', async () => {
  for (const guess of ['clerk-managed', '', 'anything']) {
    assert.equal(await verifyPassword(guess, 'clerk-managed'), false);
  }
});
