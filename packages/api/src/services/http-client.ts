// Resilient HTTP client with retry, exponential backoff, and Retry-After support.

interface ResilientFetchOptions extends RequestInit {
  /** Request timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
  /** Maximum number of retry attempts (default: 6) */
  maxRetries?: number;
  /** Base delay for exponential backoff in ms (default: 600) */
  baseDelayMs?: number;
  /** Maximum delay cap in ms (default: 15000) */
  maxDelayMs?: number;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function getRetryAfterMs(response: Response): number | null {
  const header = response.headers.get('Retry-After');
  if (!header) return null;

  const seconds = Number(header);
  if (!Number.isNaN(seconds) && seconds > 0) {
    return seconds * 1000;
  }

  // Retry-After can also be an HTTP-date
  const date = new Date(header);
  if (!Number.isNaN(date.getTime())) {
    const delayMs = date.getTime() - Date.now();
    return delayMs > 0 ? delayMs : null;
  }

  return null;
}

function computeDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exponential = baseDelayMs * Math.pow(2, attempt);
  return Math.min(exponential, maxDelayMs);
}

export async function resilientFetch(
  url: string,
  options: ResilientFetchOptions = {},
): Promise<Response> {
  const {
    timeoutMs = 30_000,
    maxRetries = 6,
    baseDelayMs = 600,
    maxDelayMs = 15_000,
    ...fetchOptions
  } = options;

  const maxAttempts = maxRetries + 1; // first attempt + retries

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[http-client] attempt ${attempt}/${maxAttempts} ${fetchOptions.method ?? 'GET'} ${url}`);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: AbortSignal.timeout(timeoutMs),
      });

      // Non-retryable status — return as-is (caller handles 4xx)
      if (!isRetryableStatus(response.status)) {
        return response;
      }

      // Retryable status but last attempt — return what we got
      if (attempt === maxAttempts) {
        console.log(`[http-client] max attempts reached, returning status ${response.status}`);
        return response;
      }

      // Compute delay: prefer Retry-After header for 429
      const retryAfterMs = response.status === 429 ? getRetryAfterMs(response) : null;
      const delayMs = retryAfterMs ?? computeDelay(attempt - 1, baseDelayMs, maxDelayMs);

      console.log(`[http-client] status ${response.status}, retrying in ${Math.round(delayMs)}ms`);

      // Consume body to free connection
      await response.text().catch(() => {});

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } catch (error: unknown) {
      if (attempt === maxAttempts) {
        throw error;
      }

      const delayMs = computeDelay(attempt - 1, baseDelayMs, maxDelayMs);
      const errMsg = error instanceof Error ? error.message : String(error);
      console.log(`[http-client] error: ${errMsg}, retrying in ${Math.round(delayMs)}ms`);

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // TypeScript: should never reach here, but satisfy the compiler
  throw new Error('[http-client] unexpected: exhausted all attempts without returning');
}
