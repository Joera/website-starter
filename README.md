# website

Soul2Soul website starter. Templates + partials live in `templates/`; SCSS in
`scss/`; the local render kit lives in `scripts/render-dev.ts` (plus
`scripts/contract-pull.ts` for pulling on-chain deals in mode 3).

```bash
pnpm sass          # scss/styles.scss -> css/styles.css
pnpm serve         # http-server html -p 3008 --cors -c-1  (preview)
pnpm render:dev    # render fixtures -> html/<page>.html (mode 1)
```

## render:dev — standalone local render kit (RFC B, Option C)

`pnpm render:dev` renders this site's **own templates/helpers/scripts locally**
and writes the HTML to `html/<page>.html` for the `pnpm serve` preview. No
chain, no Lit node, no signature, no keys, no publish.

### How it works

The kit is completely **standalone**: it imports nothing from `@s2s/*` (only
Node builtins + `fetch` + `dotenv`). A publication dev has only this component
locally — not `shared`, not `protocol` — so all render logic lives in the
deployed **render-dev action**, which the kit drives through the Bun runner:

```
POST { cid: <dev-action-cid>, inputs } -> S2S_RUNNER_URL
```

The kit gathers everything locally and POSTs it as `inputs`:

- `templateSource` — `templates/<file>.handlebars` (home, page, post)
- `partialsSource` — every `templates/partials/*.handlebars`, keyed by filename
  (`head`, `header`, `background`, `logo`, `origami-swans`)
- `body` — a plaintext fixture (`encryption: false` is required)
- `helpersSource` — `fixtures/helpers.source`, read verbatim and injected
- `collections` / `allDeals` — pre-built collections, or a raw deal array that
  runs the shared pure filter via `templateConfig.collections`

The render-dev action is the **same pure renderer core as production** (one
source, two input-provisioning modes), so local preview ≈ production by
construction. The response is the action's `ActionResult`:
`{ ok:true, action:'render-dev', html, trace }`, or `{ ok:false, error, trace }`
(failures print the error + trace and exit non-zero).

### Wiring

The kit needs exactly two config strings, from the environment (falls back to
defaults):

| env var              | default                                          |
| -------------------- | ------------------------------------------------ |
| `S2S_RUNNER_URL`     | `https://run.transport-union.dev/run`            |
| `S2S_DEV_ACTION_CID` | `QmbMbtySmJbd9a44niJpQN18U7tPdDzpLyEWpMinfdMGEG` |

The dev-action CID is the deployed render-dev action. The kit does **not** read
it from the monorepo's `protocol/scripts/lit/dev-actions.json` — that path does
not exist in a standalone checkout.

### What it renders

`fixtures/` drive the run (one render per spec in `scripts/render-dev.ts`):

| output           | template                    | data                                                                                         |
| ---------------- | --------------------------- | -------------------------------------------------------------------------------------------- |
| `html/home.html` | `templates/home.handlebars` | `all-deals.json` filtered via `templateConfig.collections` (shared filter)                   |
| `html/page.html` | `templates/page.handlebars` | `bodies/page.json` (sections directive in content)                                           |
| `html/post.html` | `templates/post.handlebars` | `bodies/post.json` (sections directive in content)                                           |
| `html/demo.html` | inline diagnostic template  | `demo.json` — proves the sections transform + injected helpers on a raw `{{{content}}}` sink |

### Iterating: add a helper and a fixture body

**Add a helper** — edit `fixtures/helpers.source`. It's a JS expression that
evaluates to a `{ name: (args) => ..., ... }` map of pure functions, read
verbatim and injected as `helpersSource`. For example, to add an `upper`
helper:

```js
({
  titleCase: (s) => String(s).replace(/\b\w/g, (c) => c.toUpperCase()),
  reverse: (s) => [...String(s)].reverse().join(''),
  upper: (s) => String(s).toUpperCase(),
});
```

Then use `{{upper title}}` in a template or the demo page.

**Add a fixture body** — drop a JSON file in `fixtures/bodies/` (e.g.
`my-post.json`) with `encryption: false` and any content, then hook it into the
spec list in `scripts/render-dev.ts` (copy a `page`-style spec, or point a
template at it).

Then re-run:

```bash
pnpm render:dev    # -> html/<page>.html
pnpm serve         # preview at http://localhost:3008
```

Helpers are injected as source, so editing `fixtures/helpers.source` and re-rendering
takes effect instantly — no `helpersCid` publish loop. `config`/`protocolInfo`
inputs are optional and omitted by the kit.

### Mode 3 — render from the on-chain publication module (contract pull)

`pnpm render:dev --source=contract` sources real deals from the `S2S Publication
Module V2` on Base L2 instead of the local fixtures. It is **completely
standalone** (no `@s2s/*` imports): `scripts/contract-pull.ts` connects via
`ethers5`, paginates `getDeals(offset, limit)` (pageSize 100), fetches the
`S2SContentItem` JSON for each deal's `cid` from the IPFS gateway, maps it into
the render-dev `body` shape (mode 1's `toBody` mapping), drops encrypted deals
(`encryption === true` — mode 3 is unencrypted-only), and renders the resulting
bodies through the same render-dev action used for fixtures.

Required env vars (`example..env`):

| env var                    | default                    | purpose                              |
| -------------------------- | -------------------------- | ------------------------------------ |
| `BASE_RPC_URL`             | `https://mainnet.base.org` | Base L2 RPC (chainId 8453)           |
| `PUBLICATION_MODULE_ADDRESS` | *(required)*             | on-chain module to pull deals from   |
| `IPFS_GATEWAY`             | `https://gateway.pinata.cloud` | `<gateway>/ipfs/<cid>` fetch     |

```bash
pnpm render:dev --source=contract          # all unencrypted deals
pnpm render:dev --source=contract --limit 10   # first 10
```

Output lands in `html/<page>.html` just like mode 1, so `pnpm serve` shows it.
