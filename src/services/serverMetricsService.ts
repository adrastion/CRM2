import os from 'os';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { prisma } from '../lib/prisma';

const execFileAsync = promisify(execFile);

export interface ServerMetricsSnapshot {
  timestamp: string;
  cpuPercent: number;
  memoryPercent: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  load1: number;
  load5: number;
  load15: number;
  diskPercent: number;
  diskUsedGb: number;
  diskTotalGb: number;
  cpuCores: number;
  processUptimeSec: number;
  hostUptimeSec: number;
}

export type HistoryRange = '1h' | '6h' | '24h' | '7d' | '30d';

interface CpuTimes {
  idle: number;
  total: number;
}

let previousCpu: CpuTimes | null = null;

function readCpuTimes(): CpuTimes | null {
  try {
    if (process.platform === 'linux' && fs.existsSync('/proc/stat')) {
      const firstLine = fs.readFileSync('/proc/stat', 'utf8').split('\n')[0];
      const parts = firstLine.trim().split(/\s+/).slice(1).map(Number);
      if (parts.length < 4) return null;
      const idle = (parts[3] || 0) + (parts[4] || 0);
      const total = parts.reduce((sum, n) => sum + (n || 0), 0);
      return { idle, total };
    }

    const cpus = os.cpus();
    let idle = 0;
    let total = 0;
    for (const cpu of cpus) {
      idle += cpu.times.idle;
      total +=
        cpu.times.user +
        cpu.times.nice +
        cpu.times.sys +
        cpu.times.idle +
        cpu.times.irq;
    }
    return { idle, total };
  } catch {
    return null;
  }
}

function computeCpuPercent(): number {
  const current = readCpuTimes();
  if (!current) return 0;

  if (!previousCpu || previousCpu.total === 0) {
    previousCpu = current;
    return 0;
  }

  const idleDelta = current.idle - previousCpu.idle;
  const totalDelta = current.total - previousCpu.total;
  previousCpu = current;

  if (totalDelta <= 0) return 0;
  const usage = (1 - idleDelta / totalDelta) * 100;
  return Math.max(0, Math.min(100, Math.round(usage * 10) / 10));
}

function readMemory(): { usedMb: number; totalMb: number; percent: number } {
  const totalBytes = os.totalmem();
  let availableBytes = os.freemem();

  try {
    if (process.platform === 'linux' && fs.existsSync('/proc/meminfo')) {
      const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
      const availableMatch = meminfo.match(/^MemAvailable:\s+(\d+)\s+kB/m);
      if (availableMatch) {
        availableBytes = parseInt(availableMatch[1], 10) * 1024;
      }
    }
  } catch {
    // fallback to os.freemem()
  }

  const usedBytes = Math.max(0, totalBytes - availableBytes);
  const totalMb = Math.round((totalBytes / (1024 * 1024)) * 10) / 10;
  const usedMb = Math.round((usedBytes / (1024 * 1024)) * 10) / 10;
  const percent =
    totalBytes > 0
      ? Math.round((usedBytes / totalBytes) * 1000) / 10
      : 0;

  return { usedMb, totalMb, percent };
}

async function readDisk(): Promise<{ usedGb: number; totalGb: number; percent: number }> {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync('wmic', [
        'logicaldisk',
        'where',
        "DeviceID='C:'",
        'get',
        'Size,FreeSpace',
        '/format:csv',
      ]);
      const lines = stdout
        .trim()
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const dataLine = lines[lines.length - 1];
      const parts = dataLine.split(',');
      const free = parseFloat(parts[parts.length - 2]);
      const size = parseFloat(parts[parts.length - 1]);
      if (size > 0) {
        const used = size - free;
        return {
          usedGb: Math.round((used / 1e9) * 100) / 100,
          totalGb: Math.round((size / 1e9) * 100) / 100,
          percent: Math.round((used / size) * 1000) / 10,
        };
      }
    } else {
      const { stdout } = await execFileAsync('df', ['-kP', '/']);
      const lines = stdout.trim().split('\n');
      if (lines.length >= 2) {
        const parts = lines[1].trim().split(/\s+/);
        const totalKb = parseFloat(parts[1]);
        const usedKb = parseFloat(parts[2]);
        if (totalKb > 0) {
          return {
            usedGb: Math.round((usedKb / (1024 * 1024)) * 100) / 100,
            totalGb: Math.round((totalKb / (1024 * 1024)) * 100) / 100,
            percent: Math.round((usedKb / totalKb) * 1000) / 10,
          };
        }
      }
    }
  } catch (error) {
    console.error('[ServerMetrics] Failed to read disk usage:', error);
  }

  return { usedGb: 0, totalGb: 0, percent: 0 };
}

