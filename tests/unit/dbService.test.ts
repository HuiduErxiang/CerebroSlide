import { describe, it, expect, beforeEach } from 'vitest';
import { saveToDB, getFromDB } from '../../src/services/dbService';

describe('dbService', () => {
  it('saves and retrieves a value', async () => {
    await saveToDB('test-key-1', { foo: 'bar' });
    const result = await getFromDB('test-key-1');
    expect(result).toEqual({ foo: 'bar' });
  });

  it('returns undefined for missing key', async () => {
    const result = await getFromDB('nonexistent-key-xyz-123');
    expect(result).toBeUndefined();
  });

  it('overwrites existing value', async () => {
    await saveToDB('overwrite-key', [1, 2, 3]);
    await saveToDB('overwrite-key', [4, 5, 6]);
    const result = await getFromDB('overwrite-key');
    expect(result).toEqual([4, 5, 6]);
  });

  it('stores arrays of projects', async () => {
    const projects = [
      { id: '1', name: 'Project A', createdAt: 1000, slides: [] },
      { id: '2', name: 'Project B', createdAt: 2000, slides: [] },
    ];
    await saveToDB('projects-test', projects);
    const result = await getFromDB('projects-test');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Project A');
  });

  it('handles independent keys without interference', async () => {
    await saveToDB('key-a-unique', 'value-a');
    await saveToDB('key-b-unique', 'value-b');
    expect(await getFromDB('key-a-unique')).toBe('value-a');
    expect(await getFromDB('key-b-unique')).toBe('value-b');
  });
});
