# E33 — A production HTTP client

> Runnable code for [33 — API Integration, BFF and Data Contracts](33-api-integration-bff-and-contracts.md). 9 tests.

The chapter's `request` function: timeouts, cancellation, schema-validated responses, Problem Details errors, idempotency keys, and retries that honour `Retry-After` exactly or fail fast with `retryAfterMs` when the wait is over budget. Also the helper that maps Problem Details field errors onto form fields.

The tests use a scripted `fetch` and a `setTimeout` that records each delay and fires at once, so retry timing is checked exactly and the suite still runs in well under a second.

## Run it

From the handbook folder:

```bash
node extract-examples.mjs 33    # writes examples/33-api-integration-bff-and-contracts/
cd examples/33-api-integration-bff-and-contracts
npm ci
npm test
npm run typecheck
```

## Where the code comes from

Each file below contains its chapter block verbatim. Lines added around a block (imports the chapter omits, types it defines elsewhere, extra code the tests need) are marked in the file.

| File | Chapter and section |
|---|---|
| `src/shared/api/http.ts` | 33, "5. A production HTTP client" |
| `src/shared/api/problem-to-form.ts` | 33, "6.2 Mapping errors to UI behaviour" |

## Files

Every file of the project: source first, then tests, then scripts and data, then configuration. The exact lockfile is in `examples.lock.json`; the extraction script writes it into the project as `package-lock.json`.

### `src/shared/api/http.ts`

```ts
// shared/api/http.ts
import { z } from 'zod';

const API_BASE = new URL('/api/', globalThis.location?.href ?? 'http://localhost'); // the same-origin BFF

const ProblemSchema = z.looseObject({
  type: z.string().default('about:blank'),
  title: z.string().optional(),
  status: z.number().int().optional(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  // Extension member used by Acme APIs for field-level validation errors (RFC 9457 §3 example)
  errors: z.array(z.object({ pointer: z.string(), detail: z.string() })).optional(),
});
export type Problem = z.infer<typeof ProblemSchema>;

// Plain fields instead of parameter properties: works under `erasableSyntaxOnly` and Node type stripping
export class ApiError extends Error {
  readonly status: number;
  readonly problem: Problem;
  readonly retryable: boolean;
  readonly retryAfterMs: number | undefined; // when the server said to try again, if it did
  constructor(status: number, problem: Problem, retryable: boolean, retryAfterMs?: number) {
    super(problem.title ?? `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
const SAFE_TO_RETRY = new Set<Method>(['GET', 'PUT', 'DELETE']); // idempotent by HTTP semantics
const TRANSIENT = new Set([408, 425, 429, 502, 503, 504]);      // 500 is usually a bug, not a blip

export type RequestOptions<T> = {
  method?: Method;
  body?: unknown;
  schema: z.ZodType<T>;
  signal?: AbortSignal;
  timeoutMs?: number;
  retries?: number;
  maxRetryWaitMs?: number; // the longest Retry-After this caller will wait before giving up
  idempotencyKey?: string; // makes POST/PATCH safe to retry, if the server honours it
};

export async function request<T>(path: string, opts: RequestOptions<T>): Promise<T> {
  const method = opts.method ?? 'GET';
  const key = opts.idempotencyKey;
  if (key !== undefined && key.trim() === '') {
    // An empty key would turn retries on without sending the header that makes them safe
    throw new TypeError('idempotencyKey must be a non-empty string');
  }
  const canRetry = SAFE_TO_RETRY.has(method) || key !== undefined;
  const maxAttempts = canRetry ? 1 + (opts.retries ?? 2) : 1;
  const maxWait = opts.maxRetryWaitMs ?? 30_000;

  for (let attempt = 1; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(new URL(path, API_BASE), {
        method,
        credentials: 'include',
        signal: AbortSignal.any([
          AbortSignal.timeout(opts.timeoutMs ?? 10_000),
          ...(opts.signal ? [opts.signal] : []),
        ]),
        headers: {
          Accept: 'application/json, application/problem+json',
          ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(key !== undefined ? { 'Idempotency-Key': key } : {}),
        },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      });
    } catch (cause) {
      // Network failure or timeout. Never retry when the caller aborted.
      if (opts.signal?.aborted || attempt >= maxAttempts) throw cause;
      await sleep(backoffMs(attempt), opts.signal);
      continue;
    }

    if (res.ok) {
      const data: unknown = res.status === 204 ? undefined : await res.json();
      return opts.schema.parse(data); // validate at the boundary
    }

    const error = await toApiError(res);
    if (!error.retryable || attempt >= maxAttempts) throw error;
    // Respect Retry-After: wait exactly that long, or stop now if it's longer than this caller can wait,
    // so the UI can say when to try again. Never retry earlier than the server asked.
    if (error.retryAfterMs !== undefined && error.retryAfterMs > maxWait) throw error;
    await sleep(error.retryAfterMs ?? backoffMs(attempt), opts.signal);
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  let problem: Problem = { type: 'about:blank', title: res.statusText, status: res.status };
  if (res.headers.get('Content-Type')?.includes('application/problem+json')) {
    const parsed = ProblemSchema.safeParse(await res.json().catch(() => null));
    if (parsed.success) problem = parsed.data;
  }
  return new ApiError(res.status, problem, TRANSIENT.has(res.status), retryAfterMs(res.headers.get('Retry-After')));
}

