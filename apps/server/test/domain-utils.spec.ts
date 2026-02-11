import {
  isTerminalReservationStatus,
  shouldSkipBulkCancel,
  canWriteReview,
} from '../src/domain/reservation.util';
import { getRefundMode } from '../src/domain/refund.util';

describe('reservation.util', () => {
  describe('isTerminalReservationStatus', () => {
    it('returns true for CANCELLED', () => {
      expect(isTerminalReservationStatus('CANCELLED')).toBe(true);
    });

    it('returns true for COMPLETED', () => {
      expect(isTerminalReservationStatus('COMPLETED')).toBe(true);
    });

    it('returns false for PENDING', () => {
      expect(isTerminalReservationStatus('PENDING')).toBe(false);
    });

    it('returns false for CONFIRMED', () => {
      expect(isTerminalReservationStatus('CONFIRMED')).toBe(false);
    });
  });

  describe('shouldSkipBulkCancel', () => {
    it('returns true for CANCELLED reservation', () => {
      expect(shouldSkipBulkCancel({ status: 'CANCELLED' })).toBe(true);
    });

    it('returns true for COMPLETED reservation', () => {
      expect(shouldSkipBulkCancel({ status: 'COMPLETED' })).toBe(true);
    });

    it('returns false for PENDING reservation', () => {
      expect(shouldSkipBulkCancel({ status: 'PENDING' })).toBe(false);
    });

    it('returns false for CONFIRMED reservation', () => {
      expect(shouldSkipBulkCancel({ status: 'CONFIRMED' })).toBe(false);
    });
  });

  describe('canWriteReview', () => {
    it('returns true when reservation is COMPLETED', () => {
      expect(canWriteReview({ status: 'COMPLETED' }, null)).toBe(true);
    });

    it('returns true when attendance is ATTENDED', () => {
      expect(
        canWriteReview({ status: 'CONFIRMED' }, { status: 'ATTENDED' }),
      ).toBe(true);
    });

    it('returns false when neither COMPLETED nor ATTENDED', () => {
      expect(
        canWriteReview({ status: 'CONFIRMED' }, { status: 'ABSENT' }),
      ).toBe(false);
    });

    it('returns false when reservation is PENDING with no attendance', () => {
      expect(canWriteReview({ status: 'PENDING' }, null)).toBe(false);
    });
  });
});

describe('refund.util', () => {
  describe('getRefundMode', () => {
    it('returns A_PG_REFUND when payments service present', () => {
      expect(getRefundMode(true)).toBe('A_PG_REFUND');
    });

    it('returns B_LEDGER_ONLY when payments service not present', () => {
      expect(getRefundMode(false)).toBe('B_LEDGER_ONLY');
    });
  });
});
