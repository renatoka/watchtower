export interface CircuitBreakerConfig {
  failureThreshold: number // Number of failures before opening circuit
  resetTimeout: number // Time in ms before attempting to close circuit
  monitoringPeriod: number // Time window for counting failures
  minimumRequests: number // Minimum requests before evaluating circuit
  onStateChange?: (state: CircuitState) => void
}

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED
  private failures: number = 0
  private successes: number = 0
  private lastFailureTime: number = 0
  private nextAttempt: number = 0
  private requestCount: number = 0
  private requestTimestamps: number[] = []

  constructor(
    private name: string,
    private config: CircuitBreakerConfig
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.cleanOldTimestamps()

    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker is OPEN for ${this.name}`)
      }

      this.state = CircuitState.HALF_OPEN
      this.config.onStateChange?.(this.state)
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failures = 0
    this.requestCount++
    this.requestTimestamps.push(Date.now())

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++

      if (this.successes >= this.config.minimumRequests) {
        this.state = CircuitState.CLOSED
        this.successes = 0
        this.config.onStateChange?.(this.state)
      }
    }
  }

  private onFailure(): void {
    this.failures++
    this.successes = 0
    this.lastFailureTime = Date.now()
    this.requestCount++
    this.requestTimestamps.push(Date.now())

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN
      this.nextAttempt = Date.now() + this.config.resetTimeout
      this.config.onStateChange?.(this.state)
      return
    }

    if (this.requestCount >= this.config.minimumRequests) {
      const failureRate = this.failures / this.requestCount
      if (failureRate >= this.config.failureThreshold / 100) {
        this.state = CircuitState.OPEN
        this.nextAttempt = Date.now() + this.config.resetTimeout
        this.config.onStateChange?.(this.state)
      }
    }
  }

  private cleanOldTimestamps(): void {
    const cutoff = Date.now() - this.config.monitoringPeriod
    this.requestTimestamps = this.requestTimestamps.filter((ts) => ts > cutoff)

    if (this.requestTimestamps.length === 0) {
      this.failures = 0
      this.successes = 0
      this.requestCount = 0
    }
  }

  getState(): CircuitState {
    return this.state
  }

  getStats() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      requestCount: this.requestCount,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt,
    }
  }

  reset(): void {
    this.state = CircuitState.CLOSED
    this.failures = 0
    this.successes = 0
    this.requestCount = 0
    this.lastFailureTime = 0
    this.nextAttempt = 0
    this.requestTimestamps = []
  }
}

export class CircuitBreakerFactory {
  private breakers = new Map<string, CircuitBreaker>()

  constructor(private defaultConfig: CircuitBreakerConfig) {}

  get(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const finalConfig = { ...this.defaultConfig, ...config }
      this.breakers.set(name, new CircuitBreaker(name, finalConfig))
    }
    return this.breakers.get(name)!
  }

  getAllStats() {
    const stats: Record<string, any> = {}
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats()
    }
    return stats
  }

  reset(name: string): void {
    this.breakers.get(name)?.reset()
  }

  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset()
    }
  }
}

export const circuitBreakerFactory = new CircuitBreakerFactory({
  failureThreshold: 50, // Open circuit at 50% failure rate
  resetTimeout: 30000, // Try again after 30 seconds
  monitoringPeriod: 60000, // Monitor over 1 minute window
  minimumRequests: 5, // Need at least 5 requests to evaluate
  onStateChange: (state) => {
    console.log(`🔌 Circuit breaker state changed to: ${state}`)
  },
})
