# E69 — A collaborative board on a CRDT

> Runnable code for [69 — Case Study: Collaborative Project-Management App (Acme Boards)](69-case-study-collaborative-project-management.md). 13 tests.

The chapter's board model on Yjs: each card owns its column and a fractional-index rank, so concurrent moves can't duplicate a card. React reads the document through an external store, and the sync server, not the CRDT, decides who may write.

- `board.test.ts`: the tempting array-per-column model puts one card in two columns after offline moves. The chosen model doesn't.
- `fuzz.test.ts`: three replicas, random edits, a flaky network. Every replica converges, and every card appears exactly once, for every seed.
- `collab.test.ts`: per-user undo and presence beside the document.
- `readonly.test.mjs`: a real Hocuspocus server on localhost refuses a viewer's writes.
- `board-react.test.tsx`: React re-renders when a remote replica moves a card.

The chapter's short snippets in sections 4.1 and 4.5 to 4.9 are condensed from these tests.

## Run it

From the handbook folder:

```bash
node extract-examples.mjs 69    # writes examples/69-case-study-collaborative-project-management/
cd examples/69-case-study-collaborative-project-management
npm ci
npm test
npm run typecheck
```

## Where the code comes from

Each file below contains its chapter block verbatim. Lines added around a block (imports the chapter omits, types it defines elsewhere, extra code the tests need) are marked in the file.

| File | Chapter and section |
|---|---|
| `src/board.ts` | 69, "4.1 Model the data so conflicts are boring" |
| `src/board.ts` | 69, "4.2 Order within a column: fractional indexes" |
| `src/board.ts` | 69, "4.4 React reads the document; it doesn't own it" |
| `src/Board.tsx` | 69, "4.4 React reads the document; it doesn't own it" |

## Files

Every file of the project: source first, then tests, then scripts and data, then configuration. The exact lockfile is in `examples.lock.json`; the extraction script writes it into the project as `package-lock.json`.

### `src/Board.tsx`

```tsx
// Board.tsx: React renders the derived view; Yjs owns the state
import { useSyncExternalStore } from 'react';
import type { createBoardStore } from './board';

export function Board({ store }: { store: ReturnType<typeof createBoardStore> }) {
  const view = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return (
    <div>
      {Object.entries(view).map(([column, titles]) => (
        <section key={column} aria-label={column}>
          <h2>{column}</h2>
          <ul>{titles.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>
      ))}
    </div>
  );
}
```

### `src/board.ts`

