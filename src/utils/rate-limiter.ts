/**
 * Rate limiter for Figma API requests
 *
 * Figma API Rate Limits:
 * - 1000 requests per minute per token
 * - 10,000 requests per hour per token
 *
 * This implementation uses a token bucket algorithm with safety margins
 * to prevent hitting rate limits.
 */

import { Logger } from "./logger.js";

/**
 * Sleep utility for async delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RateLimiterConfig {
  /**
   * Maximum requests per minute (default: 900 - 90% of Figma's 1000 limit)
   */
  requestsPerMinute?: number;

  /**
   * Maximum requests per hour (default: 9000 - 90% of Figma's 10000 limit)
   */
  requestsPerHour?: number;

  /**
   * Enable debug logging (default: false)
   */
  debug?: boolean;
}

export class FigmaRateLimiter {
  private requestsThisMinute = 0;
  private requestsThisHour = 0;
  private minuteStart = Date.now();
  private hourStart = Date.now();

  private readonly maxRequestsPerMinute: number;
  private readonly maxRequestsPerHour: number;
  private readonly debug: boolean;

  constructor(config: RateLimiterConfig = {}) {
    // Use 90% of actual limits as safety margin
    this.maxRequestsPerMinute = config.requestsPerMinute ?? 900;
    this.maxRequestsPerHour = config.requestsPerHour ?? 9000;
    this.debug = config.debug ?? false;
  }

  /**
   * Throttle a request, waiting if necessary to stay within rate limits
   *
   * @throws Error if rate limit would be exceeded and waiting is not possible
   */
  async throttle(): Promise<void> {
    const now = Date.now();

    // Reset minute counter if a minute has passed
    if (now - this.minuteStart >= 60000) {
      if (this.debug) {
        Logger.log(
          `[RateLimiter] Minute reset. Requests in last minute: ${this.requestsThisMinute}`,
        );
      }
      this.requestsThisMinute = 0;
      this.minuteStart = now;
    }

    // Reset hour counter if an hour has passed
    if (now - this.hourStart >= 3600000) {
      if (this.debug) {
        Logger.log(`[RateLimiter] Hour reset. Requests in last hour: ${this.requestsThisHour}`);
      }
      this.requestsThisHour = 0;
      this.hourStart = now;
    }

    // Check if we need to wait for minute limit
    if (this.requestsThisMinute >= this.maxRequestsPerMinute) {
      const waitTime = 60000 - (now - this.minuteStart);
      Logger.log(
        `[RateLimiter] Minute rate limit reached (${this.requestsThisMinute}/${this.maxRequestsPerMinute}). Waiting ${waitTime}ms`,
      );
      await sleep(waitTime);

      // Reset counters after waiting
      this.requestsThisMinute = 0;
      this.minuteStart = Date.now();
    }

    // Check if we need to wait for hour limit
    if (this.requestsThisHour >= this.maxRequestsPerHour) {
      const waitTime = 3600000 - (now - this.hourStart);
      Logger.log(
        `[RateLimiter] Hour rate limit reached (${this.requestsThisHour}/${this.maxRequestsPerHour}). Waiting ${waitTime}ms`,
      );
      await sleep(waitTime);

      // Reset counters after waiting
      this.requestsThisHour = 0;
      this.hourStart = Date.now();
    }

    // Increment counters
    this.requestsThisMinute++;
    this.requestsThisHour++;

    if (this.debug) {
      Logger.log(
        `[RateLimiter] Request allowed. Minute: ${this.requestsThisMinute}/${this.maxRequestsPerMinute}, Hour: ${this.requestsThisHour}/${this.maxRequestsPerHour}`,
      );
    }
  }

  /**
   * Get current rate limit status
   */
  getStatus(): {
    requestsThisMinute: number;
    requestsThisHour: number;
    maxRequestsPerMinute: number;
    maxRequestsPerHour: number;
    minuteResetIn: number;
    hourResetIn: number;
  } {
    const now = Date.now();
    return {
      requestsThisMinute: this.requestsThisMinute,
      requestsThisHour: this.requestsThisHour,
      maxRequestsPerMinute: this.maxRequestsPerMinute,
      maxRequestsPerHour: this.maxRequestsPerHour,
      minuteResetIn: Math.max(0, 60000 - (now - this.minuteStart)),
      hourResetIn: Math.max(0, 3600000 - (now - this.hourStart)),
    };
  }

  /**
   * Reset all counters (useful for testing)
   */
  reset(): void {
    this.requestsThisMinute = 0;
    this.requestsThisHour = 0;
    this.minuteStart = Date.now();
    this.hourStart = Date.now();
  }
}
