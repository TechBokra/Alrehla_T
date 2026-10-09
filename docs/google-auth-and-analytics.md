# Google sign-in and GA4

## Google sign-in

The sign-in page uses the existing `@supabase/ssr` browser client with Google's
identity provider. It does not request Gmail inbox access. Supabase's PKCE code
returns to `/auth/callback`, which exchanges it for a cookie-based session. The
existing database trigger creates new users as customers; Google login does not
assign administrative permissions.

The callback URL is built from the current browser origin, not the production
site URL. The safe `next` parameter is preserved; without it, `/dashboard` routes
the signed-in user according to their existing role.

External configuration (credentials are never placed in frontend code):

1. Enable Google in Supabase Authentication → Providers and save the Google
   OAuth client ID and secret there.
2. In Google Cloud, the authorized redirect URI is the **Supabase** callback:
   `https://<project-ref>.supabase.co/auth/v1/callback`.
3. In Supabase Authentication → URL Configuration, allow the **application**
   callbacks on every intended origin, including query parameters. For example:
   `http://localhost:3000/auth/callback**`,
   `https://alrehlat.vercel.app/auth/callback**`, and your actual custom domain.
   Restrict production patterns to the callback path; do not allow arbitrary
   external domains. An unallowlisted redirect can fall back to the Site URL.
4. Test a real Google account on localhost and production, including a protected
   `next` destination and cancellation. Credentials/provider activation and
   Google account consent cannot be verified by unit tests.

## GA4: G-953D3NL6LV

`GoogleAnalytics` is a small client island in the server root layout. The Google
script loads after hydration. Public initial loads and pathname changes produce
manual `page_view` events; queries and fragments are excluded. Dashboard,
account, recovery and auth callback routes are excluded. Development and localhost
do not send events. No user IDs, email addresses, form values or OAuth codes are
explicitly added to events. Google advertising signals are disabled.

**Required GA4 setting before launch:** In Admin → Data streams → your web
stream → Enhanced measurement → Page views → Advanced settings, turn off
**Page changes based on browser history events**. The integration disables
config-generated views with `send_page_view: false`, but Google's independent
Enhanced Measurement history listener must also be disabled to prevent duplicate
views and unsanitized URLs. Review other automatic measurement features against
your privacy/consent requirements before enabling them. This integration does not
introduce a consent-management platform.

After deployment, verify Realtime/DebugView while navigating public pages; confirm
one event per pathname change and no private-page events. This is page-view
tracking, not purchase/conversion instrumentation. Client-side navigations that
only change a query parameter intentionally do not create another page view.

References:
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/redirect-urls
- https://developers.google.com/analytics/devguides/collection/ga4/views
