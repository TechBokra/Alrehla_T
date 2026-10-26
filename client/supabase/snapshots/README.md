# Supabase snapshots

This folder contains environment-specific, read-only database references.

- `staging/` is the ahmed project. Its generated types are also copied to `admin/src/types/supabase.ts`.
- `production/` is the techbokra project. Its generated types remain a separate reference.
- Each manifest records the project reference, capture time, generated-type checksum, applied migration history, public object counts, and extension inventory.
- `schema-comparison.md` contains the pre-rollout object-level comparison; its detailed differences need refreshing against complete schema dumps.
- Complete `schema.sql` dumps are still pending: the CLI in this execution environment has no access token and its Docker daemon is unavailable. No empty or partial SQL snapshot is presented as complete.
- The existing `client/supabase/schema.sql` was not changed.

Staging now records all 73 repository migrations; production remains at 46. The staging migrations were applied by the user through the Supabase CLI. No production migration was applied, no database was reset, and no customer rows were exported.

