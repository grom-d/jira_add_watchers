type Entry<V> = { v: V; exp: number };

export class LruTtl<K, V> {
  private map = new Map<K, Entry<V>>();
  constructor(private max: number = 200, private ttlMs: number = 60_000) {}

  get(key: K): V | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (e.exp < Date.now()) { this.map.delete(key); return undefined; }
    // LRU: 再挿入で末尾に移動
    this.map.delete(key);
    this.map.set(key, e);
    return e.v;
  }

  set(key: K, val: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { v: val, exp: Date.now() + this.ttlMs });
    if (this.map.size > this.max) {
      const k = this.map.keys().next().value as K | undefined;
      if (k !== undefined) this.map.delete(k);
    }
  }
}

