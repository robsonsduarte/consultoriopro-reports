// Circuit breaker pattern: CLOSED -> OPEN -> HALF_OPEN

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit (default: 3) */
  threshold?: number;
  /** Time in ms to wait before transitioning from OPEN to HALF_OPEN (default: 300000 = 5min) */
  resetTimeoutMs?: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failCount = 0;
  private readonly threshold: number;
  private readonly resetTimeoutMs: number;
  private nextAttemptAt = 0;

  constructor(options: CircuitBreakerOptions = {}) {
    this.threshold = options.threshold ?? 3;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 300_000;
  }

  getState(): CircuitState {
    // Auto-transition from OPEN to HALF_OPEN when timer expires
    if (this.state === 'OPEN' && Date.now() >= this.nextAttemptAt) {
      this.state = 'HALF_OPEN';
      console.log('[circuit-breaker] OPEN -> HALF_OPEN (timer expired)');
    }
    return this.state;
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failCount = 0;
    this.nextAttemptAt = 0;
    console.log('[circuit-breaker] manually reset to CLOSED');
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      const remainingSec = Math.round((this.nextAttemptAt - Date.now()) / 1000);
      throw new Error(`[circuit-breaker] circuit is OPEN, rejecting request (retry in ${remainingSec}s)`);
    }

    try {
      const result = await fn();

      // Success: reset to CLOSED
      if (this.state === 'HALF_OPEN') {
        console.log('[circuit-breaker] HALF_OPEN -> CLOSED (success)');
      }
      this.state = 'CLOSED';
      this.failCount = 0;

      return result;
    } catch (error) {
      this.failCount++;

      if (this.state === 'HALF_OPEN') {
        // Test request failed — back to OPEN
        this.state = 'OPEN';
        this.nextAttemptAt = Date.now() + this.resetTimeoutMs;
        console.log(`[circuit-breaker] HALF_OPEN -> OPEN (test failed, failCount=${this.failCount})`);
      } else if (this.failCount >= this.threshold) {
        // Threshold reached — open the circuit
        this.state = 'OPEN';
        this.nextAttemptAt = Date.now() + this.resetTimeoutMs;
        console.log(`[circuit-breaker] CLOSED -> OPEN (failCount=${this.failCount} >= ${this.threshold})`);
      }

      throw error;
    }
  }
}
