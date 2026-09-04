-- Add daily routine tasks to an existing TeamFlow Supabase project.
-- Run this once in Supabase SQL Editor.

alter type public.task_recurrence add value if not exists 'daily';

alter table public.tasks drop constraint if exists tasks_check;
alter table public.tasks drop constraint if exists tasks_recurrence_day_check;

alter table public.tasks
add constraint tasks_recurrence_day_check
check (
  (recurrence::text = 'once' and recurrence_day is null)
  or (recurrence::text = 'daily' and recurrence_day is null)
  or (recurrence::text = 'weekly' and recurrence_day between 1 and 7)
  or (recurrence::text = 'monthly' and recurrence_day between 1 and 31)
);

create or replace function public.create_next_routine_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_due date;
  new_id uuid;
begin
  if new.status <> 'เสร็จสิ้น'
    or old.status = 'เสร็จสิ้น'
    or new.recurrence = 'once'
    or new.next_generated_task_id is not null then
    return new;
  end if;

  if new.due_date is null then
    return new;
  end if;

  if new.recurrence::text = 'daily' then
    next_due := new.due_date + interval '1 day';
  elsif new.recurrence::text = 'weekly' then
    next_due := new.due_date + interval '7 days';
  elsif new.recurrence::text = 'monthly' then
    next_due := new.due_date + interval '1 month';
  end if;

  insert into public.tasks (
    title,
    description,
    assigned_to,
    created_by,
    status,
    progress,
    current_step,
    note,
    due_date,
    completed_date,
    type,
    recurrence,
    recurrence_day
  )
  values (
    new.title,
    new.description,
    new.assigned_to,
    new.created_by,
    'ยังไม่เริ่ม',
    0,
    'ยังไม่ได้เริ่ม',
    null,
    next_due,
    null,
    new.type,
    new.recurrence,
    new.recurrence_day
  )
  returning id into new_id;

  update public.tasks set next_generated_task_id = new_id where id = new.id;
  return new;
end;
$$;
