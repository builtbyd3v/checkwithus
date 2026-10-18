'use client';

import { useState } from 'react';
import type { FormState } from '../../actions';
import { DashboardView } from '../../view';
import { dashboardFixture } from '../fixtures';

/** The whole dashboard on synthetic data. Approve and Deny only change this page; other forms are never submitted here. */
export function FullPreview({ nowIso, expiresAt }: { nowIso: string; expiresAt: string }) {
  const [fixture] = useState(() => dashboardFixture(nowIso, expiresAt));
  const [decided, setDecided] = useState<'approved' | 'denied' | null>(null);
  async function decide(_state: FormState, form: FormData): Promise<FormState> {
    const denied = form.get('decision') === 'deny';
    setDecided(denied ? 'denied' : 'approved');
    return { message: denied ? 'Denied. The payment will not go through.' : 'Approved. The payment is on its way.', decided: true };
  }
  const held = decided ? [] : fixture.held;
  const recent = fixture.recent.map((payment) => decided && payment.id === fixture.held[0]!.id
    ? { ...payment, status: decided, decidedAt: nowIso, decidedByName: 'you' } : payment);
  return <DashboardView {...fixture} held={held} recent={recent} decide={decide} />;
}
