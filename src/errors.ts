/**
 * The `error` object Google's APIs return in the body of a failed request.
 * Which fields are present varies: problems with the API key include
 * `status` and an `ErrorInfo` entry in `details`, while most others only
 * have `code`, `message` and `errors`.
 */
export interface GoogleApiErrorBody {
  /** The HTTP status code. */
  code?: number;
  /** A description of the problem, e.g. "API key not valid. Please pass a valid API key." */
  message?: string;
  /** The gRPC status, e.g. `"INVALID_ARGUMENT"` or `"PERMISSION_DENIED"`. */
  status?: string;
  /** The individual errors, each with a short `reason` such as `"badRequest"`. */
  errors?: { message?: string; domain?: string; reason?: string }[];
  /** Structured details, such as `google.rpc.ErrorInfo` or `google.rpc.BadRequest`. */
  details?: { "@type"?: string; reason?: string; [key: string]: unknown }[];
}

const ERROR_INFO = "type.googleapis.com/google.rpc.ErrorInfo";

/**
 * An error response from the Map Tiles API. Thrown by session creation
 * (including `validate()`), viewport requests and the protocol handler, so
 * apps can tell problems apart without parsing messages.
 *
 * Network failures and aborted requests are not API errors, and are thrown
 * as they are.
 *
 * @example
 * ```ts
 * try {
 *   await google.validate(options);
 * } catch (error) {
 *   if (error instanceof TilesApiError && error.reason === "API_KEY_INVALID") {
 *     // Ask for a different key.
 *   }
 * }
 * ```
 */
export class TilesApiError extends Error {
  override readonly name = "TilesApiError";

  /**
   * The HTTP status code. The API uses, for example:
   * - 400 for an invalid API key or invalid session options;
   * - 401 for an invalid or expired session;
   * - 403 when the key isn't allowed to use the API, or from this site;
   * - 404 for tiles that don't exist, e.g. satellite imagery beyond the
   *   zoom available for that area.
   */
  readonly status: number;

  /**
   * Google's reason for the error, if given. This is the specific reason
   * when there is one, e.g. `"API_KEY_INVALID"`, and otherwise the general
   * one, e.g. `"badRequest"` (invalid options), `"authError"` (invalid
   * session), `"forbidden"`, `"invalid"` or `"notFound"`.
   */
  readonly reason: string | undefined;

  /** The `error` object from the response body, if it had one. */
  readonly body: GoogleApiErrorBody | undefined;

  /**
   * @param message The error message
   * @param status The HTTP status code
   * @param body The `error` object from the response body, if any
   */
  constructor(message: string, status: number, body?: GoogleApiErrorBody) {
    super(message);
    this.status = status;
    this.body = body;
    this.reason =
      body?.details?.find((d) => d["@type"] === ERROR_INFO)?.reason ??
      body?.errors?.[0]?.reason;
  }
}

/**
 * Builds a {@link TilesApiError} from a failed response, using Google's
 * error message when the body has one.
 * @param context What was being done, e.g. "Error creating session"
 */
export async function tilesApiError(
  response: Response,
  context: string,
): Promise<TilesApiError> {
  let body: GoogleApiErrorBody | undefined;
  try {
    body = (await response.json())?.error;
  } catch {
    // Not JSON, e.g. from a proxy. Fall back to the status text.
  }
  const detail = body?.message || response.statusText;
  return new TilesApiError(
    `${context}: ${response.status}${detail ? ` ${detail}` : ""}`,
    response.status,
    body,
  );
}
