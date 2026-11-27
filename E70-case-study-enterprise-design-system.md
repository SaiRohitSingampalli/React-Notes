# E70 — Prism: tokens, a contrast gate, an accessible component, usage telemetry

> Runnable code for [70 — Case Study: Building an Enterprise Design System (Prism)](70-case-study-enterprise-design-system.md). 7 tests.

The design-system pipeline from the case study:

- `tokens/`: DTCG tokens (primitives, plus semantic light and dark themes). `npm run tokens` builds one CSS file per theme with Style Dictionary 5.
- `scripts/check-contrast.mjs`: the build gate. Every declared foreground and background pair, in every theme, must meet its WCAG 2.2 minimum.
- `src/Switch.tsx`: React Aria supplies behaviour and accessibility; Prism supplies the look, in a cascade layer. The test runs axe-core in each state and checks the keyboard and screen-reader contract.
- `scripts/prism-usage.mjs`: which components and props consumers use, read with the TypeScript compiler API, so deprecations are measured before they ship.

`npm run build` builds the tokens and the component library.

## Run it

From the handbook folder:

```bash
node extract-examples.mjs 70    # writes examples/70-case-study-enterprise-design-system/
cd examples/70-case-study-enterprise-design-system
npm ci
npm test
npm run typecheck
npm run contrast
npm run usage
npm run build
```

## Where the code comes from

Each file below contains its chapter block verbatim. Lines added around a block (imports the chapter omits, types it defines elsewhere, extra code the tests need) are marked in the file.

| File | Chapter and section |
|---|---|
| `src/Switch.tsx` | 70, "4.3 Components: React Aria inside, Prism outside" |
| `src/switch.css` | 70, "4.3 Components: React Aria inside, Prism outside" |
| `src/Switch.test.tsx` | 70, "4.4 The accessibility contract, tested" |
| `scripts/build-tokens.mjs` | 70, "4.1 Tokens: one source, built per theme" |
| `scripts/check-contrast.mjs` | 70, "4.2 Contrast is a build gate" |
| `scripts/prism-usage.mjs` | 70, "4.7 Deprecations are measured" |

## Files

Every file of the project: source first, then tests, then scripts and data, then configuration. The exact lockfile is in `examples.lock.json`; the extraction script writes it into the project as `package-lock.json`.

### `src/Button.tsx`

```tsx
// Button.tsx: Prism's button on React Aria (press events that behave across mouse, touch, keyboard and screen readers)
import type { ReactNode } from 'react';
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components';

export interface ButtonProps extends Omit<AriaButtonProps, 'className' | 'style' | 'children'> {
  variant?: 'primary' | 'secondary' | 'destructive';
  children: ReactNode;
}

export function Button({ variant = 'secondary', ...props }: ButtonProps) {
  return <AriaButton {...props} className="prism-button" data-variant={variant} />;
}
```

### `src/Switch.tsx`

```tsx
// packages/react/src/switch/Switch.tsx: React Aria supplies behaviour and accessibility; Prism supplies the look
import type { ReactNode } from 'react';
import { Switch as AriaSwitch, type SwitchProps as AriaSwitchProps } from 'react-aria-components';
import './switch.css';

export interface SwitchProps extends Omit<AriaSwitchProps, 'className' | 'style' | 'children'> {
  children: ReactNode;                                              // a visible label is required
}

export function Switch({ children, ...props }: SwitchProps) {
  return (
    <AriaSwitch {...props} className="prism-switch">
      <span className="prism-switch__track" aria-hidden="true"><span className="prism-switch__thumb" /></span>
      {children}
    </AriaSwitch>
  );
}
```

### `src/css.d.ts`

```ts
declare module '*.css';
```

### `src/switch.css`