```ts
// board.ts (board-model): each card owns its column and rank
import * as Y from 'yjs';
import { generateKeyBetween } from 'fractional-indexing';

export type Card = Y.Map<Y.Text | string>;          // { title: Y.Text, column: string, rank: string }
export type CardView = { id: string; rank: string; title: string };
export type BoardView = Record<string, string[]>;                    // column -> card titles, in order

export const cardsOf = (doc: Y.Doc) => doc.getMap<Card>('cards');
export const titleOf = (doc: Y.Doc, id: string) => cardsOf(doc).get(id)!.get('title') as Y.Text;

export function addCard(doc: Y.Doc, id: string, title: string, column: string, rank: string) {
  doc.transact(() => {
    const card: Card = new Y.Map();
    const text = new Y.Text();
    text.insert(0, title);
    card.set('title', text);                        // collaborative text: concurrent edits merge
    card.set('column', column);                     // last-writer-wins register
    card.set('rank', rank);                         // fractional-index key within the column
    cardsOf(doc).set(id, card);
  });
}

export function moveCard(doc: Y.Doc, id: string, column: string, rank: string) {
  doc.transact(() => {
    const card = cardsOf(doc).get(id)!;
    card.set('column', column);
    card.set('rank', rank);
  });
}

// Ties happen when two people insert at the same spot concurrently; the card ID breaks them the same way everywhere.
const byRank = (a: CardView, b: CardView) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : a.id < b.id ? -1 : 1);

/** The view is derived, never stored: a card can only be in the one column its own field names. */
export function boardView(doc: Y.Doc): Record<string, CardView[]> {
  const lists: Record<string, CardView[]> = {};
  cardsOf(doc).forEach((card, id) => {
    (lists[card.get('column') as string] ??= []).push({ id, rank: card.get('rank') as string, title: String(card.get('title')) });
  });
  for (const list of Object.values(lists)) list.sort(byRank);
  return lists;
}

export const columnsView = (doc: Y.Doc): BoardView =>
  Object.fromEntries(Object.entries(boardView(doc)).map(([column, list]) => [column, list.map((c) => c.title)]));

/** A rank for position `index` in `column`: between the neighbours the user can see. */
export function rankAt(doc: Y.Doc, column: string, index: number, exclude?: string) {
  const others = (boardView(doc)[column] ?? []).filter((c) => c.id !== exclude);
  const lo: string | null = others[index - 1]?.rank ?? null;          // null means 'start of column'
  let hi: string | null = others[index]?.rank ?? null;               // null means 'end of column'
  if (lo !== null && hi !== null && lo >= hi) hi = others.find((c) => c.rank > lo)?.rank ?? null; // tied neighbours
  return generateKeyBetween(lo, hi);
}

/** What a drop handler calls. */
export const placeCard = (doc: Y.Doc, id: string, column: string, index: number) =>
  moveCard(doc, id, column, rankAt(doc, column, index, id));

/** An external store over the document, for React's useSyncExternalStore. */
export function createBoardStore(doc: Y.Doc) {
  let snapshot = columnsView(doc);
  const listeners = new Set<() => void>();
  doc.on('update', () => {                          // local and remote changes alike
    snapshot = columnsView(doc);
    listeners.forEach((notify) => notify());
  });
  return {
    subscribe: (notify: () => void) => { listeners.add(notify); return () => { listeners.delete(notify); }; },
    getSnapshot: () => snapshot,                    // stable between updates, as React requires
  };
}

/** The tempting model: an array of card IDs per column. Kept only to demonstrate why it breaks. */
export const arrayModel = (doc: Y.Doc) => doc.getMap<Y.Array<string>>('columnArrays');
```

### `test/board-react.test.tsx`

```tsx
import { act, render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import * as Y from 'yjs';
import { addCard, createBoardStore, moveCard } from '../src/board.ts';
import { Board } from '../src/Board.tsx';

it('re-renders when a remote replica moves a card', () => {
  const local = new Y.Doc(), remote = new Y.Doc();
  addCard(local, 'card-1', 'Fix login bug', 'todo', 'a0');
  Y.applyUpdate(remote, Y.encodeStateAsUpdate(local));
  render(<Board store={createBoardStore(local)} />);
  expect(within(screen.getByRole('region', { name: 'todo' })).getByText('Fix login bug')).toBeTruthy();

  const before = Y.encodeStateVector(remote);
  moveCard(remote, 'card-1', 'done', 'a0');                              // a colleague moves it on another device
  act(() => Y.applyUpdate(local, Y.encodeStateAsUpdate(remote, before)));   // the update arrives over the socket
  expect(screen.queryByRole('region', { name: 'todo' })).toBeNull();
  expect(within(screen.getByRole('region', { name: 'done' })).getByText('Fix login bug')).toBeTruthy();
});
```

### `test/board.test.ts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import { generateNKeysBetween } from 'fractional-indexing';
import { addCard, arrayModel, columnsView, moveCard, titleOf } from '../src/board.ts';

// Two replicas that start in sync, then work offline, then exchange updates
function replicas(setup: (d: Y.Doc) => void) {
  const a = new Y.Doc(), b = new Y.Doc();
  setup(a);
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  return { a, b };
}
const sync = (x: Y.Doc, y: Y.Doc) => {
  const toY = Y.encodeStateAsUpdate(x, Y.encodeStateVector(y));  // only what y is missing
  const toX = Y.encodeStateAsUpdate(y, Y.encodeStateVector(x));
  Y.applyUpdate(y, toY);
  Y.applyUpdate(x, toX);
  return toY.byteLength + toX.byteLength;
};

