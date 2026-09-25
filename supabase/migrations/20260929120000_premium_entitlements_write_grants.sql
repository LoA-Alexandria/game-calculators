-- Admin claim approval and lifetime grants upsert into premium_entitlements.
-- The create migration only granted SELECT, so writes failed with
-- "permission denied for table premium_entitlements" before RLS could run.
-- RLS still limits INSERT/UPDATE/DELETE to admins.

grant select, insert, update, delete on table public.premium_entitlements to authenticated;