```css
@layer prism.components {
  .prism-switch { display: inline-flex; align-items: center; gap: var(--prism-space-2); color: var(--prism-color-text-default); }
  .prism-switch__track {
    inline-size: 2.25rem; block-size: 1.25rem; border-radius: 999px; padding: 2px;
    border: 1px solid var(--prism-color-border-control); background: var(--prism-color-bg-subtle);
  }
  .prism-switch__thumb { display: block; inline-size: 1rem; block-size: 1rem; border-radius: 50%; background: var(--prism-color-text-subtle); }
  .prism-switch[data-selected] .prism-switch__track { background: var(--prism-color-action-primary-bg); border-color: transparent; }
  .prism-switch[data-selected] .prism-switch__thumb { background: var(--prism-color-action-primary-text); translate: 1rem 0; }
  .prism-switch[data-focus-visible] .prism-switch__track { outline: 2px solid var(--prism-color-focus-ring); outline-offset: 2px; }
  .prism-switch[data-disabled] { opacity: 0.5; }
  @media (prefers-reduced-motion: no-preference) { .prism-switch__thumb { transition: translate 120ms ease-out; } }
  @media (forced-colors: active) { .prism-switch[data-selected] .prism-switch__thumb { background: Highlight; } }
}
```

### `scripts/check-contrast.test.mjs`

```js
// @vitest-environment node
import { expect, it } from 'vitest';
import { checkContrast, contrast } from './check-contrast.mjs';

it('matches the WCAG reference values', () => {
  expect(contrast('#000000', '#ffffff')).toBe(21);
  expect(contrast('#ffffff', '#ffffff')).toBe(1);
  expect(contrast('#c92a2a', '#ffffff')).toBeCloseTo(5.46, 2);
});

it('passes for the shipped light and dark themes', async () => {
  expect(await checkContrast()).toEqual([]);
});

it('refuses translucent colours rather than guessing', () => {
  expect(() => contrast('#00000080', '#ffffff')).toThrow(/opaque/);
});
```

### `scripts/prism-usage.test.mjs`

```js
// @vitest-environment node
import { expect, it } from 'vitest';
import { scan } from './prism-usage.mjs';

it('counts Prism usages through aliases, ignores look-alikes, and flags deprecated props with locations', () => {
  const { usage, deprecated } = scan('fixtures/consumer');
  expect(usage.Button.count).toBe(3);                                // LegacyButton from ./legacy is not Prism
  expect(usage.Switch.count).toBe(1);                                // imported as Toggle
  expect(usage.Button.props.variant).toEqual({ primary: 1, danger: 2 });
  expect(deprecated).toEqual([
    'Invoices.tsx:6 Button variant="danger": use variant="destructive" (removed in Prism 6)',
    'Settings.tsx:6 Button variant="danger": use variant="destructive" (removed in Prism 6)',
  ]);
});
```

### `src/Switch.test.tsx`

```tsx
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { Switch as AriaSwitch } from 'react-aria-components';
import { afterEach, expect, it, vi } from 'vitest';
import { Switch } from './Switch';

afterEach(cleanup);
const audit = (el: Element) => axe.run(el, { rules: { 'color-contrast': { enabled: false } } }); // jsdom can't compute colours

it('is a labelled switch that toggles from the keyboard', async () => {
  const onChange = vi.fn();
  render(<Switch onChange={onChange}>Email notifications</Switch>);
  const control = screen.getByRole('switch', { name: 'Email notifications' });
  await userEvent.tab();
  expect(document.activeElement).toBe(control);
  await userEvent.keyboard(' ');
  expect(onChange).toHaveBeenCalledWith(true);
  expect(control.closest('label')!.hasAttribute('data-selected')).toBe(true);
  expect(control.closest('label')!.hasAttribute('data-focus-visible')).toBe(true);   // keyboard focus is styled
});

it('has no axe violations', async () => {
  const { container } = render(<Switch defaultSelected>Dark mode</Switch>);
  expect((await audit(container)).violations).toEqual([]);
});

it('the audit has teeth: an unlabelled switch fails it', async () => {
  const { container } = render(<AriaSwitch />);
  expect((await audit(container)).violations.map((v) => v.id)).toContain('label');
});
```

### `fixtures/consumer/Invoices.tsx`

```tsx
import { Button, Table } from '@prism/react';
import { Button as LegacyButton } from './legacy';
export function Invoices() {
  return (<section>
    <Table aria-label="Invoices" />
    <Button variant="danger" size="sm">Void</Button>
    <LegacyButton kind="red">Old</LegacyButton>
  </section>);
}
```

### `fixtures/consumer/Settings.tsx`

```tsx
import { Button, Switch as Toggle } from '@prism/react';
export function Settings() {
  return (<form>
    <Toggle>Email notifications</Toggle>
    <Button variant="primary">Save</Button>
    <Button variant="danger">Delete account</Button>
  </form>);
}
```

