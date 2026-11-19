-- =====================================================================
-- Instagram Web: Supabase schema
-- Run this whole file once in: Supabase Dashboard > SQL Editor > New query
-- Safe to read top to bottom; each section is explained.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------

-- One profile per auth user (auth.users is managed by Supabase Auth).
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null unique check (username ~ '^[a-z0-9._]{3,30}$'),
  name        text not null default '',
  bio         text not null default '' check (char_length(bio) <= 150),
  avatar_url  text,
  created_at  timestamptz not null default now()
);

create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  image_url     text not null,
  aspect_ratio  numeric not null default 1 check (aspect_ratio > 0),
  caption       text not null default '' check (char_length(caption) <= 2200),
  created_at    timestamptz not null default now()
);
create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_user_id_idx on public.posts (user_id);

create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  text        text not null check (char_length(text) between 1 and 2200),
  created_at  timestamptz not null default now()
);
create index if not exists comments_post_id_idx on public.comments (post_id);

-- A like is just a row: (post, user). The primary key prevents double likes.
create table if not exists public.likes (
  post_id     uuid not null references public.posts (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- Saved (bookmarked) posts. Private: only the owner can see their saves.
create table if not exists public.saves (
  post_id     uuid not null references public.posts (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.follows (
  follower_id   uuid not null references public.profiles (id) on delete cascade,
  following_id  uuid not null references public.profiles (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index if not exists follows_following_idx on public.follows (following_id);

-- "blocker has blocked blocked". Only the blocker can see their own rows.
create table if not exists public.blocks (
  blocker_id  uuid not null references public.profiles (id) on delete cascade,
  blocked_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

-- Stories live for 24 hours (the app only reads rows newer than that).
create table if not exists public.stories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  image_url   text not null,
  created_at  timestamptz not null default now()
);
create index if not exists stories_created_at_idx on public.stories (created_at desc);

-- Direct messages: one row per message.
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  receiver_id  uuid not null references public.profiles (id) on delete cascade,
  text         text not null check (char_length(text) between 1 and 2000),
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  check (sender_id <> receiver_id)
);
create index if not exists messages_receiver_idx on public.messages (receiver_id, created_at desc);
create index if not exists messages_sender_idx on public.messages (sender_id, created_at desc);

-- Notifications are created automatically by triggers (section 3).
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade, -- who receives it
  actor_id    uuid not null references public.profiles (id) on delete cascade, -- who did it
  type        text not null check (type in ('like', 'comment', 'follow')),
  post_id     uuid references public.posts (id) on delete cascade,
  text        text,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- Profiles plus follower / following counts, in one query for the app.
create or replace view public.profiles_with_counts
with (security_invoker = true) as
select
  p.*,
  (select count(*) from public.follows f where f.following_id = p.id)::int as followers,
  (select count(*) from public.follows f where f.follower_id  = p.id)::int as following
from public.profiles p;

-- ---------------------------------------------------------------------
-- 2. AUTO-CREATE A PROFILE WHEN SOMEONE SIGNS UP
-- The app sends username + name as sign-up metadata; this trigger turns
-- them into a profiles row.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, name)
  values (
    new.id,
    lower(coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      'user_' || substr(replace(new.id::text, '-', ''), 1, 8)
    )),
    coalesce(new.raw_user_meta_data ->> 'name', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 3. NOTIFICATION TRIGGERS (likes, comments, follows)
-- ---------------------------------------------------------------------
create or replace function public.notify_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select user_id into owner from public.posts where id = new.post_id;
  if owner is not null and owner <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, post_id)
    values (owner, new.user_id, 'like', new.post_id);
  end if;
  return new;
end $$;

create or replace function public.notify_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select user_id into owner from public.posts where id = new.post_id;
  if owner is not null and owner <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, post_id, text)
    values (owner, new.user_id, 'comment', new.post_id, left(new.text, 140));
  end if;
  return new;
end $$;

create or replace function public.notify_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, actor_id, type)
  values (new.following_id, new.follower_id, 'follow');
  return new;
end $$;

drop trigger if exists on_like_created on public.likes;
create trigger on_like_created after insert on public.likes
  for each row execute function public.notify_like();

drop trigger if exists on_comment_created on public.comments;
create trigger on_comment_created after insert on public.comments
  for each row execute function public.notify_comment();

drop trigger if exists on_follow_created on public.follows;
create trigger on_follow_created after insert on public.follows
  for each row execute function public.notify_follow();

-- ---------------------------------------------------------------------
-- 3b. BLOCKING HELPERS
-- is_blocked_between() checks BOTH directions (A blocked B, or B blocked A).
-- It is security definer so a policy can see blocks that the current user is not
-- allowed to read directly; that is how we hide content from someone who was
-- blocked without ever revealing to them who blocked them.
-- ---------------------------------------------------------------------
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

-- True when the post exists, is visible to the current user, and neither side has blocked the other.
create or replace function public.can_interact_with_post(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.posts p
    where p.id = pid and not public.is_blocked_between(auth.uid(), p.user_id)
  );
$$;

-- Blocking someone also removes any follow between the two accounts.
create or replace function public.on_block_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and following_id = new.blocked_id)
     or (follower_id = new.blocked_id and following_id = new.blocker_id);
  return new;
end;
$$;

drop trigger if exists on_block_created on public.blocks;
create trigger on_block_created after insert on public.blocks
  for each row execute function public.on_block_created();

-- ---------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (who may read / write which rows)
-- The anon key ships inside the app, so RLS is what actually protects data.
-- ---------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.posts          enable row level security;
alter table public.comments       enable row level security;
alter table public.likes          enable row level security;
alter table public.saves          enable row level security;
alter table public.follows        enable row level security;
alter table public.stories        enable row level security;
alter table public.blocks         enable row level security;
alter table public.messages       enable row level security;
alter table public.notifications  enable row level security;

-- profiles: public read (anon too, so the sign-up form can check usernames); edit only your own.
drop policy if exists "profiles are readable" on public.profiles;
create policy "profiles are readable" on public.profiles
  for select to anon, authenticated using (true);
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- posts
drop policy if exists "posts are readable" on public.posts;
create policy "posts are readable" on public.posts
  for select to authenticated using (not public.is_blocked_between(auth.uid(), user_id));
drop policy if exists "users create own posts" on public.posts;
create policy "users create own posts" on public.posts
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "users delete own posts" on public.posts;
create policy "users delete own posts" on public.posts
  for delete to authenticated using (user_id = auth.uid());

-- comments
drop policy if exists "comments are readable" on public.comments;
create policy "comments are readable" on public.comments
  for select to authenticated using (not public.is_blocked_between(auth.uid(), user_id));
drop policy if exists "users create own comments" on public.comments;
create policy "users create own comments" on public.comments
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_interact_with_post(post_id));
drop policy if exists "users delete own comments" on public.comments;
create policy "users delete own comments" on public.comments
  for delete to authenticated using (user_id = auth.uid());

