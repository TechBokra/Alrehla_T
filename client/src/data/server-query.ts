import 'server-only';
import type { QueryResult } from './query-result';

/** Normalize read failures once; never send database/provider details to the UI. */
export async function readServerQuery<T>(
  load: () => Promise<T>,
  message: string,
): Promise<QueryResult<T, 'LOAD_FAILED'>> {
  try {
    return { success: true, data: await load() };
  } catch (err) {
    console.error('Server page data query failed:', err);
    return { success: false, error: { code: 'LOAD_FAILED', message } };
  }
}
