"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestClient = void 0;
exports.resetIngestClientProcessStateForTests = resetIngestClientProcessStateForTests;
const telemetry_fetch_1 = require("./telemetry-fetch");
const STREAM = {
    telemetry_events: 'events',
    telemetry_workflows: 'workflows',
    workflow_mutations: 'mutations',
};
const RETRY_AFTER_DEFAULT_MS = 60000;
const RETRY_AFTER_MAX_MS = 60 * 60000;
let processStopped = false;
let blockedUntil = 0;
function resetIngestClientProcessStateForTests() {
    processStopped = false;
    blockedUntil = 0;
}
const NUMBER_LIKE_RE = /^[+-]?\d+(?:\.\d+)?$/;
const POSITIVE_INTEGER_RE = /^\d+$/;
function parseRetryAfterMs(header, now) {
    if (!header)
        return RETRY_AFTER_DEFAULT_MS;
    const trimmed = header.trim();
    if (!trimmed)
        return RETRY_AFTER_DEFAULT_MS;
    if (NUMBER_LIKE_RE.test(trimmed)) {
        if (POSITIVE_INTEGER_RE.test(trimmed)) {
            const seconds = parseInt(trimmed, 10);
            if (seconds > 0) {
                return Math.min(seconds * 1000, RETRY_AFTER_MAX_MS);
            }
        }
        return RETRY_AFTER_DEFAULT_MS;
    }
    const dateMs = Date.parse(trimmed);
    if (!Number.isNaN(dateMs) && dateMs > now) {
        return Math.min(dateMs - now, RETRY_AFTER_MAX_MS);
    }
    return RETRY_AFTER_DEFAULT_MS;
}
class IngestClient {
    constructor(opts) {
        this.opts = opts;
        this.base = opts.url.replace(/\/+$/, '');
        this.fetchImpl = opts.fetchImpl ?? telemetry_fetch_1.telemetryFetch;
    }
    from(table) {
        return { insert: (rows) => this.send(table, Array.isArray(rows) ? rows : [rows]) };
    }
    async send(table, rows) {
        if (processStopped)
            return { error: null, status: 0, dropped: true };
        if (Date.now() < blockedUntil) {
            return { error: { message: 'rate limited (local backoff)', status: 429 }, status: 429 };
        }
        let status;
        let res;
        try {
            res = await this.fetchImpl(`${this.base}/v1/ingest/${STREAM[table]}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-N8N-MCP-Key': this.opts.key,
                    'X-N8N-MCP-Version': this.opts.version,
                },
                body: JSON.stringify(rows),
            });
            status = res.status;
            await res.body?.cancel().catch(() => undefined);
        }
        catch (e) {
            return { error: { message: e instanceof Error ? e.message : String(e), status: 0 }, status: 0 };
        }
        if (status >= 200 && status < 300)
            return { error: null, status };
        if (status === 400 || status === 413)
            return { error: null, status, dropped: true };
        if (status === 410 || status === 401 || status === 403) {
            processStopped = true;
            this.opts.onControl?.({ kind: status === 410 ? 'disable_version' : 'disable_process', status });
            return { error: null, status, dropped: true };
        }
        if (status === 429) {
            const now = Date.now();
            const candidate = now + parseRetryAfterMs(res.headers.get('retry-after'), now);
            blockedUntil = Math.max(blockedUntil, candidate);
            return { error: { message: `telemetry ingest HTTP ${status}`, status }, status };
        }
        if (status >= 400 && status < 500) {
            return { error: null, status, dropped: true };
        }
        return { error: { message: `telemetry ingest HTTP ${status}`, status }, status };
    }
}
exports.IngestClient = IngestClient;
//# sourceMappingURL=ingest-client.js.map