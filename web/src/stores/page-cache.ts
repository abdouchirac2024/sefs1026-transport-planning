export function createPageCache<T>() {
  const cache = new Map<number, T>();
  let cachedKey: string | undefined;

  function get(key: string, page: number): T | undefined {
    if (cachedKey !== key) {
      cache.clear();
      cachedKey = key;
    }
    return cache.get(page);
  }

  function set(page: number, value: T): void {
    cache.set(page, value);
  }

  function clear(): void {
    cache.clear();
  }

  return { get, set, clear };
}
