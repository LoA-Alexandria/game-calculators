-- Applicants may leave a short note so the master knows who they are.

alter table public.guild_memberships
  add column if not exists request_note text not null default ''
  constraint guild_memberships_request_note_len check (char_length(request_note) <= 280);

comment on column public.guild_memberships.request_note is
  'Optional note from the applicant (who they are in-game, Discord nick, etc.).';
