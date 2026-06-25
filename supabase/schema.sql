create extension if not exists vector;

create table beats (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  audio_url       text,
  bpm             int,
  music_key       text,
  mood_tags       text[],
  genre           text,
  reference_artists text[],
  embedding       vector(512),
  license_tiers   jsonb,
  status          text default 'available'
);
create index if not exists beats_embedding_idx on beats using ivfflat (embedding vector_cosine_ops);

create table briefs (
  id               uuid primary key default gen_random_uuid(),
  source           text,
  from_contact     text,
  raw_text         text,
  caption          text,
  parsed_attributes jsonb,
  matched_beat_ids uuid[],
  status           text default 'new',
  created_at       timestamptz default now()
);

create table negotiations (
  id            uuid primary key default gen_random_uuid(),
  counterparty  text,
  record_title  text,
  thread        jsonb default '[]',
  their_terms   jsonb,
  our_position  jsonb,
  status        text default 'open',
  needs_human   boolean default false,
  created_at    timestamptz default now()
);

create table drafts (
  id            uuid primary key default gen_random_uuid(),
  short_code    text unique,
  pillar        text,
  related_id    uuid,
  channel       text default 'email',
  to_address    text,
  subject       text,
  body          text,
  payment_link  text,
  reasoning     text,
  status        text default 'pending_approval',
  created_at    timestamptz default now()
);

create table actions (
  id                uuid primary key default gen_random_uuid(),
  ts                timestamptz default now(),
  pillar            text,
  trigger           text,
  action_taken      text,
  channel           text,
  is_autonomous     boolean default true,
  draft_short_code  text
);

create table sales (
  id              uuid primary key default gen_random_uuid(),
  beat_id         uuid references beats(id),
  tier            text,
  paypal_order_id text,
  amount          numeric,
  status          text default 'created',
  created_at      timestamptz default now()
);

create table contacts (
  id        uuid primary key default gen_random_uuid(),
  name      text,
  role      text,
  email     text,
  whatsapp  text,
  notes     text
);

create table seen_messages (
  message_id text primary key,
  seen_at    timestamptz default now()
);

create index if not exists actions_ts_idx on actions (ts desc);
create index if not exists drafts_status_idx on drafts (status);

alter publication supabase_realtime add table actions;
alter publication supabase_realtime add table drafts;
alter publication supabase_realtime add table briefs;

create or replace function match_beats(
  query_embedding vector(512),
  bpm_min int default null,
  bpm_max int default null,
  key_filter text default null,
  match_limit int default 3
)
returns table (
  id uuid,
  title text,
  bpm int,
  music_key text,
  mood_tags text[],
  license_tiers jsonb,
  score float
)
language sql stable
as $$
  select
    b.id,
    b.title,
    b.bpm,
    b.music_key,
    b.mood_tags,
    b.license_tiers,
    1 - (b.embedding <=> query_embedding) as score
  from beats b
  where b.status = 'available'
    and b.embedding is not null
    and (bpm_min is null or b.bpm between bpm_min - 6 and coalesce(bpm_max, bpm_min) + 6)
    and (key_filter is null or b.music_key ilike '%' || key_filter || '%')
  order by b.embedding <=> query_embedding
  limit match_limit;
$$;
