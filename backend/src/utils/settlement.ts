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
 */
export function calculateSettlement(players: Player[]): SettlementResult {
  const initialResults = players.map((p) => ({
    displayName: p.displayName,
    netResult: p.cashOut - (p.buyIn + p.rebuyTotal),
  }));

  const totalNet = initialResults.reduce((sum, p) => sum + p.netResult, 0);
  if (Math.abs(totalNet) > 0.01) {
    throw new Error(
      `The sum of all net results must be zero. Current sum: ${totalNet}`
    );
  }

  // Clone into mutable working arrays
  const creditors = initialResults
    .filter((p) => p.netResult > 0)
    .map((p) => ({ ...p }))
    .sort((a, b) => b.netResult - a.netResult);

  const debtors = initialResults
    .filter((p) => p.netResult < 0)
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
