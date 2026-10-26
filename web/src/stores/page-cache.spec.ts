import { describe, expect, it } from 'vitest';
import { createPageCache } from './page-cache';

describe('createPageCache', () => {
  it('rate au premier accès, puis retrouve la valeur après set()', () => {
    const cache = createPageCache<number>();
    expect(cache.get('key', 1)).toBeUndefined();
    cache.set(1, 42);
    expect(cache.get('key', 1)).toBe(42);
  });

  it('isole les pages entre elles sous la même clé', () => {
    const cache = createPageCache<number>();
    cache.get('key', 1);
    cache.set(1, 42);
    expect(cache.get('key', 2)).toBeUndefined();
  });

  it('conserve plusieurs pages tant que la clé ne change pas', () => {
    const cache = createPageCache<number>();
    cache.get('key', 1);
    cache.set(1, 10);
    cache.get('key', 2);
    cache.set(2, 20);
    expect(cache.get('key', 1)).toBe(10);
    expect(cache.get('key', 2)).toBe(20);
  });

  it('vide tout le cache dès que la clé de filtre change', () => {
    const cache = createPageCache<number>();
    cache.get('key-a', 1);
    cache.set(1, 10);
    expect(cache.get('key-b', 1)).toBeUndefined();
  });

  it('ne retrouve pas les pages d’une clé précédente même en y revenant', () => {
    const cache = createPageCache<number>();
    cache.get('key-a', 1);
    cache.set(1, 10);
    cache.get('key-b', 1);
    expect(cache.get('key-a', 1)).toBeUndefined();
  });

  it('clear() vide le cache pour la clé courante', () => {
    const cache = createPageCache<number>();
    cache.get('key', 1);
    cache.set(1, 10);
    cache.clear();
    expect(cache.get('key', 1)).toBeUndefined();
  });
});
