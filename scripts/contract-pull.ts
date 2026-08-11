/**
 * contract-pull — mode 3: pull unencrypted deals from the on-chain
 * 'S2S Publication Module V2' on Base L2 (chainId 8453) and map them into
 * the render-dev `body` shape, mirroring protocol/actions/src/libs/
 * module.factory.ts (ABI + toBody) with the ABI INLINED (no import).
 *
 * STANDALONE CONSTRAINT: a publication dev has ONLY this component locally
 * (not `shared`, not `protocol`). This script therefore imports NOTHING from
 * `@s2s/*` — only `ethers5` (npm:ethers@^5.8.0, ethers v5 API), Node builtins,
 * global `fetch`, and `dotenv`.
 *
 * Reads:
 *   BASE_RPC_URL              (default https://mainnet.base.org)
 *   PUBLICATION_MODULE_ADDRESS (required — the module to pull deals from)
 *   IPFS_GATEWAY              (default https://gateway.pinata.cloud)
 *
 * Output shape: { bodies, allDeals }
 *   - `bodies`   — every UNENCRYPTED deal mapped to the render-dev body shape
 *                  (encrypted deals are DROPPED: mode 3 has no decrypt path).
 *   - `allDeals` — the same mapped bodies, as the raw deal array the render
 *                  action's filterCollection consumes.
 */
import 'dotenv/config';
import { ethers } from 'ethers5';

// ---------------------------------------------------------------------------
// Env / constants
// ---------------------------------------------------------------------------
const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const PUBLICATION_MODULE_ADDRESS = process.env.PUBLICATION_MODULE_ADDRESS || '';
const IPFS_GATEWAY = process.env.IPFS_GATEWAY || 'https://gateway.pinata.cloud';
const BASE_CHAIN_ID = 8453;
const PAGE_SIZE = 100;

// ---------------------------------------------------------------------------
// Module ABI (Base) — INLINED, mirrors module.factory.ts:6-31.
// ---------------------------------------------------------------------------
// Entry tuple returned by getLatest / getDeals.
const ENTRY_COMPONENTS = [
  { name: 'genesis', type: 'bytes32' },
  { name: 'author', type: 'address' },
  { name: 'cid', type: 'string' },
  { name: 'timestamp', type: 'uint256' },
];

const MODULE_ABI = [
  {
    type: 'function',
    name: 'getLatest',
    stateMutability: 'view',
    inputs: [{ name: 'genesis', type: 'bytes32' }],
    outputs: [{ name: '', type: 'tuple', components: ENTRY_COMPONENTS }],
  },
  {
    type: 'function',
    name: 'getDeals',
    stateMutability: 'view',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'tuple[]', components: ENTRY_COMPONENTS }],
  },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface Entry {
  genesis: string;
  author: string;
  cid: string;
  timestamp: number;
}

export interface PullResult {
  bodies: Record<string, unknown>[];
  allDeals: Record<string, unknown>[];
}

/** A tuple as decoded by ethers v5 for getDeals/getLatest. */
type RawEntry = {
  genesis: string;
  author: string;
  cid: string;
  timestamp: unknown;
};

const toEntry = (e: RawEntry): Entry => ({
  genesis: e.genesis,
  author: e.author,
  cid: e.cid,
  timestamp: Number(e.timestamp),
});

// ---------------------------------------------------------------------------
// Adapter: S2SContentItem (IPFS) -> flat S2SBody (what the pipeline expects).
// Mirrors module.factory.ts:78-109.
// ---------------------------------------------------------------------------
export const toBody = (entry: Entry, item: any): Record<string, unknown> => {
  const p = item.public ?? {};
  const base: Record<string, unknown> = {
    id: entry.genesis, // job identity is the genesis
    author: p.author, // did:ethr:0x... — pass through from IPFS
    locale: p.locale,
    parent: p.parent,
    position: p.position,
    postType: p.postType,
    creationDate: String(p.createdAt), // this version's timestamp
    modifiedDate: String(p.createdAt),
    tags: p.tags,
    attributes: p.attributes,
    publication: p.publication,
    base: p.base,
  };

  // NOTE: mode 3 is unencrypted-only. The calling code (pullUnencrypted)
  // drops `encryption === true` items before this runs, so the plain branch
  // is the only one expected here — kept for parity with module.factory.
  if (item.encryption) {
    // content is the ciphertext string; no decrypt path in mode 3.
    return { ...base, encryption: true, content: item.body };
  }

  const parsed = JSON.parse(item.body as string); // { title, slug, content, custom? }
  return {
    ...base,
    encryption: false,
    content: parsed.content,
    title: parsed.title,
    slug: parsed.slug,
    custom: parsed.custom,
  };
};

