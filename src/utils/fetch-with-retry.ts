import { execFile } from "child_process";
import { promisify } from "util";
import { Logger } from "./logger.js";
import { FigmaAPIError, FigmaRateLimitError, FigmaNetworkError, FigmaAuthError } from "./errors.js";

const execFileAsync = promisify(execFile);

/**
 * Sleep utility for async delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type RequestOptions = RequestInit & {
  /**
   * Force format of headers to be a record of strings, e.g. { "Authorization": "Bearer 123" }
   *
   * Avoids complexity of needing to deal with `instanceof Headers`, which is not supported in some environments.
   */
  headers?: Record<string, string>;
};

export interface FetchRetryConfig {
  maxRetries?: number;
  initialBackoff?: number;
  maxBackoff?: number;
}

export async function fetchWithRetry<T extends { status?: number }>(
  url: string,
  options: RequestOptions = {},
  config: FetchRetryConfig = {},
): Promise<T> {
  const { maxRetries = 3, initialBackoff = 1000, maxBackoff = 10000 } = config;
  let lastError: Error = new Error("Unknown error");

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Handle rate limiting with exponential backoff
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get("Retry-After");
        const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader) : null;
        const backoff = retryAfter
          ? retryAfter * 1000
          : Math.min(initialBackoff * Math.pow(2, attempt), maxBackoff);

        if (attempt < maxRetries) {
          Logger.log(
            `[fetchWithRetry] Rate limited (429). Retrying after ${backoff}ms (attempt ${attempt + 1}/${maxRetries})`,
          );
          await sleep(backoff);
          continue;
        }

        throw new FigmaRateLimitError("Rate limit exceeded", Math.ceil(backoff / 1000), "minute");
      }

      // Handle authentication errors
      if (response.status === 401) {
        throw new FigmaAuthError("Authentication failed: Invalid or expired token", "pat");
      }

      if (response.status === 403) {
        const body = await response.text();
        throw new FigmaAPIError("Access forbidden", 403, url, body);
      }

      // Handle other HTTP errors
      if (!response.ok) {
        const body = await response.text();
        throw new FigmaAPIError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          url,
          body,
        );
      }

      return (await response.json()) as T;
    } catch (fetchError: unknown) {
      lastError = fetchError as Error;

      // Don't retry on client errors (4xx except 429) or auth errors
      if (
        fetchError instanceof FigmaAPIError &&
        fetchError.isClientError() &&
        fetchError.statusCode !== 429
      ) {
        throw fetchError;
      }

      if (fetchError instanceof FigmaAuthError) {
        throw fetchError;
      }

      // Exponential backoff for network errors
      if (attempt < maxRetries) {
        const backoff = Math.min(initialBackoff * Math.pow(2, attempt), maxBackoff);
        Logger.log(
          `[fetchWithRetry] Request failed. Retrying after ${backoff}ms (attempt ${attempt + 1}/${maxRetries})`,
        );
        await sleep(backoff);
        continue;
      }
    }
  }

  // All retries failed, try curl fallback
  try {
    Logger.log(
      `[fetchWithRetry] All fetch attempts failed for ${url}. Attempting curl fallback for corporate proxy/SSL issues.`,
    );

    const curlHeaders = formatHeadersForCurl(options.headers);
    // Most options here are to ensure stderr only contains errors, so we can use it to confidently check if an error occurred.
    // -s: Silent mode—no progress bar in stderr
    // -S: Show errors in stderr
    // --fail-with-body: curl errors with code 22, and outputs body of failed request, e.g. "Fetch failed with status 404"
    // -L: Follow redirects
    const curlArgs = ["-s", "-S", "--fail-with-body", "-L", ...curlHeaders, url];

    try {
      // Fallback to curl for  corporate networks that have proxies that sometimes block fetch
      Logger.log(`[fetchWithRetry] Executing curl with args: ${JSON.stringify(curlArgs)}`);
      const { stdout, stderr } = await execFileAsync("curl", curlArgs);

      if (stderr) {
        // curl often outputs progress to stderr, so only treat as error if stdout is empty
        // or if stderr contains typical error keywords.
        if (
          !stdout ||
          stderr.toLowerCase().includes("error") ||
          stderr.toLowerCase().includes("fail")
        ) {
          throw new Error(`Curl command failed with stderr: ${stderr}`);
        }
        Logger.log(
          `[fetchWithRetry] Curl command for ${url} produced stderr (but might be informational): ${stderr}`,
        );
      }

      if (!stdout) {
        throw new Error("Curl command returned empty stdout.");
      }

      const result = JSON.parse(stdout) as T;

      // Successful Figma requests don't have a status property, and some endpoints return 200 with an
      // error status in the body, e.g. https://www.figma.com/developers/api#get-images-endpoint
      if (result.status && result.status !== 200) {
        throw new Error(`Curl command failed: ${result}`);
      }

      return result;
    } catch (curlError: unknown) {
      const curlMessage = curlError instanceof Error ? curlError.message : String(curlError);
      Logger.error(`[fetchWithRetry] Curl fallback also failed for ${url}: ${curlMessage}`);

      // Wrap in network error
      throw new FigmaNetworkError(
        `Network request failed after ${maxRetries} retries and curl fallback: ${lastError.message}`,
        lastError,
      );
    }
  } catch {
    // Curl fallback setup failed, throw the last fetch error
    throw new FigmaNetworkError(
      `Network request failed after ${maxRetries} retries: ${lastError.message}`,
      lastError,
    );
  }
}

/**
 * Converts HeadersInit to an array of curl header arguments for execFile.
 * @param headers Headers to convert.
 * @returns Array of strings for curl arguments: ["-H", "key: value", "-H", "key2: value2"]
 */
function formatHeadersForCurl(headers: Record<string, string> | undefined): string[] {
  if (!headers) {
    return [];
  }

  const headerArgs: string[] = [];
  for (const [key, value] of Object.entries(headers)) {
    headerArgs.push("-H", `${key}: ${value}`);
  }
  return headerArgs;
}
