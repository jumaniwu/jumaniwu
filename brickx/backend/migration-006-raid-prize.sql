-- migration-006-raid-prize.sql
-- Persistent storage for the community raid prize: each row is one member's
-- participation in one raid (a tap on "I raided"), optionally with the link to
-- their own X post as proof. The Telegram raid bot reads/writes this table.
-- Safe to re-run.

create table if not exists raid_participants (
  id                bigserial primary key,
  chat_id           bigint not null,           -- Telegram group id
  message_id        bigint not null,           -- the raid message id
  telegram_user_id  bigint not null,           -- the raider
  telegram_name     text,
  telegram_username text,
  raid_url          text,                      -- the X post being raided
  post_url          text,                      -- the raider's own X post (proof), nullable
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (chat_id, message_id, telegram_user_id)   -- one participation per raid per user
);

create index if not exists idx_raid_participants_user on raid_participants (telegram_user_id);
create index if not exists idx_raid_participants_post on raid_participants (post_url);