// ---------------------------------------------------------------------------
// Provider / contract (ethers v5 API)
// ---------------------------------------------------------------------------
function getContract() {
  if (!PUBLICATION_MODULE_ADDRESS) {
    throw new Error(
      'PUBLICATION_MODULE_ADDRESS is not set (set it in the environment or example..env)',
    );
  }
  const provider = new ethers.providers.StaticJsonRpcProvider(BASE_RPC_URL, {
    chainId: BASE_CHAIN_ID,
    name: 'base',
  });
  return new ethers.Contract(PUBLICATION_MODULE_ADDRESS, MODULE_ABI, provider);
}

// ---------------------------------------------------------------------------
// Reads — mirrored from module.factory.ts (evmRead is inlined as a direct
// StaticJsonRpcProvider call; single RPC here instead of a rotation list).
// ---------------------------------------------------------------------------

/** getLatest(genesis) -> the latest Entry for one genesis. */
export const getLatest = async (genesis: string): Promise<Entry> => {
  const contract = getContract();
  const e = (await contract.getLatest(genesis)) as RawEntry;
  return toEntry(e);
};

/** Enumerate all deals for this publication (paginated). Entry.cid is latest. */
export const getDeals = async (pageSize: number = PAGE_SIZE): Promise<Entry[]> => {
  const contract = getContract();
  const out: Entry[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = ((await contract.getDeals(offset, pageSize)) as RawEntry[]) ?? [];
    for (const e of page) out.push(toEntry(e));
    if (page.length < pageSize) break;
  }
  return out;
};

/** Fetch the S2SContentItem JSON for a cid via the plain IPFS gateway. */
export const fetchContentItem = async (cid: string): Promise<any> => {
  const url = `${IPFS_GATEWAY.replace(/\/$/, '')}/ipfs/${cid}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`IPFS fetch ${cid} failed: HTTP ${res.status} ${res.statusText}`);
  }
  return res.json();
};

/**
 * Pull all unencrypted deals and map them to render-dev bodies.
 * Encrypted items are DROPPED. A failed IPFS fetch for one deal logs a warning
 * and skips it (does not abort the whole pull).
 */
export const pullUnencrypted = async (limit?: number): Promise<PullResult> => {
  const allEntries = await getDeals();
  const entries = typeof limit === 'number' && limit >= 0 ? allEntries.slice(0, limit) : allEntries;

  const bodies: Record<string, unknown>[] = [];
  for (const entry of entries) {
    try {
      const item = await fetchContentItem(entry.cid);
      if (item?.encryption === true) {
        // mode 3 is unencrypted-only — drop encrypted deals (no decrypt path).
        console.log(`  contract-pull: skip ${entry.genesis.slice(0, 10)}… (encrypted)`);
        continue;
      }
      bodies.push(toBody(entry, item));
    } catch (err) {
      console.warn(
        `  contract-pull: skip ${entry.genesis.slice(0, 10)}… (${entry.cid}): ${
          (err as Error).message
        }`,
      );
    }
  }

  return { bodies, allDeals: bodies };
};

// ---------------------------------------------------------------------------
// CLI — `tsx scripts/contract-pull.ts [--limit N]` prints the pull result.
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const limitArg = argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined;

  console.log(`contract-pull: rpc=${BASE_RPC_URL}`);
  console.log(`contract-pull: module=${PUBLICATION_MODULE_ADDRESS || '(unset)'}`);
  console.log(`contract-pull: gateway=${IPFS_GATEWAY}`);

  const result = await pullUnencrypted(limit);
  console.log(`contract-pull: ${result.allDeals.length} unencrypted deal(s)\n`);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

// Run as CLI only when invoked directly (tsx scripts/contract-pull.ts).
if (require.main === module) {
  main().catch((err) => {
    console.error('contract-pull: fatal:', err);
    process.exit(1);
  });
}