test('per-column arrays duplicate a card that two people move concurrently', () => {
  const { a, b } = replicas((d: Y.Doc) => d.transact(() => {
    for (const c of ['todo', 'review', 'done']) arrayModel(d).set(c, new Y.Array<string>());
    arrayModel(d).get('todo')!.push(['card-1']);
  }));
  const move = (d: Y.Doc, to: string) => d.transact(() => { arrayModel(d).get('todo')!.delete(0, 1); arrayModel(d).get(to)!.push(['card-1']); });
  move(a, 'done');                                                    // offline: A moves it to Done
  move(b, 'review');                                                  // offline: B moves it to Review
  sync(a, b);
  const where = (d: Y.Doc) => ['todo', 'review', 'done'].filter((c) => arrayModel(d).get(c)!.toArray().includes('card-1'));
  assert.deepEqual(where(a), ['review', 'done']);                     // the same card is now in two columns
  assert.deepEqual(where(b), ['review', 'done']);
});

test('a card-owned column field converges to exactly one column on every replica', () => {
  const { a, b } = replicas((d) => addCard(d, 'card-1', 'Fix login bug', 'todo', 'a0'));
  moveCard(a, 'card-1', 'done', 'a0');
  moveCard(b, 'card-1', 'review', 'a0');
  sync(a, b);
  assert.deepEqual(columnsView(a), columnsView(b));                   // both replicas agree…
  assert.equal(Object.keys(columnsView(a)).length, 1);                // …and the card is in one column only
});

test('concurrent edits to different fields and to the same text all survive', () => {
  const { a, b } = replicas((d) => addCard(d, 'card-1', 'login bug', 'todo', 'a0'));
  titleOf(a, 'card-1').insert(0, 'Fix ');            // A edits the start of the title
  moveCard(a, 'card-1', 'doing', 'a0');                                  // and moves it
  const t = titleOf(b, 'card-1');
  t.insert(t.length, ' (urgent)');                                    // B edits the end, concurrently
  sync(a, b);
  assert.deepEqual(columnsView(a), { doing: ['Fix login bug (urgent)'] });
  assert.deepEqual(columnsView(b), columnsView(a));
});

test('updates merge in any order, and a sync sends only what the peer lacks', () => {
  const keys = generateNKeysBetween(null, null, 200);
  const { a, b } = replicas((d) => { for (let i = 0; i < 200; i++) addCard(d, `c${i}`, `Card ${i}`, 'todo', keys[i]); });
  const base = Y.encodeStateAsUpdate(a);                               // the shared starting point
  const full = base.byteLength;
  const u1 = (() => { const before = Y.encodeStateVector(a); moveCard(a, 'c1', 'done', 'a1'); return Y.encodeStateAsUpdate(a, before); })();
  const u2 = (() => { const before = Y.encodeStateVector(b); moveCard(b, 'c2', 'done', 'a2'); return Y.encodeStateAsUpdate(b, before); })();
  const c = new Y.Doc(), d = new Y.Doc();
  for (const doc of [c, d]) Y.applyUpdate(doc, base);
  Y.applyUpdate(c, u1); Y.applyUpdate(c, u2);                         // one order…
  Y.applyUpdate(d, u2); Y.applyUpdate(d, u1);                         // …and the other
  assert.deepEqual(columnsView(c), columnsView(d));
  assert.deepEqual(columnsView(c).done, ['Card 1', 'Card 2']);       // both offline moves are present
  const delta = sync(a, b);
  console.log(`full document: ${full} bytes; incremental sync of two moves: ${delta} bytes`);
  assert.ok(delta < full / 20);
});
```

### `test/collab.test.ts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import { generateNKeysBetween } from 'fractional-indexing';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import { addCard, cardsOf, columnsView, moveCard, titleOf } from '../src/board.ts';

