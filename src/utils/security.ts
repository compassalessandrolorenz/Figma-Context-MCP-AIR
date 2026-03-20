/**
 * Security utilities for path validation and sanitization
 */

import { resolve, relative, isAbsolute, sep } from "path";

/**
 * Validates that a user-provided path is safe and within the allowed base directory.
 * Prevents path traversal attacks by ensuring the resolved path stays within bounds.
 *
 * @param userPath - The user-provided path to validate
 * @param baseDir - The base directory that the path must stay within
 * @returns The validated absolute path
 * @throws Error if path traversal is detected
 *
 * @example
 * ```typescript
 * // Safe path
 * validateSafePath('./images', '/project') // Returns '/project/images'
 *
 * // Path traversal attempt - throws error
 * validateSafePath('../../../etc/passwd', '/project') // Throws error
 * ```
 */
export function validateSafePath(userPath: string, baseDir: string): string {
  // Resolve both paths to absolute paths
  const resolvedBase = resolve(baseDir);
  const resolvedPath = resolve(baseDir, userPath);

  // Calculate relative path from base to target
  const relativePath = relative(resolvedBase, resolvedPath);

  // Check for path traversal attempts
  // If relative path starts with '..' or is absolute, it's outside the base directory
  if (relativePath.startsWith(".." + sep) || isAbsolute(relativePath)) {
    throw new Error(
      `Path traversal detected: "${userPath}" attempts to access files outside the allowed directory`,
    );
  }

  // Additional check: ensure resolved path actually starts with base directory
  if (!resolvedPath.startsWith(resolvedBase + sep) && resolvedPath !== resolvedBase) {
    throw new Error(`Invalid path: "${userPath}" resolves outside the allowed directory`);
  }

  return resolvedPath;
}

/**
 * Validates that a URL is from an allowed Figma domain.
 * Prevents SSRF attacks by ensuring URLs are only from trusted Figma domains.
 *
 * @param url - The URL to validate
 * @param allowedDomains - List of allowed domain suffixes (default: Figma domains)
 * @throws Error if URL is not from an allowed domain
 *
 * @example
 * ```typescript
 * // Valid Figma URL
 * validateFigmaUrl('https://s3-alpha.figma.com/image.png')
 *
 * // Invalid URL - throws error
 * validateFigmaUrl('https://evil.com/image.png') // Throws error
 * ```
 */
export function validateFigmaUrl(
  url: string,
  allowedDomains: string[] = [
    "figma.com",
    "s3-alpha.figma.com",
    "s3-alpha-sig.figma.com",
    "figma-alpha-api.s3.us-west-2.amazonaws.com",
    "figma-alpha-api.s3.amazonaws.com",
  ],
): void {
  try {
    const parsed = new URL(url);

    // Check if hostname ends with any of the allowed domains
    const isAllowed = allowedDomains.some((domain) => {
      return parsed.hostname === domain || parsed.hostname.endsWith("." + domain);
    });

    if (!isAllowed) {
      throw new Error(`URL validation failed: "${parsed.hostname}" is not an allowed Figma domain`);
    }

    // Ensure HTTPS protocol
    if (parsed.protocol !== "https:") {
      throw new Error(`URL validation failed: Only HTTPS URLs are allowed, got ${parsed.protocol}`);
    }
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Invalid URL format: "${url}"`);
    }
    throw error;
  }
}

/**
 * Sanitizes error messages to prevent information disclosure.
 * Removes stack traces and internal paths from error messages.
 *
 * @param error - The error to sanitize
 * @param includeDetails - Whether to include error details (default: false in production)
 * @returns Sanitized error message
 *
 * @example
 * ```typescript
 * const error = new Error('Database connection failed at /internal/path/db.ts:42');
 * sanitizeError(error) // Returns 'Database connection failed'
 * ```
 */
export function sanitizeError(error: unknown, includeDetails: boolean = false): string {
  if (error instanceof Error) {
    // Get only the first line of the error message (no stack trace)
    const message = error.message.split("\n")[0];

    // In production, remove internal paths
    if (!includeDetails) {
      // Remove file paths (e.g., /path/to/file.ts:42)
      return message.replace(/\/[\w\-./]+\.(ts|js|tsx|jsx)(:\d+)?/g, "[internal]");
    }

    return message;
  }

  return "An unexpected error occurred";
}
