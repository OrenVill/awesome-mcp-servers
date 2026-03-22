import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { homedir } from 'os';
import { getMCPConfig } from '../config.js';

const DEBOUNCE_MS = 2000;

function expandPath(path: string): string {
  if (path.startsWith('~')) {
    return path.replace(/^~($|\/)/, `${homedir()}$1`);
  }
  return path;
}

export class UsageTracker {
  private counts: Record<string, number> = {};
  private filePath: string;
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(usageFilePath?: string) {
    this.filePath = expandPath(
      usageFilePath ?? getMCPConfig().usageFile
    );
  }

  increment(toolName: string): void {
    this.counts[toolName] = (this.counts[toolName] ?? 0) + 1;
    this.scheduleFlush();
  }

  getTopN(n: number): string[] {
    return Object.entries(this.counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, n)
      .map(([name]) => name);
  }

  load(): void {
    try {
      const raw = readFileSync(this.filePath, 'utf-8');
      const data = JSON.parse(raw) as Record<string, number>;
      this.counts = typeof data === 'object' && data !== null ? data : {};
    } catch {
      this.counts = {};
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimeout !== null) {
      clearTimeout(this.flushTimeout);
    }
    this.flushTimeout = setTimeout(() => {
      this.flushTimeout = null;
      void this.flush();
    }, DEBOUNCE_MS);
  }

  async flush(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.writeToFile();
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  flushSync(): void {
    if (this.flushTimeout !== null) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    this.writeToFile();
  }

  private writeToFile(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.filePath, JSON.stringify(this.counts, null, 2), 'utf-8');
  }
}
