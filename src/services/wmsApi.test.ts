import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiUrl } from './wmsApi';

describe('resolveApiUrl (frontend/backend decoupling)', () => {
  it('returns relative path unchanged when baseUrl is empty', () => {
    assert.equal(resolveApiUrl('/api/wms/state', ''), '/api/wms/state');
  });

  it('prefixes path with baseUrl and trims trailing slashes', () => {
    assert.equal(
      resolveApiUrl('/api/wms/state', 'http://localhost:5000/'),
      'http://localhost:5000/api/wms/state'
    );
    assert.equal(
      resolveApiUrl('api/auth/login', 'https://api.factory-wms.local///'),
      'https://api.factory-wms.local/api/auth/login'
    );
  });

  it('keeps absolute URLs untouched even when baseUrl is configured', () => {
    assert.equal(
      resolveApiUrl('http://127.0.0.1:9100/available', 'http://localhost:5000'),
      'http://127.0.0.1:9100/available'
    );
  });
});