/** Retry-After is delay-seconds (a non-negative integer) or an HTTP-date (RFC 9110 §10.2.3). */
function retryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined;
  const v = value.trim();
  if (/^\d+$/.test(v)) return Number(v) * 1000;
  const at = Date.parse(v);
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
}

function backoffMs(attempt: number): number {
  return Math.random() * Math.min(8_000, 300 * 2 ** attempt); // exponential backoff, "full jitter"
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const onAbort = () => { clearTimeout(id); reject(signal!.reason); };
    const id = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
```

### `src/shared/api/problem-to-form.ts`

```ts
import type { Problem } from './http.ts'; // glue: the chapter's block omits imports

// shared/api/problem-to-form.ts: "#/lines/0/quantity" → "lines.0.quantity"
export function fieldErrors(problem: Problem): Record<string, string> {
  return Object.fromEntries(
    (problem.errors ?? []).map(e => [e.pointer.replace(/^#\//, '').replaceAll('/', '.'), e.detail]),
  );
}
```

### `test/harness.ts`

```ts
// harness.ts: a scripted fetch, and a setTimeout that records delays and fires at once
export type Call = { url: string; method: string; headers: Record<string, string> };
export function scriptFetch(responses: Array<() => Response>) {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: URL | string, init: RequestInit = {}) => {
    calls.push({ url: String(input), method: init.method ?? 'GET', headers: { ...(init.headers as Record<string, string>) } });
    const next = responses.shift();
    if (!next) throw new Error('no more scripted responses');
    return next();
  }) as typeof fetch;
  return calls;
}
export function recordDelays() {
  const delays: number[] = [];
  const real = globalThis.setTimeout;
  globalThis.setTimeout = ((fn: () => void, ms?: number) => { delays.push(ms ?? 0); return real(fn, 0); }) as typeof setTimeout;
  return { delays, restore: () => { globalThis.setTimeout = real; } };
}
export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
```

### `test/http.test.ts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { z } from 'zod';
import { ApiError, request } from '../src/shared/api/http.ts';
import { json, recordDelays, scriptFetch } from './harness.ts';

const Ok = z.object({ ok: z.boolean() });
const run = async <T,>(fn: () => Promise<T>) => { const t = recordDelays(); try { return { value: await fn(), delays: t.delays }; } finally { t.restore(); } };

test('an empty idempotency key is rejected before any request', async () => {
  const calls = scriptFetch([json(200, { ok: true })]);
  await assert.rejects(request('orders', { method: 'POST', body: {}, schema: Ok, idempotencyKey: ' ' }), TypeError);
  assert.equal(calls.length, 0);
});

test('a POST with a key retries, sending the same key on every attempt', async () => {
  const calls = scriptFetch([json(503, {}), json(200, { ok: true })]);
  await run(() => request('orders', { method: 'POST', body: {}, schema: Ok, idempotencyKey: 'checkout-7f3a' }));
  assert.deepEqual(calls.map((c) => c.headers['Idempotency-Key']), ['checkout-7f3a', 'checkout-7f3a']);
});

test('a POST without a key is never retried', async () => {
  const calls = scriptFetch([json(503, {}), json(200, { ok: true })]);
  await assert.rejects(request('orders', { method: 'POST', body: {}, schema: Ok }), ApiError);
  assert.equal(calls.length, 1);
});

test('Retry-After longer than the caller can wait: no early retry, and the wait is reported', async () => {
  const calls = scriptFetch([json(429, {}, { 'Retry-After': '120' }), json(200, { ok: true })]);
  const t = recordDelays();
  try {
    await assert.rejects(request('orders', { schema: Ok }), (e: unknown) => e instanceof ApiError && e.status === 429 && e.retryAfterMs === 120_000);
  } finally { t.restore(); }
  assert.equal(calls.length, 1);
  assert.deepEqual(t.delays, []);
});

test('Retry-After within the budget is honoured exactly, in seconds or as an HTTP date', async () => {
  scriptFetch([json(503, {}, { 'Retry-After': '2' }), json(200, { ok: true })]);
  assert.deepEqual((await run(() => request('orders', { schema: Ok }))).delays, [2000]);
  scriptFetch([json(503, {}, { 'Retry-After': new Date(Date.now() + 5000).toUTCString() }), json(200, { ok: true })]);
  const [d] = (await run(() => request('orders', { schema: Ok }))).delays;
  assert.ok(d > 3000 && d <= 5000, `HTTP-date delay ${d}`);
  scriptFetch([json(429, {}, { 'Retry-After': '120' }), json(200, { ok: true })]);
  assert.deepEqual((await run(() => request('orders', { schema: Ok, maxRetryWaitMs: 180_000 }))).delays, [120_000]);
});

test('a malformed Retry-After falls back to jittered backoff', async () => {
  scriptFetch([json(503, {}, { 'Retry-After': '-5' }), json(200, { ok: true })]);
  const [d] = (await run(() => request('orders', { schema: Ok }))).delays;
  assert.ok(d >= 0 && d < 8000);
});

test('waiting between attempts leaves no abort listener behind', async () => {
  const controller = new AbortController();
  scriptFetch([json(503, {}), json(503, {}), json(200, { ok: true })]);
  const before = getEventListeners(controller.signal, 'abort').length;
  await run(() => request('orders', { schema: Ok, signal: controller.signal }));
  const after = getEventListeners(controller.signal, 'abort').length;
  console.log(`abort listeners before ${before}, after ${after}`);
  assert.equal(after, before);
});
```

### `test/problem-to-form.test.ts`

```ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Problem } from '../src/shared/api/http.ts';
import { fieldErrors } from '../src/shared/api/problem-to-form.ts';

test('JSON Pointers in a Problem Details response become form field paths', () => {
  const problem = {
    type: 'https://api.acme.test/problems/validation',
    title: 'Your request is not valid',
    status: 422,
    errors: [
      { pointer: '#/lines/0/quantity', detail: 'Must be at least 1' },
      { pointer: '#/customer/email', detail: 'Enter a valid email address' },
    ],
  } as Problem;
  assert.deepEqual(fieldErrors(problem), {
    'lines.0.quantity': 'Must be at least 1',
    'customer.email': 'Enter a valid email address',
  });
});

test('a problem without field errors maps to no field errors', () => {
  assert.deepEqual(fieldErrors({ type: 'about:blank', title: 'Conflict', status: 409 } as Problem), {});
});
```

### `package.json`

```json
{
  "name": "handbook-33-api-integration-bff-and-contracts",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.18"
  },
  "scripts": {
    "test": "node --test \"test/**/*.test.ts\"",
    "typecheck": "tsc"
  },
  "dependencies": {
    "zod": "4.6.7"
  },
  "devDependencies": {
    "@types/node": "22.20.6",
    "typescript": "6.0.3"
  }
}
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "es2023",
    "module": "preserve",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "noUncheckedIndexedAccess": false,
    "lib": [
      "es2024",
      "dom",
      "dom.iterable"
    ],
    "types": [
      "node"
    ],
    "paths": {
      "@/*": [
        "./src/*"
      ]
    }
  },
  "include": [
    "src",
    "test"
  ]
}
```

---

[← Previous: E29 — A small store on useSyncExternalStore](E29-client-state-management.md) · [Chapter 33](33-api-integration-bff-and-contracts.md) · [Index](README.md) · [Next: E37 — Cached Intl formatters and correct money →](E37-internationalization-and-localization.md)