const LOCAL = Symbol('local-user');                                   // origin tag for this user's own edits

test('undo reverts only my own changes, never a colleague\'s', () => {
  const a = new Y.Doc(), b = new Y.Doc();
  addCard(a, 'card-1', 'Fix login bug', 'todo', 'a0');
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  const undo = new Y.UndoManager(cardsOf(a), { trackedOrigins: new Set([LOCAL]) });
  a.transact(() => moveCard(a, 'card-1', 'done', 'a0'), LOCAL);          // my move, tagged as mine
  const before = Y.encodeStateVector(b);
  titleOf(b, 'card-1').insert(0, '[P1] ');                            // a colleague's concurrent edit
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b, before), 'remote');
  undo.undo();
  assert.deepEqual(columnsView(a), { todo: ['[P1] Fix login bug'] }); // my move is undone; their edit stays
});

test('presence travels in the awareness channel, not in the document', () => {
  const a = new Y.Doc(), b = new Y.Doc();
  const pa = new Awareness(a), pb = new Awareness(b);
  pa.setLocalStateField('user', { name: 'Asha', color: '#0b7285' });
  pa.setLocalStateField('focus', 'card-1');
  applyAwarenessUpdate(pb, encodeAwarenessUpdate(pa, [a.clientID]), 'remote');
  assert.deepEqual(pb.getStates().get(a.clientID), { user: { name: 'Asha', color: '#0b7285' }, focus: 'card-1' });
  assert.equal(Y.encodeStateAsUpdate(a).byteLength, Y.encodeStateAsUpdate(new Y.Doc()).byteLength); // the doc is untouched
  pa.destroy(); pb.destroy();
});

test('a server can compact its update log without changing the result', () => {
  const doc = new Y.Doc(), log: Uint8Array[] = [], keys = generateNKeysBetween(null, null, 50);
  doc.on('update', (u: Uint8Array) => log.push(u));
  for (let i = 0; i < 50; i++) addCard(doc, `c${i}`, `Card ${i}`, 'todo', keys[i]);
  for (let i = 0; i < 50; i++) moveCard(doc, `c${i}`, 'done', keys[i]);
  const merged = Y.mergeUpdates(log);
  const replay = new Y.Doc();
  Y.applyUpdate(replay, merged);
  assert.deepEqual(columnsView(replay), columnsView(doc));
  const sum = log.reduce((n, u) => n + u.byteLength, 0);
  console.log(`log: ${log.length} updates, ${sum} bytes; merged: ${merged.byteLength} bytes`);
  assert.ok(merged.byteLength < sum);
});

test('float midpoints run out after a few dozen inserts at the same spot', () => {
  let lo = 1, hi = 2, n = 0;
  while ((lo + hi) / 2 !== lo && (lo + hi) / 2 !== hi) { hi = (lo + hi) / 2; n++; }
  console.log(`float midpoint between 1 and 2 collapses after ${n} inserts`);
  assert.ok(n < 60);
});
```

### `test/fuzz.test.ts`

```ts
// fuzz.test.ts: three replicas, random edits, a flaky network, then a full sync. Same seeds for both models.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import { addCard, arrayModel, boardView, cardsOf, placeCard, rankAt, titleOf } from '../src/board.ts';

const COLUMNS = ['todo', 'doing', 'review', 'done'];
type Op = (doc: Y.Doc, rand: () => number, step: number) => void;

