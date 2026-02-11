export function isTerminalReservationStatus(status: string): boolean {
  return status === 'CANCELLED' || status === 'COMPLETED';
}

export function shouldSkipBulkCancel(reservation: { status: string }): boolean {
  return reservation.status === 'CANCELLED' || reservation.status === 'COMPLETED';
}

export function canWriteReview(
  reservation: { status: string },
  attendance: { status: string } | null,
): boolean {
  return reservation.status === 'COMPLETED' || attendance?.status === 'ATTENDED';
}
