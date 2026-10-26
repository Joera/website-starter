# The s2s protocol: options and constraints for a website-starter publication

Companion to `skills/template-design/SKILL.md` (the render pipeline + `render:dev` iteration loop).
This skill captures the **s2s protocol** affordances (the options a publication actually has) and its
constraints (what it cannot do, and the failure modes that are silent) so you can design templates,
partials, helpers, `mapping.json` and content against the real boundaries without reading protocol
source. Canonical copy: `~/code/website-starter/skills/s2s-protocol/SKILL.md`; every publication clone
carries its own mirror (e.g. `~/code/s2s-s3ntiment/skills/s2s-protocol/SKILL.md`).

## Mental model recap

A publication is a **static site generated from templates + data**:

1. Content — markdown bodies + collections (deals).
2. Transform — markdown → HTML; content directives turn into real elements at render. Stored content
   stays raw.
3. Template render — the Handlebars-style engine fills `templateData` into templates + partials,
   running helpers.
4. Output — `html/*.html` served on `:3008`.

The renderer core is **shared with production**. Local iteration uses `pnpm render:dev`, which
POSTs all render materials (templates, partials, fixtures, helper source) to a remote Bun runner that
runs the **same pure renderer core**, and writes `html/*.html`. Zero drift: preview ≈ what ships.

## Options — what the protocol gives you

### Two authoring surfaces (keep them separate)
| Surface | lives in | what you author |
|---|---|---|
| Content directives | the markdown body | declarative comment markers, e.g. `<!-- section class="aside">…` → real HTML at render |
| Template helpers | the template | `{{helpername arg1 arg2}}` named-function calls |

### `mapping.json` — the publication config
- `templateConfig[]`: each entry holds `{ reference, file, path, collections[] }`.
  - `reference` — a stable id for the config (e.g. `home_nl`, `home_en`).
  - `file` — the template source (e.g. `home.handlebars`).
  - `path` — the output URL; may contain `{slug}`.
  - `collections[]` — the data the template iterates, each `{ slug, filters[] }`.
- `collections[].filters[]`: `{ field: value }` predicates that populate `collections.<slug>` from the
  collection/data source (e.g. `allDeals[]`). Filters run in the **remote renderer** — treat their
  exact match semantics as authoritative there; verify via `render:dev`, not local files.
- `ripples[]`: regeneration rules — `{ origins, destination, reference, query: { genesis }, filters[] }`.
  `origins` are post-types; `destination`/`reference` name the templateConfig entry that regenerates
  when an origin changes. Give every home/config a ripple.

### Content model (S2SBody / DevBody)
Bodies carry: `id, author, locale, parent, position, postType, creationDate, modifiedDate, tags,
attributes, publication, base, encryption, content, title, slug, custom{}`.
- `locale` is the **canonical language field — NOT `language`**. The renderer's path routing and the
  body schema key off `locale`. Keep filters/tags on `locale`.
- `encryption: false` bodies are plaintext (fixtures); encrypted bodies are decrypt-only in the
  enclave/preview — never in the local kit.
- `custom{}` is the extension bag for publication-specific fields.

### Helpers
- Built-ins exist for common needs (date, slice, slugify, trim, …).
- Publication-supplied helpers = a **bare JS expression** at repo root `helpers.source` (no trailing
  `;`, pure functions). The render action evals it as `return (SOURCE);` and expects a
  `{ name: fn }` map. `render:dev` fail-fast validates this locally before hitting the runner.
- A missing/typo'd helper returns the raw `{{...}}` unchanged; an erroring helper returns `""` —
  **both are silent**. Verify output, never assume.

### Directives / content transforms
`<!-- section …>…` expands to real elements at render (post-markdown). `sections` is built-in;
publication-specific directives extend the same directive table. They live in the markdown body, not
the templates.

