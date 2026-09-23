-- Localized titles and bodies for guild news. Officers write one source locale,
-- then fill the others with the translate-guild-post Edge Function (MyMemory).

alter table public.guild_posts
  add column if not exists source_locale text not null default 'en'
    check (source_locale in ('en', 'de', 'fr'));

alter table public.guild_posts
  add column if not exists title_i18n jsonb not null default '{}'::jsonb;

alter table public.guild_posts
  add column if not exists body_i18n jsonb not null default '{}'::jsonb;

comment on column public.guild_posts.source_locale is
  'Locale the officer wrote in; title and body are that source text.';
comment on column public.guild_posts.title_i18n is
  'Title per locale (en/de/fr). Empty object means fall back to title.';
comment on column public.guild_posts.body_i18n is
  'Body HTML per locale (en/de/fr). Empty object means fall back to body.';
