-- Hopper copies keep drawing, import, and yarn (the recipe).
-- Progress (checkboxes, highlight, lock, flip) starts fresh. Notes stay omitted.
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
    jsonb_build_object(
      'trackMode', 'row',
      'rowComplete', '[]'::jsonb,
      'currentRow', 0,
      'editLocked', false,
      'mirrorView', false,
      'craft', 'filet-dc'
    ),
    source.yarn_settings,
    source.image_settings,
    source.thumbnail
  ) returning id into new_id;

  update patterns set copies_count = copies_count + 1 where id = p_pattern_id;

  return new_id;
end;
$$;
