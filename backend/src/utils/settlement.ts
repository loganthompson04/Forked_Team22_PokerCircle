import { Player } from '../types/session';

export interface Transaction {
  from: string;
  to: string;
  amount: number;
}

export interface SettlementResult {
  playerResults: { displayName: string; netResult: number }[];
  transactions: Transaction[];
}

/**
 * Calculates the settlement plan for a game session using a greedy minimum
 * cash-flow approach.
 *
 * netResult = cashOut - (buyIn + rebuyTotal)
 *
 * Positive  → player won money
 * Negative  → player lost money
 *
 * The algorithm pairs the largest creditor with the largest debtor on each
 * iteration, producing the minimum number of transactions required to settle
 * all balances.
 *
 * NOTE: We no longer throw if the sum is non-zero. In practice, rounding or
 * partially-entered cash-outs can cause small imbalances. We proceed with
 * settlement as long as there are creditors and debtors, and the host can
 * correct any discrepancy manually.
 */
export function calculateSettlement(players: Player[]): SettlementResult {
  // Filter to players who have any financial data entered
  const activePlayers = players.filter(
    (p) => p.buyIn > 0 || p.rebuyTotal > 0 || p.cashOut > 0
  );

  // If no one has entered finances yet, return everyone with net=0
  const initialResults = players.map((p) => ({
    displayName: p.displayName ?? 'Unknown',
    netResult: p.cashOut - (p.buyIn + p.rebuyTotal),
  }));

  if (activePlayers.length === 0) {
    return { playerResults: initialResults, transactions: [] };
  }

  const totalNet = initialResults.reduce((sum, p) => sum + p.netResult, 0);

  // Log warning but don't throw — small imbalances are common during live games
  if (Math.abs(totalNet) > 1) {
    console.warn(
      `Settlement: net sum is ${totalNet} (non-zero). ` +
      `Some players may not have entered their cash-out yet.`
    );
  }

  // Clone into mutable working arrays
  const creditors = initialResults
    .filter((p) => p.netResult > 0.005)
    .map((p) => ({ ...p }))
    .sort((a, b) => b.netResult - a.netResult);

  const debtors = initialResults
    .filter((p) => p.netResult < -0.005)
    .map((p) => ({ ...p, netResult: -p.netResult })) // make positive for arithmetic
    .sort((a, b) => b.netResult - a.netResult);

  const transactions: Transaction[] = [];
  let i = 0; // creditor pointer
  let j = 0; // debtor pointer

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i]!;
    const debtor = debtors[j]!;
    const amount = Math.min(creditor.netResult, debtor.netResult);

    if (amount > 0.01) {
      transactions.push({
        from: debtor.displayName,
        to: creditor.displayName,
        amount: Number(amount.toFixed(2)),
      });
    }

    creditor.netResult -= amount;
    debtor.netResult -= amount;

    if (creditor.netResult <= 0.01) i++;
    if (debtor.netResult <= 0.01) j++;
  }

  return {
    playerResults: initialResults,
    transactions,
  };
}