### `createPath` routing
The renderer's path function decides output URLs: a `{slug}` in `templateConfig.path` is substituted
with the body slug for unencrypted bodies that have one. Locale routing is currently a hardcoded
two-language scheme (`nl`/`undefined` → no prefix; anything else → `/en`). The agreed redesign
(proposal with the protocol owner, 2026-08-13) is **config-driven and monolingual by default**: a
global `localePaths` map (`{ locale: prefix }`) supplies per-language prefixes, and with no map
configured routing is a clean pass-through (no prefix). Treat hardcoded `/en` as legacy until the
protocol lands the config-driven version; design against `localePaths`.

## Constraints — the hard boundaries

- **No block helpers.** The engine skips `{{#name}}…{{/name}}`. Do NOT design templates that depend on
  `{{#featured}}…{{/featured}}` wrapping/iteration. Use `{{#each collections.<slug>}}` for iteration.
- **Track 2 helper injection is dead in production today — build-ins + the publication helper module
  only.** Publication helpers ship via `helpers.source`; there is no arbitrary runtime
  helper-injection path. Design helpers through the module, not ad-hoc injection.
- **Silent helper-failure modes** (missing → raw `{{…}}`; error → `""`). Always verify the HTML string.
- **Helpers must be pure** (no I/O, no side effects) — they run inside the render action.
- **Zero drift is the rule**: `render:dev` renders through the same core production uses; verify as
  HTML strings (diffable, assertable); the browser is the styling pass only.
- **HTML string is the source of truth.** Assert on `html/*.html`, not a browser renderer.
- **Root-absolute paths (INV-11):** templates emit `/assets/...` and root-absolute page links; the
  published tree is served origin-per-CID. No relative asset paths.
- **The template→config contract is do-not-touch:** `mapping.json` structure, the partial/helper names
  and the `collections.<slug>` shape the action renderer expects. Change surface: templates, partials,
  SCSS/CSS, assets, README, fixtures, `helpers.source`, and `mapping.json` content/values.
- **Standalone repo:** a publication clone has zero `@s2s/*` deps; it needs only two config strings
  (`S2S_RUNNER_URL` + the dev-action CID). No imports from shared/protocol.
- **`render-dev.ts` local specs can drift from `mapping.json`.** `scripts/render-dev.ts`'s
  `loadSpecs()` / `loadContractSpecs()` hardcode their own templateConfig/collections. If you change
  `mapping.json` (new collections, filters, language configs), keep the local specs in sync or
  `render:dev` won't exercise the change — and can silently render stale config.
- **Filter/collection matching is authoritative in the remote core**, not locally. To confirm a filter
  (e.g. `{ locale: "nl" }`) actually narrows, run `render:dev` and inspect the HTML — don't assume
  from local files.
- **Default language = monolingual; per-language routing is an explicit opt-in** (`localePaths`).
  Detail configs that share one template across locales need that routing, or same-slug pages
  collide (in contract mode two languages writing the same `html/<slug>.html` overwrite each other).

## Verifying ground truth
- `pnpm render:dev` → assert on `html/<name>.html` (string asserts / diffs).
- `pnpm serve` → `:3008` browser preview (styling/layout only).
- `render:dev --source=contract [--limit N]` pulls on-chain content through the same action.

## Cross-references / sources
- Companion: `skills/template-design/SKILL.md` (pipeline + iteration loop + helper contract).
- Dev-kit RFC: `~/code/s2s/brain/specs/RFC-website-starter-agent-kit.md` (RFC B).
- Component spec: `~/code/s2s/brain/specs/SPEC-website-starter.md`.
- Deeper renderer/action/mapping details: `~/code/s2s/brain/specs/SPEC-protocol-actions.md`,
  `SPEC-shared.md` (mapping schema), `SPEC-00-system-contract.md`.
- Self-sufficient protocol overview (the *why*, trust topology, PREP→RENDER→UPDATE actions,
  data model, locale routing) — see `references/protocol-overview.md` in this skill.