/**
 * Собрать текущий снимок метрик без записи в БД.
 * Первый вызов после старта может дать cpu≈0 — следующий будет точным.
 */
export async function collectLiveMetrics(): Promise<ServerMetricsSnapshot> {
  const cpuPercent = computeCpuPercent();
  const memory = readMemory();
  const [load1, load5, load15] = os.loadavg().map((v) => Math.round(v * 100) / 100);
  const disk = await readDisk();
  const cpuCores = os.cpus().length || 1;

  return {
    timestamp: new Date().toISOString(),
    cpuPercent,
    memoryPercent: memory.percent,
    memoryUsedMb: memory.usedMb,
    memoryTotalMb: memory.totalMb,
    load1,
    load5,
    load15,
    diskPercent: disk.percent,
    diskUsedGb: disk.usedGb,
    diskTotalGb: disk.totalGb,
    cpuCores,
    processUptimeSec: Math.floor(process.uptime()),
    hostUptimeSec: Math.floor(os.uptime()),
  };
}

/**
 * Собрать метрики и сохранить сэмпл в БД.
 */
export async function collectAndStoreSample(): Promise<ServerMetricsSnapshot> {
  // Два замера CPU с короткой паузой, если ещё нет baseline
  if (!previousCpu) {
    computeCpuPercent();
    await new Promise((r) => setTimeout(r, 200));
  }

  const snapshot = await collectLiveMetrics();

  await prisma.serverMetricSample.create({
    data: {
      timestamp: new Date(snapshot.timestamp),
      cpuPercent: snapshot.cpuPercent,
      memoryPercent: snapshot.memoryPercent,
      memoryUsedMb: snapshot.memoryUsedMb,
      memoryTotalMb: snapshot.memoryTotalMb,
      load1: snapshot.load1,
      load5: snapshot.load5,
      load15: snapshot.load15,
      diskPercent: snapshot.diskPercent,
      diskUsedGb: snapshot.diskUsedGb,
      diskTotalGb: snapshot.diskTotalGb,
      cpuCores: snapshot.cpuCores,
    },
  });

  return snapshot;
}

const RANGE_CONFIG: Record<
  HistoryRange,
  { ms: number; bucketMs: number | null }
> = {
  '1h': { ms: 60 * 60 * 1000, bucketMs: null },
  '6h': { ms: 6 * 60 * 60 * 1000, bucketMs: 2 * 60 * 1000 },
  '24h': { ms: 24 * 60 * 60 * 1000, bucketMs: 5 * 60 * 1000 },
  '7d': { ms: 7 * 24 * 60 * 60 * 1000, bucketMs: 30 * 60 * 1000 },
  '30d': { ms: 30 * 24 * 60 * 60 * 1000, bucketMs: 2 * 60 * 60 * 1000 },
};

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

export async function getMetricsHistory(range: HistoryRange) {
  const config = RANGE_CONFIG[range] || RANGE_CONFIG['1h'];
  const since = new Date(Date.now() - config.ms);

  const samples = await prisma.serverMetricSample.findMany({
    where: { timestamp: { gte: since } },
    orderBy: { timestamp: 'asc' },
  });

  if (!config.bucketMs) {
    return samples.map((s) => ({
      timestamp: s.timestamp.toISOString(),
      cpuPercent: s.cpuPercent,
      memoryPercent: s.memoryPercent,
      diskPercent: s.diskPercent,
      load1: s.load1,
      load5: s.load5,
      load15: s.load15,
    }));
  }

  const buckets = new Map<
    number,
    {
      cpu: number[];
      mem: number[];
      disk: number[];
      load1: number[];
      load5: number[];
      load15: number[];
    }
  >();

  for (const s of samples) {
    const key = Math.floor(s.timestamp.getTime() / config.bucketMs!) * config.bucketMs!;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { cpu: [], mem: [], disk: [], load1: [], load5: [], load15: [] };
      buckets.set(key, bucket);
    }
    bucket.cpu.push(s.cpuPercent);
    bucket.mem.push(s.memoryPercent);
    bucket.disk.push(s.diskPercent);
    bucket.load1.push(s.load1);
    bucket.load5.push(s.load5);
    bucket.load15.push(s.load15);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([ts, b]) => ({
      timestamp: new Date(ts).toISOString(),
      cpuPercent: avg(b.cpu),
      memoryPercent: avg(b.mem),
      diskPercent: avg(b.disk),
      load1: avg(b.load1),
      load5: avg(b.load5),
      load15: avg(b.load15),
    }));
}

/** Удалить сэмплы старше 30 дней */
export async function cleanupOldMetricSamples(): Promise<number> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const result = await prisma.serverMetricSample.deleteMany({
    where: { timestamp: { lt: cutoff } },
  });
  return result.count;
}
