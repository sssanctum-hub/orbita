import { test } from 'node:test';
import assert from 'node:assert/strict';
import { androidPath } from './svg-path.mjs';

test('separates adjacent arc flags and coordinates from the reported crash', () => {
  assert.equal(androidPath('M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2'),
    'M 20.001 19 A 2 2 0 0 0 22 17 V 5 a 2 2 0 0 0 -1.999 -2');
});
test('preserves implicit lineto and exponent numbers', () => {
  assert.equal(androidPath('M1,2 3,4l.5-.5 1e-2 2z'), 'M 1 2 L 3 4 l .5 -.5 l 1e-2 2 z');
});
test('normalization is idempotent', () => {
  const path = 'M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z';
  assert.equal(androidPath(androidPath(path)), androidPath(path));
});
