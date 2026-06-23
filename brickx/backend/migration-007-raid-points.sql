-- migration-007-raid-points.sql
-- Raid prize scoring by POINTS: each unique X post link a member submits is worth
-- points (default 10). A given post link can only count ONCE across the whole
-- contest (no duplicates / no farming). Run after migration-006. Safe to re-run.

-- Points per submitted post (the bot also reads RAID_POINTS_PER_POST; this is the
-- stored value per row).
alter table raid_participants add column if not exists points integer not null default 10;

-- A post link can only be counted once, by whoever submits it first.
create unique index if not exists uniq_raid_post_url
  on raid_participants (post_url) where post_url is not null;

-- Allow a member to submit MULTIPLE different posts (drop the one-row-per-raid limit
-- from migration-006). Constraint name is Postgres's default for that unique key.
alter table raid_participants
  drop constraint if exists raid_participants_chat_id_message_id_telegram_user_id_key;
