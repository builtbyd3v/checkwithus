export type HardwareRequest = {
  id: string; deviceId: string | null; deviceName: string; protectedName: string;
  pressedAt: string | null; receivedAt: string; resolvedAt: string | null;
  resolvedBy: string | null; status: 'open' | 'resolved'; notifiedMembers: number;
};
export type HardwareDashboard = {
  requests: HardwareRequest[]; openCount: number; contactPhone: string | null;
  canManage: boolean;
  devices: { id: string; name: string; lastSeenAt: string | null; revokedAt: string | null }[];
};
