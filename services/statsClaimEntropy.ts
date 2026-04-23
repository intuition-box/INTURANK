import { formatEther } from 'viem';

/**
 * Inputs for the Stats page **Claim entropy** tab (`AGENTS_CONTROVERSY`):
 * vault-level fields from `getAllAgents` (TRUST/wei strings from the indexer).
 */
export type ClaimEntropyVaultInput = {
  totalAssets: string;
  totalShares: string;
  positionCount: number;
  /** Indexer `current_share_price` (wei). When present and positive, used as TRUST per share. */
  currentSharePrice?: string;
};

/**
 * Parse vault wei to a non-negative float (TRUST), or 0 on invalid input.
 * Avoids a single bad row breaking the whole leaderboard.
 */
function trFromWei(wei: string | undefined): number {
  try {
    if (wei == null || wei === '') return 0;
    const n = parseFloat(formatEther(BigInt(wei)));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * **Claim entropy** score: IntuRank client heuristic for discovery (not a literal on chain “entropy” field).
 * Docs: Leaderboards (Stats), section “Claim entropy in plain English”.
 *
 * For each vault/term (atom or claim row from the indexer), we combine:
 * - **Depth:** `10 * log10(assets_TRUST + 1)` (larger pools score higher, diminishing returns).
 * - **Share price:** `2 * price_TRUST` where `price` is the indexer current share price when positive;
 *   otherwise `assets / shares` if `shares > 0`, else `1`.
 * - **Position density:** `5 * sqrt(positionCount + 1)` (more open positions nudge the score up).
 *
 * The UI shows the sum (e.g. `Score: 1081.19`). Treat the result as a **unitless rank key**, not a TRUST amount.
 */
export function computeClaimEntropyScore(v: ClaimEntropyVaultInput): number {
  const assets = trFromWei(v.totalAssets);
  const shares = trFromWei(v.totalShares);
  const count = Math.max(0, Math.floor(Number(v.positionCount) || 0));

  const apiPrice = trFromWei(v.currentSharePrice);
  let price: number;
  if (apiPrice > 0) {
    price = apiPrice;
  } else if (shares > 0) {
    price = assets / shares;
  } else {
    price = 1;
  }
  if (!Number.isFinite(price) || price <= 0) price = 1;

  const interactionDensity = Math.sqrt(count + 1);
  const depth = Math.log10(assets + 1) * 10;
  return depth + price * 2 + interactionDensity * 5;
}
