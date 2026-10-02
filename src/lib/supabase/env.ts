export const PLACEHOLDER_SUPABASE_URL = 'https://placeholder-alrehla.supabase.co';
export const PLACEHOLDER_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return Boolean(url && url.startsWith('http') && key);
}

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (url && url.startsWith('http')) {
    return url;
  }
  return PLACEHOLDER_SUPABASE_URL;
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (key) {
    return key;
  }
  return PLACEHOLDER_SUPABASE_ANON_KEY;
}

/**
 * When Supabase environment variables are missing or unconfigured,
 * mock fetch ensures prerendering and static site builds succeed gracefully
 * with empty data / default content.
 */
export function getSupabaseFetch(): typeof fetch | undefined {
  if (isSupabaseConfigured()) {
    return undefined;
  }

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    // Supabase Auth API
    if (urlStr.includes('/auth/v1/')) {
      return new Response(JSON.stringify({ user: null, session: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // PostgREST REST API
    const headers = init?.headers ? new Headers(init.headers) : new Headers();
    const accept = headers.get('accept') || '';

    // When single object is requested (.single()), return 406 so PostgREST returns { data: null, error }
    if (accept.includes('application/vnd.pgrst.object+json')) {
      return new Response(
        JSON.stringify({
          code: 'PGRST116',
          details: 'The result contains 0 rows',
          message: 'JSON object requested, multiple (or no) rows returned',
        }),
        {
          status: 406,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify([]), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Range': '0-0/0',
      },
    });
  };
}
