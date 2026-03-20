/**
 * Custom error classes for Figma MCP Server
 *
 * These error classes provide structured error handling with specific
 * error types that can be caught and handled appropriately.
 */

/**
 * Base error class for all Figma-related errors
 */
export class FigmaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FigmaError";
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when Figma API returns an error response
 */
export class FigmaAPIError extends FigmaError {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly endpoint: string,
    public readonly responseBody?: unknown,
  ) {
    super(message);
    this.name = "FigmaAPIError";
  }

  /**
   * Check if this is a client error (4xx)
   */
  isClientError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500;
  }

  /**
   * Check if this is a server error (5xx)
   */
  isServerError(): boolean {
    return this.statusCode >= 500 && this.statusCode < 600;
  }
}

/**
 * Error thrown when authentication fails or token is invalid
 */
export class FigmaAuthError extends FigmaError {
  constructor(
    message: string,
    public readonly authMethod: "pat" | "oauth",
  ) {
    super(message);
    this.name = "FigmaAuthError";
  }
}

/**
 * Error thrown when rate limit is exceeded
 */
export class FigmaRateLimitError extends FigmaError {
  constructor(
    message: string,
    public readonly retryAfter: number, // seconds
    public readonly limit: "minute" | "hour",
  ) {
    super(message);
    this.name = "FigmaRateLimitError";
  }
}

/**
 * Error thrown when OAuth token has expired
 */
export class FigmaTokenExpiredError extends FigmaAuthError {
  constructor(message: string = "OAuth token has expired") {
    super(message, "oauth");
    this.name = "FigmaTokenExpiredError";
  }
}

/**
 * Error thrown when a required resource is not found
 */
export class FigmaNotFoundError extends FigmaAPIError {
  constructor(
    resource: string,
    public readonly resourceId: string,
  ) {
    super(`${resource} not found: ${resourceId}`, 404, resource);
    this.name = "FigmaNotFoundError";
  }
}

/**
 * Error thrown when user doesn't have permission to access a resource
 */
export class FigmaPermissionError extends FigmaAPIError {
  constructor(
    message: string,
    public readonly resource: string,
  ) {
    super(message, 403, resource);
    this.name = "FigmaPermissionError";
  }
}

/**
 * Error thrown when Enterprise/Organization plan is required
 */
export class FigmaEnterpriseRequiredError extends FigmaPermissionError {
  constructor(feature: string) {
    super(
      `${feature} requires a Figma Organization or Enterprise plan. Learn more: https://www.figma.com/pricing`,
      feature,
    );
    this.name = "FigmaEnterpriseRequiredError";
  }
}

/**
 * Error thrown when network request fails
 */
export class FigmaNetworkError extends FigmaError {
  constructor(
    message: string,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = "FigmaNetworkError";
  }
}

/**
 * Error thrown when response validation fails
 */
export class FigmaValidationError extends FigmaError {
  constructor(
    message: string,
    public readonly validationErrors?: unknown,
  ) {
    super(message);
    this.name = "FigmaValidationError";
  }
}

/**
 * Type guard to check if error is a FigmaError
 */
export function isFigmaError(error: unknown): error is FigmaError {
  return error instanceof FigmaError;
}

/**
 * Type guard to check if error is a FigmaAPIError
 */
export function isFigmaAPIError(error: unknown): error is FigmaAPIError {
  return error instanceof FigmaAPIError;
}

/**
 * Type guard to check if error is a FigmaAuthError
 */
export function isFigmaAuthError(error: unknown): error is FigmaAuthError {
  return error instanceof FigmaAuthError;
}

/**
 * Type guard to check if error is a FigmaRateLimitError
 */
export function isFigmaRateLimitError(error: unknown): error is FigmaRateLimitError {
  return error instanceof FigmaRateLimitError;
}

/**
 * Type guard to check if error is a FigmaEnterpriseRequiredError
 */
export function isFigmaEnterpriseRequiredError(
  error: unknown,
): error is FigmaEnterpriseRequiredError {
  return error instanceof FigmaEnterpriseRequiredError;
}

/**
 * Format error for user-friendly display
 */
export function formatErrorForUser(error: unknown): string {
  if (error instanceof FigmaEnterpriseRequiredError) {
    return error.message;
  }

  if (error instanceof FigmaRateLimitError) {
    return `Rate limit exceeded. Please retry after ${error.retryAfter} seconds.`;
  }

  if (error instanceof FigmaAuthError) {
    return `Authentication failed: ${error.message}`;
  }

  if (error instanceof FigmaNotFoundError) {
    return `Resource not found: ${error.resourceId}`;
  }

  if (error instanceof FigmaPermissionError) {
    return `Permission denied: ${error.message}`;
  }

  if (error instanceof FigmaAPIError) {
    return `Figma API error (${error.statusCode}): ${error.message}`;
  }

  if (error instanceof FigmaNetworkError) {
    return `Network error: ${error.message}`;
  }

  if (error instanceof FigmaValidationError) {
    return `Validation error: ${error.message}`;
  }

  if (error instanceof FigmaError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred";
}
