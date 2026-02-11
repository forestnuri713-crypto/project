export type BulkCancelMode = 'A_PG_REFUND' | 'B_LEDGER_ONLY';

export function getRefundMode(
  paymentsServicePresent: boolean,
): BulkCancelMode {
  return paymentsServicePresent ? 'A_PG_REFUND' : 'B_LEDGER_ONLY';
}
