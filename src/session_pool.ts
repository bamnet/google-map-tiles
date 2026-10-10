import {
  type ClientOptions,
  GoogleMapTiles,
  type SessionOptions,
} from "./tiles.ts";

/** Options for constructing a {@link SessionPool}. */
export interface SessionPoolOptions extends ClientOptions {
  /**
   * How long before a session expires to replace it. Capped at half of each
   * session's lifetime, so a new session is never replaced straight away.
   * @default 1 hour
   */
  refreshMarginMs?: number;
}

const DEFAULT_REFRESH_MARGIN_MS = 60 * 60 * 1000;

/**
 * Keeps one Tile API session per distinct set of {@link SessionOptions}.
 *
 * Sessions are created on first use and shared by everyone asking for the same
 * options, including concurrent callers while the session is still being
 * created. A session is replaced shortly before it expires, and a failed
 * creation is not cached, so the next call retries.
 *
 * @example
 * ```ts
 * const pool = new SessionPool("YOUR_API_KEY");
 * const client = await pool.client({
 *   mapType: "roadmap",
 *   language: "en-US",
 *   region: "US",
 * });
 * const url = client.tileUrl(15, 6294, 13288);
 * ```
 */
export class SessionPool {
  private readonly apiKey: string;
  private readonly clientOptions: ClientOptions;
  private readonly refreshMarginMs: number;
  private readonly clients = new Map<string, Promise<GoogleMapTiles>>();
  /** When each client's session should be replaced, in ms since the epoch. */
  private readonly refreshAt = new WeakMap<GoogleMapTiles, number>();

  /**
   * @param apiKey Google Maps API key
   * @param options Optional pool and client configuration
   */
  constructor(apiKey: string, options: SessionPoolOptions = {}) {
    this.apiKey = apiKey;
    this.clientOptions = { baseUrl: options.baseUrl };
    this.refreshMarginMs = options.refreshMarginMs ?? DEFAULT_REFRESH_MARGIN_MS;
  }

  /**
   * Returns a client with a current session for these options, creating or
   * replacing the session if needed.
   * @throws {TilesApiError} If a session has to be created and the API rejects it
   */
  async client(options: SessionOptions): Promise<GoogleMapTiles> {
    const key = sessionKey(options);
    const entry = this.clients.get(key) ?? this.create(key, options);
    const client = await entry;
    if (Date.now() < (this.refreshAt.get(client) ?? 0)) {
      return client;
    }
    // Replace the session, unless another caller already started doing so.
    // This check must not await, or concurrent callers would all replace it.
    const current = this.clients.get(key);
    return await (current && current !== entry
      ? current
      : this.create(key, options));
  }

  /** Forgets all sessions. The next {@link client} call creates new ones. */
  clear(): void {
    this.clients.clear();
  }

  private create(
    key: string,
    options: SessionOptions,
  ): Promise<GoogleMapTiles> {
    const client = new GoogleMapTiles(this.apiKey, this.clientOptions);
    const pending = client.createSession(options).then(() => {
      const createdAt = Date.now();
      const expiresAt = client.expiresAt()?.getTime() ?? createdAt;
      const margin = Math.min(
        this.refreshMarginMs,
        (expiresAt - createdAt) / 2,
      );
      this.refreshAt.set(client, expiresAt - margin);
      return client;
    });
    this.clients.set(key, pending);
    // Don't cache failures, unless something newer has replaced this entry.
    pending.catch(() => {
      if (this.clients.get(key) === pending) {
        this.clients.delete(key);
      }
    });
    return pending;
  }
}

/**
 * A stable key for session options, independent of property order.
 * Array order is kept, since it can be meaningful (e.g. `styles`).
 */
export function sessionKey(options: SessionOptions): string {
  return JSON.stringify(options, (_key, value) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1)),
        )
      : value,
  );
}