function prng(seed: number) {                                         // mulberry32: every run is reproducible
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(rand: () => number, xs: T[]) => xs[Math.floor(rand() * xs.length)];
const syncPair = (x: Y.Doc, y: Y.Doc) => {
  const toY = Y.encodeStateAsUpdate(x, Y.encodeStateVector(y));
  const toX = Y.encodeStateAsUpdate(y, Y.encodeStateVector(x));
  Y.applyUpdate(y, toY);
  Y.applyUpdate(x, toX);
};
const syncAll = (docs: Y.Doc[]) => docs.forEach((x) => docs.forEach((y) => x !== y && syncPair(x, y)));

function simulate(seed: number, init: (doc: Y.Doc) => void, op: Op) {
  const rand = prng(seed);
  const docs = [1, 2, 3].map((id) => Object.assign(new Y.Doc(), { clientID: id }));
  init(docs[0]);
  syncAll(docs);
  for (let step = 0; step < 300; step++) {
    op(pick(rand, docs), rand, step);
    if (rand() < 0.1) syncPair(pick(rand, docs), pick(rand, docs)); // replicas meet only now and then
  }
  syncAll(docs);
  return docs;
}

const cardOwnedOp: Op = (doc, rand, step) => {
  const ids = [...cardsOf(doc).keys()];
  const column = pick(rand, COLUMNS);
  const index = Math.floor(rand() * ((boardView(doc)[column]?.length ?? 0) + 1));
  const r = rand();
  if (ids.length < 3 || r < 0.3) addCard(doc, `card-${doc.clientID}-${step}`, `Card ${step}`, column, rankAt(doc, column, index));
  else if (r < 0.8) placeCard(doc, pick(rand, ids), column, index);
  else { const t = titleOf(doc, pick(rand, ids)); t.insert(Math.floor(rand() * (t.length + 1)), '*'); }
};

const arrayOp: Op = (doc, rand, step) => {
  const cols = arrayModel(doc);
  const placed = COLUMNS.flatMap((c) => cols.get(c)!.toArray().map((id, i) => ({ c, id, i })));
  const target = cols.get(pick(rand, COLUMNS))!;
  const at = () => Math.floor(rand() * (target.length + 1));
  if (placed.length < 3 || rand() < 0.3) target.insert(at(), [`card-${doc.clientID}-${step}`]);
  else {
    const { c, id, i } = pick(rand, placed);
    doc.transact(() => { cols.get(c)!.delete(i, 1); target.insert(at(), [id]); });
  }
};

test('card-owned model: 100 random runs converge, and every card is in exactly one column', () => {
  let cards = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const docs = simulate(seed, () => {}, cardOwnedOp);
    const [v0, v1, v2] = docs.map(boardView);
    assert.deepEqual(v1, v0, `seed ${seed}: replicas disagree`);
    assert.deepEqual(v2, v0, `seed ${seed}: replicas disagree`);
    const ids = Object.values(v0).flat().map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, `seed ${seed}: a card is in two places`);
    assert.equal(ids.length, cardsOf(docs[0]).size, `seed ${seed}: a card went missing`);
    cards += ids.length;
  }
  console.log(`card-owned: 100/100 runs converged, ${cards} cards, 0 duplicates`);
});

test('per-column arrays: the same random runs duplicate cards', () => {
  let runs = 0, extra = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const docs = simulate(seed, (d) => COLUMNS.forEach((c) => arrayModel(d).set(c, new Y.Array<string>())), arrayOp);
    const ids = COLUMNS.flatMap((c) => arrayModel(docs[0]).get(c)!.toArray());
    const dup = ids.length - new Set(ids).size;
    if (dup > 0) { runs++; extra += dup; }
  }
  console.log(`per-column arrays: ${runs}/100 runs duplicated cards (${extra} extra copies)`);
  assert.ok(runs > 0);
});
```

### `test/readonly.test.mjs`

```js
// readonly.test.mjs: the sync server, not the CRDT, enforces who may write
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import { Server } from '@hocuspocus/server';
import { HocuspocusProvider } from '@hocuspocus/provider';

const ROLES = { 'token-editor': 'editor', 'token-viewer': 'viewer' };   // stand-in for verifying a signed, short-lived token

const server = new Server({
  quiet: true,
  async onAuthenticate({ token, documentName, connectionConfig }) {
    const role = ROLES[token];
    if (!role || documentName !== 'board-42') throw new Error('forbidden');   // unknown token or wrong board: refuse
    connectionConfig.readOnly = role === 'viewer';                    // viewers receive updates but cannot send them
    return { role };
  },
});
await server.listen(0);
const url = `ws://127.0.0.1:${server.address.port}`;
after(() => server.destroy());

