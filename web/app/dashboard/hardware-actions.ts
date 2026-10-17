'use server';
import { z } from 'zod';
import { redirect, unstable_rethrow } from 'next/navigation';
import { auth0 } from '@/lib/auth0/web';
import { db } from '@/lib/db';
import { HttpError } from '@/lib/http';
import { changeHardwareCredential, contactPhone, hardwareName, registerHardware, resolveHardwareRequest, saveAssistanceContact } from '@/lib/hardware';

export type HardwareActionState = { message: string; deviceId?: string; token?: string; changed?: number };
const command = z.discriminatedUnion('action', [
  z.object({ action: z.literal('register'), circleId: z.uuid(), name: hardwareName }),
  z.object({ action: z.enum(['rotate', 'revoke']), circleId: z.uuid(), deviceId: z.uuid() }),
  z.object({ action: z.literal('resolve'), circleId: z.uuid(), requestId: z.uuid() }),
  z.object({ action: z.literal('contact'), circleId: z.uuid(), phone: contactPhone }),
]);

export async function hardwareAction(_previous: HardwareActionState, form: FormData): Promise<HardwareActionState> {
  const session = await auth0.getSession();
  if (!session?.user.sub) redirect('/auth/login?returnTo=/dashboard');
  const parsed = command.safeParse({
    action: form.get('action'), circleId: form.get('circleId'), name: form.get('name'),
    deviceId: form.get('deviceId'), requestId: form.get('requestId'), phone: String(form.get('phone') ?? '').trim() || null,
  });
  if (!parsed.success) return { message: 'Check the name, phone number, or selected button and try again.' };
  const input = parsed.data;
  try {
    switch (input.action) {
      case 'register': return { message: 'Button registered. Copy its credential now; it will not be shown again.',
        ...await registerHardware(db(), session.user.sub, input.circleId, input.name), changed: Date.now() };
      case 'rotate': {
        const result = await changeHardwareCredential(db(), session.user.sub, input.circleId, input.deviceId, 'rotate');
        return { message: 'Old credential replaced. Update the button configuration before using it.', deviceId: result.deviceId, token: result.token!, changed: Date.now() };
      }
      case 'revoke':
        await changeHardwareCredential(db(), session.user.sub, input.circleId, input.deviceId, 'revoke');
        return { message: 'Button revoked. It can no longer send requests.', changed: Date.now() };
      case 'resolve':
        await resolveHardwareRequest(db(), session.user.sub, input.circleId, input.requestId);
        return { message: 'Request marked resolved for your family.', changed: Date.now() };
      case 'contact':
        await saveAssistanceContact(db(), session.user.sub, input.circleId, input.phone);
        return { message: 'Contact number saved.', changed: Date.now() };
    }
  } catch (error) {
    unstable_rethrow(error);
    return { message: error instanceof HttpError ? error.message : 'Could not save this change. Please try again.' };
  }
}
