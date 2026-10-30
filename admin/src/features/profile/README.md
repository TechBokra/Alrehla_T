# Profile and account settings

`/profile` uses the existing AdminLayout, shadcn Cards/Tabs/Fields, AvatarUpload and `useAppForm` fields. It is linked from the user menu. No separate UI kit is introduced.

The named Refine `account` provider reads the signed-in user's own profile and allows only `full_name` and `avatar_url` updates. Email, identities and role are read-only. Existing Supabase RLS remains authoritative. Avatar upload uses the existing signed media function and its content-management permission checks, and is associated with the profile only after Save.

Google linking uses `linkIdentity`, not a new sign-in, and validates that `/auth/link` returns to the initiating user. Existing Google sign-in stays unchanged. Password changes verify the old password in an isolated, nonpersistent auth client before updating the active account. Google-only users can set a password through the email recovery flow.

## Supabase deployment prerequisites

- Enable the Google provider and Manual Linking in Authentication settings.
- Add exact allowed redirect URLs for each admin origin: `/auth/callback` (existing sign-in), `/auth/link` and `/reset-password`.
- Ensure Supabase recovery email delivery/SMTP and the recovery template are configured for this app's redirect. Never point the recovery link to the Google callback.
- Recovery uses PKCE; open the email link in the browser that requested it. Missing, expired or wrong-flow codes show a new-link action. Successful password reset signs out locally.
- The UI requires at least 12 password characters; Supabase may enforce additional requirements. A server reauthentication requirement can be completed through the emailed recovery flow.

No hosted auth settings, real identities or passwords are changed by installing this page. Gmail mailbox access is not requested.

## Verification

Run `node tests/profile-auth.test.mjs` from `admin` for ownership, payload allowlist, password verification and callback/recovery checks with mocked Auth responses. Run `pnpm typecheck` and `pnpm build` for integration checks. Live Google linking and recovery delivery require configured providers, redirects and the account owner completing the flow.
