# Supabase environment snapshot comparison

Original catalog comparison captured on 2026-10-21 20:47:55 UTC. After that capture, staging received the remaining repository migrations. As of 2026-10-21 21:28:30 UTC, staging records 73 migrations and production records 46. The updated counts below reflect that later state, but the object-level difference lists remain from the original capture and must be regenerated before they are treated as current. Complete `schema.sql` dumps are still pending the local CLI prerequisites listed below.

## Projects and current schema counts

| Environment | Account | Project | Tables | Table columns | Enums | Functions | Indexes | Policies | Triggers | Views | Applied migrations |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Staging | ahmed | `nznfawbcgfwpftbiqima` | 91 | 983 | 18 | 206 | 213 | 226 | 68 | 3 | 73 |
| Production | techbokra | `ruuejyignvuhouhoiiqi` | 91 | 955 | 18 | 206 | 213 | 226 | 68 | 3 | 46 |

Production also has 3 views, whose projected columns are represented by their view definitions rather than counted in the table-column total. Extension dependencies are recorded in each environment manifest.

## Schema differences

Fingerprint comparison of public tables, columns, constraints, enums, functions, indexes, policies, triggers, and views found:

- Production-only: `{"column":322,"constraint":188,"function":121,"index":83,"policy":61,"table":29,"trigger":22,"view":3}`
- Staging-only: `{"constraint":1,"policy":2}`
- Shared objects with changed definitions: `{"constraint":9,"enum":1,"function":70,"index":2,"table":1}`

Production-only tables:

- `ad_clicks`
- `ads`
- `aqlam_challenges`
- `aqlam_comments`
- `aqlam_config`
- `aqlam_guardian_requests`
- `aqlam_guardian_settings`
- `aqlam_post_edits`
- `aqlam_posts`
- `aqlam_reactions`
- `aqlam_reports`
- `aqlam_sanctions`
- `aqlam_writer_profiles`
- `countries`
- `governorates`
- `join_request_messages`
- `payment_events`
- `payouts`
- `price_promotions`
- `story_cost_entries`
- `story_pages`
- `story_projects`
- `story_versions`
- `studio_product_routes`
- `task_edges`
- `task_steps`
- `work_task_events`
- `work_task_sweeps`
- `writing_dialects`

Production-only views:

- `aqlam_public_comments`
- `aqlam_public_posts`
- `aqlam_public_writers`

Staging-only objects: `constraint: assignment_rules.assignment_rules_stage`, `policy: public.blog_posts.Blog posts are viewable by everyone`, `policy: public.instructor_certifications.Instructor views own certifica`.

Production-only commerce columns:

- `order_items.list_price_snapshot`
- `orders.country_code`
- `orders.paid_at`
- `orders.payment_intent_id`
- `orders.payment_provider`
- `orders.payment_session_id`
- `personalized_products.writing_styles`

Production has 3241 expanded schema/table/function/sequence/default-privilege ACL entries; staging has 2268. Grant fingerprints show 1064 production-only ACL entries and 91 staging-only entries, including 346 production-only function grants and 706 production-only relation grants. These are privilege catalog records, not an instruction to copy permissions across environments.

The production type export includes `admin_has_permission`; staging does not. Keep admin authorization dependent on the target environment's available server-side checks until the schemas are deliberately reconciled.



The two databases are not interchangeable snapshots. Use staging types for the admin prototype and keep production types separate. Do not infer that local migrations can be pushed in bulk from these counts.

## Repository migration history

- Repository contains 73 migration files with 71 unique version IDs.
- Staging has 28 applied migrations; all applied versions have a matching local file. 45 local migration files are not applied in staging.
- Production has 46 applied migrations; 42 versions have local files and 4 applied versions do not. 31 local migration files are not applied in production.
- Production applied migrations missing from the repository by version:
  - `20261015071912_blog_seo_description`
  - `20261015072004_testimonial_section_line`
  - `20261018120919_staff_accounts_do_not_buy`
  - `20261018124248_story_preview_and_client_approval`
- Production migration names that exist locally under a different version:
  - `staff_accounts_do_not_buy`: production `20261018120919`, repository `20261018120000`
  - `story_preview_and_client_approval`: production `20261018124248`, repository `20261018150000`
- Duplicate version IDs in the local migration directory:
  - `20261016120000`: `20261016120000_aqlam_profile_edit.sql`, `20261016120000_delete_instructor_text_ids.sql`
  - `20261017000000`: `20261017000000_aqlam_comment_pen_name.sql`, `20261017000000_provider_formula_and_transfer.sql`

This report identifies history drift; it does not repair or apply migrations. Reconcile version conflicts and production-only history before using migration push workflows.

## Schema dump status

The installed Supabase CLI is version 2.116.0. Its read-only `db dump` path runs `pg_dump` in Docker. At capture time, `supabase projects list` reported that no access token is configured, the Docker daemon socket was unavailable, and the host has no `pg_dump` executable. Therefore no complete `schema.sql` was written. The existing [dashboard-generated schema](../schema.sql) was left untouched.

To complete the SQL snapshots, start Docker Desktop and authenticate the Supabase CLI, then run `db dump --schema public` for each project reference. Verify object counts and checksums before treating either dump as complete. No database changes were made.

