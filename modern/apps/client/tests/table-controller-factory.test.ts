import { describe, expect, it } from 'vitest';
import { buildTableScopedRouteUrl } from '../src/table-controller-factory.ts';

describe('table controller factory route scoping', () => {
  it('returns base route when table id is absent', () => {
    expect(buildTableScopedRouteUrl('', '/api/table/state')).toBe('/api/table/state');
  });

  it('appends encoded table id query to relative route', () => {
    expect(buildTableScopedRouteUrl('', '/api/table/state', 'atlas-01')).toBe('/api/table/state?tableId=atlas-01');
  });

  it('appends encoded table id query to absolute route', () => {
    expect(buildTableScopedRouteUrl('https://example.test', '/api/table/command', 'table alpha')).toBe(
      'https://example.test/api/table/command?tableId=table%20alpha',
    );
  });
});
