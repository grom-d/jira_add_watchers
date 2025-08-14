import { logger } from '../logger.js';

type Sample = { t: number; ok?: boolean; ms?: number; code?: number };

const WINDOW = 200; // 直近200サンプルで評価

const addSamples: Sample[] = [];
const removeSamples: Sample[] = [];
const resolveSamples: Sample[] = [];

function pushWindow(buf: Sample[], s: Sample) {
  buf.push(s);
  if (buf.length > WINDOW) buf.shift();
}

function rate429(buf: Sample[]) {
  const n = buf.length || 1;
  const c = buf.filter((s) => s.code === 429).length;
  return c / n;
}

function avgLatency(buf: Sample[]) {
  const arr = buf.map((s) => s.ms || 0).filter((x) => x > 0);
  if (arr.length === 0) return 0;
  const sum = arr.reduce((a, b) => a + b, 0);
  return Math.round(sum / arr.length);
}

export const metrics = {
  recordAdd(sample: Sample) {
    pushWindow(addSamples, sample);
    const r429 = rate429(addSamples);
    const avg = avgLatency(addSamples);
    if (r429 > 0.2) logger.warn({ r429, window: addSamples.length }, 'watchers.add: 429率が高い可能性');
    if (avg > 3000) logger.warn({ avgMs: avg }, 'watchers.add: 平均レイテンシが高い');
  },
  recordRemove(sample: Sample) {
    pushWindow(removeSamples, sample);
    const r429 = rate429(removeSamples);
    const avg = avgLatency(removeSamples);
    if (r429 > 0.2) logger.warn({ r429, window: removeSamples.length }, 'watchers.remove: 429率が高い可能性');
    if (avg > 3000) logger.warn({ avgMs: avg }, 'watchers.remove: 平均レイテンシが高い');
  },
  recordResolve(sample: Sample & { outcome?: 'resolved' | 'ambiguous' | 'none' }) {
    pushWindow(resolveSamples, sample);
    const avg = avgLatency(resolveSamples);
    if (avg > 2000) logger.warn({ avgMs: avg }, 'resolve: 平均レイテンシが高い');
  },
};

