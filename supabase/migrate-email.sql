-- Email threading fields
alter table briefs add column if not exists gmail_message_id text;
alter table negotiations add column if not exists gmail_thread_id text;
alter table negotiations add column if not exists last_message_id text;

-- Index for deduplication on inbound poll
create unique index if not exists briefs_gmail_message_id_idx on briefs (gmail_message_id) where gmail_message_id is not null;
create index if not exists negotiations_gmail_thread_id_idx on negotiations (gmail_thread_id) where gmail_thread_id is not null;
