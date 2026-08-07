-- Fixes for the SECURITY DEFINER RPC functions backing gallery likes/copies.
--
-- 1. toggle_pattern_like: previously accepted any pattern id with no ownership/visibility
--    check. Since it runs as SECURITY DEFINER (above RLS), a caller could like/unlike -- and
--    thereby manipulate likes_count and pattern_likes rows for -- another user's private,
--    unpublished pattern. Now mirrors copy_public_pattern's is_public check.
-- 2. Both functions: pin search_path to prevent search-path hijacking, per Supabase's
--    "function_search_path_mutable" linter rule.
-- 3. copy_public_pattern: the INSERT column list omitted image_settings and thumbnail, so
--    copies silently lost crop/manila-stock settings and showed no thumbnail. Added both.
--
-- Run this in the Supabase SQL Editor, or via `supabase db push` once the project is linked.

create or replace function public.toggle_pattern_like(p_pattern_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  already_liked boolean;
begin
  if not exists (
    select 1 from patterns where id = p_pattern_id and is_public = true
  ) then
    raise exception 'pattern not found or not public';
  end if;

  select exists(
    select 1 from pattern_likes
    where user_id = auth.uid() and pattern_id = p_pattern_id
  ) into already_liked;

  if already_liked then
    delete from pattern_likes where user_id = auth.uid() and pattern_id = p_pattern_id;
    update patterns set likes_count = greatest(0, likes_count - 1) where id = p_pattern_id;
    return false;
  else
    insert into pattern_likes (user_id, pattern_id) values (auth.uid(), p_pattern_id);
    update patterns set likes_count = likes_count + 1 where id = p_pattern_id;
    return true;
  end if;
end;
$$;

create or replace function public.copy_public_pattern(p_pattern_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  source patterns%rowtype;
  new_id uuid;
begin
  select * into source from patterns where id = p_pattern_id and is_public = true;
  if not found then
    raise exception 'pattern not found or not public';
  end if;

  insert into patterns (
    user_id, name, grid_data, grid_width, grid_height, progress_data,
    yarn_settings, image_settings, thumbnail
  )
  values (
    auth.uid(),
    source.name || ' (copy)',
    source.grid_data,
    source.grid_width,
    source.grid_height,
    source.progress_data,
    source.yarn_settings,
    source.image_settings,
    source.thumbnail
  ) returning id into new_id;

  update patterns set copies_count = copies_count + 1 where id = p_pattern_id;

  return new_id;
end;
$$;