### `scripts/build-tokens.mjs`

```js
// scripts/build-tokens.mjs: DTCG 2025.10 tokens -> one CSS file per theme, semantic tokens only
import StyleDictionary from 'style-dictionary';

export const THEMES = { light: ':root, [data-theme="light"]', dark: '[data-theme="dark"]' };

export function themeDictionary(theme) {
  return new StyleDictionary({
    source: ['tokens/primitives.tokens.json', `tokens/semantic.${theme}.tokens.json`],
    log: { verbosity: 'silent' },
    platforms: {
      css: {
        transformGroup: 'css',
        prefix: 'prism',
        buildPath: 'dist/css/',
        files: [{
          destination: `${theme}.css`,
          format: 'css/variables',
          filter: (token) => token.path[0] !== 'palette' && (theme === 'light' || token.$type === 'color'), // primitives stay private
          options: { selector: THEMES[theme], outputReferences: false },
        }],
      },
    },
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const theme of Object.keys(THEMES)) await themeDictionary(theme).buildAllPlatforms();
}
```

### `scripts/check-contrast.mjs`

```js
// scripts/check-contrast.mjs: every declared foreground/background pair, in every theme, meets WCAG 2.2
import { readFile } from 'node:fs/promises';
import { THEMES, themeDictionary } from './build-tokens.mjs';

const channel = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function luminance(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`${hex}: contrast needs an opaque hex colour (composite translucent ones first)`);
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;                      // WCAG 2.2 relative luminance
}
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export async function checkContrast() {
  const pairs = JSON.parse(await readFile('tokens/contrast-pairs.json', 'utf8'));
  const failures = [];
  for (const theme of Object.keys(THEMES)) {
    const { allTokens } = await themeDictionary(theme).getPlatformTokens('css');   // aliases resolved, transforms applied
    const value = (path) => allTokens.find((t) => t.path.join('.') === path)?.$value ?? `missing token ${path}`;
    for (const { fg, bg, min, use } of pairs) {
      const ratio = contrast(value(fg), value(bg));
      if (ratio < min) failures.push(`${theme}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1, needs ${min}:1 (${use})`);
    }
  }
  return failures;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const failures = await checkContrast();
  for (const f of failures) console.error(`FAIL ${f}`);
  console.log(failures.length ? `${failures.length} pair(s) below WCAG minimums` : 'PASS all declared pairs meet WCAG 2.2 contrast');
  process.exitCode = failures.length ? 1 : 0;
}
```

### `scripts/prism-usage.mjs`