function connect(token) {
  const doc = new Y.Doc();
  return new Promise((resolve) => {
    const provider = new HocuspocusProvider({
      url, name: 'board-42', token, document: doc,
      onSynced: () => resolve({ doc, provider, failed: null }),
      onAuthenticationFailed: ({ reason }) => resolve({ doc, provider, failed: reason }),
    });
  });
}
const settle = () => new Promise((r) => setTimeout(r, 300));

test('an editor\'s write reaches the server and other clients; a viewer\'s write is dropped', async () => {
  const editor = await connect('token-editor');
  const viewer = await connect('token-viewer');
  editor.doc.getMap('cards').set('card-1', 'todo');
  viewer.doc.getMap('cards').set('card-2', 'todo');                  // the viewer edits its local replica anyway
  await settle();
  const onServer = server.hocuspocus.documents.get('board-42').getMap('cards').toJSON();
  assert.deepEqual(onServer, { 'card-1': 'todo' });
  assert.deepEqual(editor.doc.getMap('cards').toJSON(), { 'card-1': 'todo' });
  assert.deepEqual(viewer.doc.getMap('cards').toJSON(), { 'card-1': 'todo', 'card-2': 'todo' }); // local only: the UI must not offer the edit
  editor.provider.destroy(); viewer.provider.destroy();
});

test('an unknown token is refused before any document state is sent', async () => {
  const intruder = await connect('token-stolen-and-expired');
  assert.ok(intruder.failed);
  assert.deepEqual(intruder.doc.getMap('cards').toJSON(), {});
  intruder.provider.destroy();
});
```

### `tools/key-length.mjs`

```js
// Companion code: how long fractional-index keys grow under repeated insertion at one spot
import { generateKeyBetween } from 'fractional-indexing';
let lo = 'a0', hi = 'a1';
const lens = [];
for (let i = 1; i <= 300; i++) { hi = generateKeyBetween(lo, hi); if ([10, 50, 100, 300].includes(i)) lens.push(`${i}: ${hi.length} chars`); }
console.log(lens.join(' | '));
let last = 'a0'; for (let i = 0; i < 1000; i++) last = generateKeyBetween(last, null);
console.log('1000 appends at the end:', last.length, 'chars', last);
```

### `package.json`

```json
{
  "name": "handbook-69-case-study-collaborative-project-management",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.18"
  },
  "scripts": {
    "test": "node --test \"test/**/*.test.ts\" \"test/**/*.test.mjs\" && vitest run",
    "typecheck": "tsc"
  },
  "dependencies": {
    "fractional-indexing": "4.0.0",
    "react": "19.3.1",
    "react-dom": "19.3.1",
    "y-protocols": "1.0.7",
    "yjs": "13.6.33"
  },
  "devDependencies": {
    "@hocuspocus/provider": "4.9.0",
    "@hocuspocus/server": "4.9.0",
    "@testing-library/dom": "10.4.2",
    "@testing-library/react": "16.3.3",
    "@testing-library/user-event": "14.6.13",
    "@types/node": "22.20.6",
    "@types/react": "19.3.3",
    "@types/react-dom": "19.3.0",
    "jsdom": "31.0.1",
    "typescript": "6.0.3",
    "vitest": "5.1.2",
    "ws": "8.23.0"
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
    },
    "jsx": "react-jsx"
  },
  "include": [
    "src",
    "test"
  ]
}
```

### `vitest.config.ts`

```ts

import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'jsdom', include: ['test/**/*.test.tsx'] } });
```

---

[← Previous: E68 — Storefront: cached product pages, safe structured data, an optimistic bag](E68-case-study-ecommerce-storefront.md) · [Chapter 69](69-case-study-collaborative-project-management.md) · [Index](README.md) · [Next: E70 — Prism: tokens, a contrast gate, an accessible component, usage telemetry →](E70-case-study-enterprise-design-system.md)
