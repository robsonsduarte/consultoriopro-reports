// FIFO concurrency limiter — limits parallel async operations.

interface QueueEntry {
  resolve: () => void;
}

export class ConcurrencyLimiter {
  private running = 0;
  private readonly maxConcurrency: number;
  private readonly queue: QueueEntry[] = [];

  constructor(maxConcurrency: number) {
    if (maxConcurrency < 1) {
      throw new Error('maxConcurrency must be >= 1');
    }
    this.maxConcurrency = maxConcurrency;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    // Wait for a slot if at capacity
    if (this.running >= this.maxConcurrency) {
      await new Promise<void>((resolve) => {
        this.queue.push({ resolve });
      });
    }

    this.running++;

    try {
      return await fn();
    } finally {
      this.running--;
      this.releaseNext();
    }
  }

  private releaseNext(): void {
    const next = this.queue.shift();
    if (next) {
      next.resolve();
    }
  }
}
