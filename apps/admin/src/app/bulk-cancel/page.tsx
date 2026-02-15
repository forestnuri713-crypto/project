import { Suspense } from 'react';
import BulkCancelClient from './BulkCancelClient';

export default function BulkCancelPage() {
  return (
    <Suspense fallback={null}>
      <BulkCancelClient />
    </Suspense>
  );
}
