# Supabase + Resend password recovery

The app already targets the active Alrehlat Supabase project. A read-only check
of `personalized_products` returned HTTP 200. No database data was migrated or modified.

## Flow

1. `/forgot-password` calls `requestPasswordReset` with a validated email.
2. Supabase Auth generates the single-use recovery link and delivers the email
   through the configured Resend SMTP server. No Resend API key belongs in the browser.
3. `/auth/callback` exchanges the PKCE code and checks verified JWT `amr` recovery claims.
4. `/reset-password` repeats the recovery-session check before showing the form.
5. `resetRecoveredPassword` verifies the user, the signed recovery proof, minimum
   password length and matching confirmation, then updates the password.
6. Refresh sessions are revoked on success; the server redirects to sign-in with a
   confirmation message, and the user signs in with the new password.
   Already issued access JWTs remain valid until their normal expiry.

Recovery proof is accepted for 15 minutes after recovery authentication. A normal
signed-in session, URL parameter or editable user metadata cannot authorize this action.
Admin service-role credentials are not required for customer recovery.
The separate administrator-created first-login flow remains unchanged.

## Supabase configuration

Keep the Resend SMTP configuration in Supabase Auth. Disable click tracking for
authentication email links. The email template should preserve `{{ .ConfirmationURL }}`.

Allow the exact callback origins used by the application in Auth → URL Configuration:

- `https://www.alrehla.org/auth/callback**`
- `https://alrehla.org/auth/callback**` if this origin is used
- `http://localhost:3000/auth/callback**`
- `http://127.0.0.1:3000/auth/callback**` when testing with this origin

Keep production Site URL set to the canonical HTTPS site. Allowlisted local
callback URLs prevent Supabase falling back to the production Site URL.
PKCE links should be opened in the browser where the reset was requested.

## Error and resend behavior

The request response never confirms whether an account exists. Email delivery
errors are logged without addresses, tokens or raw credentials. Supabase enforces
server-side rate limits; the 60-second resend countdown is only a UI convenience.
An expired or non-recovery session offers a link to request a fresh email.
Password-validation errors appear beneath the corresponding input.

Live verification sends an email only. The account owner must personally open
the link and enter a new password to complete the credential-changing test.
