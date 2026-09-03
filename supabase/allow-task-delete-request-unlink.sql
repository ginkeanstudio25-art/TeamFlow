create or replace function public.enforce_request_update_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_manager()
    and new.task_id is null
    and old.task_id is not null
    and new.id is not distinct from old.id
    and new.sender is not distinct from old.sender
    and new.recipient is not distinct from old.recipient
    and new.type is not distinct from old.type
    and new.urgency is not distinct from old.urgency
    and new.message is not distinct from old.message
    and new.status is not distinct from old.status
    and new.created_at is not distinct from old.created_at then
    return new;
  end if;

  if not public.is_manager() and old.recipient <> auth.uid() then
    raise exception 'Only the recipient can update this request';
  end if;

  if new.id is distinct from old.id
    or new.sender is distinct from old.sender
    or new.recipient is distinct from old.recipient
    or new.task_id is distinct from old.task_id
    or new.type is distinct from old.type
    or new.urgency is distinct from old.urgency
    or new.message is distinct from old.message
    or new.created_at is distinct from old.created_at then
    raise exception 'Request updates are limited to status';
  end if;

  return new;
end;
$$;

