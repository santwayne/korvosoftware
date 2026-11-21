import { Platform } from 'react-native';
import { apiService } from '../services/api';

/**
 * Loopdesk opens Korvo for a bundle client's owner without a password:
 * Loopdesk sends the browser to https://<korvo>/sso#token=…&next=…
 * We swap the one-time token for a Korvo session (POST /hub/loopdesk/sso)
 * before the app reads its saved session, then clean the address bar.
 * Web only; the phone app keeps the normal login.
 */
export async function consumeLoopdeskSso(): Promise<string | null> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const token = params.get('token');
  if (!token) return null;
  // The token works once; never leave it in the address bar or history.
  window.history.replaceState(null, '', '/');
  try {
    const ok = await apiService.loginWithLoopdesk(token);
    return ok ? null : 'Could not open Korvo from Loopdesk. Please sign in.';
  } catch (e: any) {
    return e?.response?.data?.message || 'Could not open Korvo from Loopdesk. Please sign in.';
  }
}