-- likes
drop policy if exists "likes are readable" on public.likes;
create policy "likes are readable" on public.likes
  for select to authenticated using (not public.is_blocked_between(auth.uid(), user_id));
drop policy if exists "users like as themselves" on public.likes;
create policy "users like as themselves" on public.likes
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_interact_with_post(post_id));
drop policy if exists "users remove own likes" on public.likes;
create policy "users remove own likes" on public.likes
  for delete to authenticated using (user_id = auth.uid());

-- saves (private)
drop policy if exists "users read own saves" on public.saves;
create policy "users read own saves" on public.saves
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "users save as themselves" on public.saves;
create policy "users save as themselves" on public.saves
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "users remove own saves" on public.saves;
create policy "users remove own saves" on public.saves
  for delete to authenticated using (user_id = auth.uid());

-- follows
drop policy if exists "follows are readable" on public.follows;
create policy "follows are readable" on public.follows
  for select to authenticated using (true);
drop policy if exists "users follow as themselves" on public.follows;
create policy "users follow as themselves" on public.follows
  for insert to authenticated
  with check (follower_id = auth.uid() and not public.is_blocked_between(follower_id, following_id));
drop policy if exists "users unfollow as themselves" on public.follows;
create policy "users unfollow as themselves" on public.follows
  for delete to authenticated using (follower_id = auth.uid());

-- stories (only the last 24 hours are visible)
drop policy if exists "recent stories are readable" on public.stories;
create policy "recent stories are readable" on public.stories
  for select to authenticated
  using (created_at > now() - interval '24 hours' and not public.is_blocked_between(auth.uid(), user_id));
drop policy if exists "users create own stories" on public.stories;
create policy "users create own stories" on public.stories
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "users delete own stories" on public.stories;
create policy "users delete own stories" on public.stories
  for delete to authenticated using (user_id = auth.uid());

-- blocks: you can only see, create and remove YOUR OWN blocks.
-- (Nobody can query "who has blocked me"; the hiding happens inside the other policies.)
drop policy if exists "users read own blocks" on public.blocks;
create policy "users read own blocks" on public.blocks
  for select to authenticated using (blocker_id = auth.uid());
drop policy if exists "users block as themselves" on public.blocks;
create policy "users block as themselves" on public.blocks
  for insert to authenticated with check (blocker_id = auth.uid());
drop policy if exists "users unblock as themselves" on public.blocks;
create policy "users unblock as themselves" on public.blocks
  for delete to authenticated using (blocker_id = auth.uid());

-- messages: only the two people in a conversation can see it.
drop policy if exists "participants read messages" on public.messages;
create policy "participants read messages" on public.messages
  for select to authenticated using (sender_id = auth.uid() or receiver_id = auth.uid());
drop policy if exists "users send as themselves" on public.messages;
create policy "users send as themselves" on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and not public.is_blocked_between(sender_id, receiver_id));
drop policy if exists "receiver marks as read" on public.messages;
create policy "receiver marks as read" on public.messages
  for update to authenticated using (receiver_id = auth.uid()) with check (receiver_id = auth.uid());
-- The receiver may only change read_at, never the message text.
revoke update on public.messages from authenticated;
grant update (read_at) on public.messages to authenticated;

-- notifications: you only see your own. (Rows are created by the trigger functions above.)
drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 5. STORAGE: one public bucket "media"; files live in <user id>/<folder>/<file>
-- Anyone can view images; you can only upload / change / delete inside your own folder.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "media is publicly readable" on storage.objects;
create policy "media is publicly readable" on storage.objects
  for select using (bucket_id = 'media');

drop policy if exists "users upload to own folder" on storage.objects;
create policy "users upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users update own files" on storage.objects;
create policy "users update own files" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users delete own files" on storage.objects;
create policy "users delete own files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- 6. REALTIME: push new messages and notifications to the app instantly
-- ---------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then null;
  end;
end $$;