```js
// scripts/prism-usage.mjs: which Prism components are used where, with which props (the chapter prints an excerpt)
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const DEPRECATED = { Button: { variant: { danger: 'use variant="destructive" (removed in Prism 6)' } } };

export function scan(dir) {
  const usage = {}, deprecated = [];
  for (const file of readdirSync(dir, { recursive: true }).filter((f) => /\.(t|j)sx$/.test(f))) {
    const path = join(dir, file);
    const src = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const local = new Map();                                          // local name -> Prism export name
    const visit = (node) => {
      if (ts.isImportDeclaration(node) && node.moduleSpecifier.text === '@prism/react') {
        for (const el of node.importClause?.namedBindings?.elements ?? []) local.set(el.name.text, (el.propertyName ?? el.name).text);
      }
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && local.has(node.tagName.getText(src))) {
        // count the component, count each prop value, and record deprecated ones with file:line
        const name = local.get(node.tagName.getText(src));
        const entry = (usage[name] ??= { count: 0, props: {} });
        entry.count++;
        for (const attr of node.attributes.properties) {
          if (!ts.isJsxAttribute(attr)) continue;
          const prop = attr.name.getText(src), value = attr.initializer && ts.isStringLiteral(attr.initializer) ? attr.initializer.text : '{expr}';
          const counts = (entry.props[prop] ??= {});
          counts[value] = (counts[value] ?? 0) + 1;
          const note = DEPRECATED[name]?.[prop]?.[value];
          if (note) deprecated.push(`${file}:${src.getLineAndCharacterOfPosition(attr.getStart(src)).line + 1} ${name} ${prop}="${value}": ${note}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(src);
  }
  return { usage, deprecated };
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(scan(process.argv[2]), null, 1));
```

### `tokens/contrast-pairs.json`

```json
[
  {
    "fg": "color.text.default",
    "bg": "color.bg.default",
    "min": 4.5,
    "use": "body text"
  },
  {
    "fg": "color.text.subtle",
    "bg": "color.bg.default",
    "min": 4.5,
    "use": "secondary text"
  },
  {
    "fg": "color.text.subtle",
    "bg": "color.bg.subtle",
    "min": 4.5,
    "use": "secondary text on panels"
  },
  {
    "fg": "color.text.danger",
    "bg": "color.bg.default",
    "min": 4.5,
    "use": "error messages"
  },
  {
    "fg": "color.action.primary.text",
    "bg": "color.action.primary.bg",
    "min": 4.5,
    "use": "primary button label"
  },
  {
    "fg": "color.border.control",
    "bg": "color.bg.default",
    "min": 3,
    "use": "control borders (WCAG 1.4.11)"
  },
  {
    "fg": "color.focus.ring",
    "bg": "color.bg.default",
    "min": 3,
    "use": "focus indicator (WCAG 1.4.11)"
  }
]
```

### `tokens/primitives.tokens.json`

```json
{
  "palette": {
    "$type": "color",
    "neutral": {
      "0": {
        "$value": {
          "colorSpace": "srgb",
          "components": [
            1.0,
            1.0,
            1.0
          ],
          "hex": "#ffffff"
        }
      },
      "50": {
        "$value": {
          "colorSpace": "srgb",
          "components": [
            0.9725,
            0.9765,
            0.9804
          ],
          "hex": "#f8f9fa"
        }
      },
      "200": {
        "$value": {
          "colorSpace": "srgb",
          "components": [
            0.9137,
            0.9255,
            0.9373
          ],
          "hex": "#e9ecef"
        }
      },
      "500": {
        "$value": {
          "colorSpace": "srgb",
          "components": [
            0.5255,
            0.5569,
            0.5882
          ],
          "hex": "#868e96"
        }
      },
      "600": {
        "$value": {
          "colorSpace": "srgb",
          "components": [
            0.4235,
            0.4588,
            0.4902
          ],
          "hex": "#6c757d"
        }
      },
      "700": {
        "$value": {
          "colorSpace": "srgb",
          "components": [
            0.2863,
            0.3137,
            0.3412
          ],
          "hex": "#495057"
        }
      },
      "900": {
        "$value": {
          "colorSpace": "srgb",
          "components": [
            0.1294,
            0.1451,
            0.1608
          ],
          "hex": "#212529"
        }
      },
      "950": {
        "$value": {
          "colorSpace": "srgb",
          "components": [
            0.0784,
            0.0824,
            0.0902
          ],
          "hex": "#141517"
        }
      }
    },
    "blue": {
      "400": {
        "$value": {
          "colorSpace": "srgb",
          "components": [
            0.302,
            0.6706,
            0.9686
          ],
          "hex": "#4dabf7"
        }
      },
      "600": {
        "$value": {
          "colorSpace": "srgb",
          "components": [
            0.1098,
            0.4941,
            0.8392
          ],
          "hex": "#1c7ed6"
        }
      },
      "700": {
        "$value": {
          "colorSpace": "srgb",
          "components": [
            0.098,
            0.4431,
            0.7608
          ],
          "hex": "#1971c2"
        }
      }
    },
    "red": {
      "400": {
        "$value": {
          "colorSpace": "srgb",
          "components": [
            1.0,
            0.5294,
            0.5294
          ],
          "hex": "#ff8787"
        }
      },
      "500": {
        "$value": {
          "colorSpace": "srgb",
          "components": [
            0.9804,
            0.3216,
            0.3216
          ],
          "hex": "#fa5252"
        }
      },
      "700": {
        "$value": {
          "colorSpace": "srgb",
          "components": [
            0.7882,
            0.1647,
            0.1647
          ],
          "hex": "#c92a2a"
        }
      }
    }
  },
  "space": {
    "$type": "dimension",
    "1": {
      "$value": {
        "value": 4,
        "unit": "px"
      }
    },
    "2": {
      "$value": {
        "value": 8,
        "unit": "px"
      }
    },
    "3": {
      "$value": {
        "value": 12,
        "unit": "px"
      }
    },
    "4": {
      "$value": {
        "value": 16,
        "unit": "px"
      }
    },
    "6": {
      "$value": {
        "value": 24,
        "unit": "px"
      }
    }
  },
  "radius": {
    "$type": "dimension",
    "control": {
      "$value": {
        "value": 6,
        "unit": "px"
      }
    }
  }
}
```

### `tokens/semantic.dark.tokens.json`

```json
{
  "color": {
    "$type": "color",
    "bg": {
      "default": {
        "$value": "{palette.neutral.950}"
      },
      "subtle": {
        "$value": "{palette.neutral.900}"
      }
    },
    "text": {
      "default": {
        "$value": "{palette.neutral.50}"
      },
      "subtle": {
        "$value": "{palette.neutral.500}"
      },
      "danger": {
        "$value": "{palette.red.400}"
      }
    },
    "action": {
      "primary": {
        "bg": {
          "$value": "{palette.blue.400}"
        },
        "text": {
          "$value": "{palette.neutral.950}"
        }
      }
    },
    "border": {
      "control": {
        "$value": "{palette.neutral.600}"
      }
    },
    "focus": {
      "ring": {
        "$value": "{palette.blue.400}"
      }
    }
  }
}
```

### `tokens/semantic.light.tokens.json`

```json
{
  "color": {
    "$type": "color",
    "bg": {
      "default": {
        "$value": "{palette.neutral.0}"
      },
      "subtle": {
        "$value": "{palette.neutral.50}"
      }
    },
    "text": {
      "default": {
        "$value": "{palette.neutral.900}"
      },
      "subtle": {
        "$value": "{palette.neutral.700}"
      },
      "danger": {
        "$value": "{palette.red.700}"
      }
    },
    "action": {
      "primary": {
        "bg": {
          "$value": "{palette.blue.700}"
        },
        "text": {
          "$value": "{palette.neutral.0}"
        }
      }
    },
    "border": {
      "control": {
        "$value": "{palette.neutral.500}"
      }
    },
    "focus": {
      "ring": {
        "$value": "{palette.blue.600}"
      }
    }
  }
}
```

### `package.json`

```json
{
  "name": "handbook-70-case-study-enterprise-design-system",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.18"
  },
  "scripts": {
    "tokens": "node scripts/build-tokens.mjs",
    "contrast": "node scripts/check-contrast.mjs",
    "usage": "node scripts/prism-usage.mjs fixtures/consumer",
    "build": "node scripts/build-tokens.mjs && vite build --config vite.lib.config.mjs",
    "test": "vitest run",
    "typecheck": "tsc"
  },
  "dependencies": {
    "react": "19.3.1",
    "react-aria-components": "1.22.1",
    "react-dom": "19.3.1"
  },
  "devDependencies": {
    "@testing-library/dom": "10.4.2",
    "@testing-library/react": "16.3.3",
    "@testing-library/user-event": "14.6.13",
    "@types/react": "19.3.3",
    "@types/react-dom": "19.3.0",
    "@vitejs/plugin-react": "6.3.0",
    "axe-core": "4.14.1",
    "jsdom": "31.0.1",
    "style-dictionary": "5.8.0",
    "typescript": "6.0.3",
    "vite": "8.3.8",
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
    "noUncheckedIndexedAccess": false,
    "lib": [
      "es2024",
      "dom",
      "dom.iterable"
    ],
    "types": [],
    "paths": {
      "@/*": [
        "./src/*"
      ]
    },
    "jsx": "react-jsx"
  },
  "include": [
    "src"
  ]
}
```

### `vite.lib.config.mjs`

```js
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/lib', emptyOutDir: true, minify: true,
    lib: { entry: { switch: 'src/Switch.tsx', button: 'src/Button.tsx' }, formats: ['es'] },
    rolldownOptions: { external: ['react', 'react-dom', 'react/jsx-runtime'] },
  },
});
```

### `vitest.config.ts`

```ts

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
export default defineConfig({ plugins: [react()], test: { environment: 'jsdom', include: ['src/**/*.test.tsx', 'scripts/**/*.test.mjs'] } });
```

---

[← Previous: E69 — A collaborative board on a CRDT](E69-case-study-collaborative-project-management.md) · [Chapter 70](70-case-study-enterprise-design-system.md) · [Index](README.md) · [Next: E74 — Machine-coding drills, with their tests →](E74-machine-coding-drills.md)
