# E45 — An authorization policy and its test matrix

> Runnable code for [45 — Authentication and Authorization](45-authentication-and-authorization.md). 6 tests.

The chapter's policy (tenant isolation first, then roles, then attribute rules such as approval limits) and the chapter's own role-by-action test matrix, unchanged.

## Run it

From the handbook folder:

```bash
node extract-examples.mjs 45    # writes examples/45-authentication-and-authorization/
cd examples/45-authentication-and-authorization
npm ci
npm test
npm run typecheck
```

## Where the code comes from

Each file below contains its chapter block verbatim. Lines added around a block (imports the chapter omits, types it defines elsewhere, extra code the tests need) are marked in the file.

| File | Chapter and section |
|---|---|
| `src/server/authz/policy.ts` | 45, "5.1 A typed policy module (server-only)" |
| `src/server/authz/policy.test.ts` | 45, "9. Testing authorisation" |

## Files

Every file of the project: source first, then tests, then scripts and data, then configuration. The exact lockfile is in `examples.lock.json`; the extraction script writes it into the project as `package-lock.json`.

### `src/server/authz/policy.ts`

```ts
// server/authz/policy.ts
import 'server-only';

export type Role = 'owner' | 'admin' | 'billing' | 'viewer';
export type Action = 'invoice:read' | 'invoice:void' | 'invoice:export' | 'member:invite';
export type Subject = { userId: string; tenantId: string; roles: readonly Role[]; approvalLimitMinor: number };
export type InvoiceResource = { kind: 'invoice'; tenantId: string; status: 'draft' | 'open' | 'paid' | 'void'; totalMinor: number };

const ROLE_PERMISSIONS: Record<Role, readonly Action[]> = {
  owner: ['invoice:read', 'invoice:void', 'invoice:export', 'member:invite'],
  admin: ['invoice:read', 'invoice:void', 'invoice:export', 'member:invite'],
  billing: ['invoice:read', 'invoice:void', 'invoice:export'],
  viewer: ['invoice:read'],
};

export function can(subject: Subject, action: Action, resource?: InvoiceResource): boolean {
  if (resource && resource.tenantId !== subject.tenantId) return false;             // 1. tenant isolation first
  if (!subject.roles.some((role) => ROLE_PERMISSIONS[role].includes(action))) return false; // 2. RBAC
  if (action === 'invoice:void' && resource) {                                      // 3. ABAC rules
    if (resource.status === 'paid' || resource.status === 'void') return false;
    if (resource.totalMinor > subject.approvalLimitMinor) return false;
  }
  return true;
}
```

### `src/server/authz/policy.test.ts`

```ts
// server/authz/policy.test.ts: a role × action × state matrix catches regressions in one place
import { describe, expect, test } from 'vitest';
import { can, type Role, type Subject, type InvoiceResource } from './policy';

const subject = (roles: Role[]): Subject => ({ userId: 'u1', tenantId: 't1', roles, approvalLimitMinor: 100_000 });
const invoice = (over: Partial<InvoiceResource> = {}): InvoiceResource => ({
  kind: 'invoice', tenantId: 't1', status: 'open', totalMinor: 50_000, ...over,
});

describe('invoice:void', () => {
  test.each([
    ['owner', true], ['admin', true], ['billing', true], ['viewer', false],
  ] as const)('%s → %s', (role, expected) => {
    expect(can(subject([role]), 'invoice:void', invoice())).toBe(expected);
  });

  test('never across tenants', () => {
    expect(can(subject(['owner']), 'invoice:void', invoice({ tenantId: 't2' }))).toBe(false);
  });

  test('not when paid or above the approval limit', () => {
    expect(can(subject(['billing']), 'invoice:void', invoice({ status: 'paid' }))).toBe(false);
    expect(can(subject(['billing']), 'invoice:void', invoice({ totalMinor: 200_000 }))).toBe(false);
  });
});
```

### `test/server-only.ts`

```ts

// Glue: the real 'server-only' package throws when imported outside a server build. Tests run the policy directly.
export {};
```

### `package.json`

```json
{
  "name": "handbook-45-authentication-and-authorization",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.18"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc"
  },
  "dependencies": {
    "server-only": "0.0.1"
  },
  "devDependencies": {
    "@types/node": "22.20.6",
    "typescript": "6.0.3",
    "vitest": "5.1.2"
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
    "test",
    "vitest.config.ts"
  ]
}
```

### `vitest.config.ts`

```ts

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { 'server-only': fileURLToPath(new URL('./test/server-only.ts', import.meta.url)) } },
  test: { include: ['src/**/*.test.ts'] },
});
```

---

[← Previous: E43 — Safe URLs and safe inline state](E43-frontend-security-architecture.md) · [Chapter 45](45-authentication-and-authorization.md) · [Index](README.md) · [Next: E51 — A React Router v8 app in framework mode →](E51-react-router-v8-framework-mode.md)
