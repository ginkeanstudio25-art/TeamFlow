create extension if not exists pgcrypto;

create type public.team_role as enum ('manager', 'member');
create type public.person_name as enum ('Jin', 'Ja', 'Ice');
create type public.task_status as enum ('ยังไม่เริ่ม', 'กำลังทำ', 'รอตรวจ', 'เสร็จสิ้น');
create type public.task_progress as enum ('0', '25', '50', '75', '100');
create type public.task_recurrence as enum ('once', 'weekly', 'monthly');
create type public.request_type as enum (
  'ติดปัญหา',
  'ขออนุมัติ',
  'ขอข้อมูล / ไฟล์',
  'ขอให้ช่วยตัดสินใจ',
  'ขอเปลี่ยนกำหนดส่ง',
  'อื่นๆ'
);
create type public.request_urgency as enum ('ปกติ', 'ด่วน', 'ด่วนมาก');
create type public.request_status as enum ('รอผู้รับตอบ', 'รอหัวหน้าตอบ', 'กำลังช่วย', 'แก้ไขแล้ว');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name public.person_name not null unique,
  role public.team_role not null default 'member',
  team_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text,
  assigned_to uuid not null references public.profiles(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  status public.task_status not null default 'ยังไม่เริ่ม',
  progress integer not null default 0 check (progress in (0, 25, 50, 75, 100)),
  current_step text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  due_date date,
  completed_date date,
  type text not null default 'task',
  recurrence public.task_recurrence not null default 'once',
  recurrence_day integer,
  next_generated_task_id uuid references public.tasks(id) on delete set null,
  check (
    (recurrence = 'once' and recurrence_day is null)
    or (recurrence = 'weekly' and recurrence_day between 1 and 7)
    or (recurrence = 'monthly' and recurrence_day between 1 and 31)
  )
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references public.profiles(id) on delete cascade,
  recipient uuid not null references public.profiles(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  type public.request_type not null,
  urgency public.request_urgency not null default 'ปกติ',
  message text not null check (length(trim(message)) > 0),
  status public.request_status not null default 'รอผู้รับตอบ',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender <> recipient)
);

create index tasks_assigned_to_idx on public.tasks(assigned_to);
create index tasks_created_by_idx on public.tasks(created_by);
create index tasks_due_date_idx on public.tasks(due_date);
create index requests_sender_idx on public.requests(sender);
create index requests_recipient_idx on public.requests(recipient);
create index requests_task_id_idx on public.requests(task_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger tasks_touch_updated_at before update on public.tasks
for each row execute function public.touch_updated_at();

create trigger requests_touch_updated_at before update on public.requests
for each row execute function public.touch_updated_at();

create or replace function public.current_profile_role()
returns public.team_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() = 'manager', false)
$$;

create or replace function public.enforce_task_update_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.team_role;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  select role into actor_role from public.profiles where id = auth.uid();

  if actor_role = 'manager' then
    return new;
  end if;

  if old.assigned_to <> auth.uid() then
    raise exception 'Members can update only their own tasks';
  end if;

  if new.id is distinct from old.id
    or new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.assigned_to is distinct from old.assigned_to
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
    or new.due_date is distinct from old.due_date
    or new.type is distinct from old.type
    or new.recurrence is distinct from old.recurrence
    or new.recurrence_day is distinct from old.recurrence_day
    or new.next_generated_task_id is distinct from old.next_generated_task_id then
    raise exception 'Members may update only status, progress, current_step, note, and completed_date';
  end if;

  if new.progress not in (0, 25, 50, 75, 100) then
    raise exception 'Invalid progress';
  end if;

  return new;
end;
$$;

create trigger enforce_task_update_permissions
before update on public.tasks
for each row execute function public.enforce_task_update_permissions();

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

  if new.recurrence = 'weekly' then
    next_due := new.due_date + interval '7 days';
  elsif new.recurrence = 'monthly' then
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

create trigger create_next_routine_task
after update of status on public.tasks
for each row execute function public.create_next_routine_task();

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.requests enable row level security;

create policy "profiles are visible to signed in team"
on public.profiles for select
to authenticated
using (true);

create policy "managers can see all tasks; members see assigned tasks"
on public.tasks for select
to authenticated
using (public.is_manager() or assigned_to = auth.uid());

create policy "managers create tasks"
on public.tasks for insert
to authenticated
with check (public.is_manager() and created_by = auth.uid());

create policy "managers update all tasks; members update assigned tasks"
on public.tasks for update
to authenticated
using (public.is_manager() or assigned_to = auth.uid())
with check (public.is_manager() or assigned_to = auth.uid());

create policy "managers delete tasks"
on public.tasks for delete
to authenticated
using (public.is_manager());

create policy "requests visible to managers and participants"
on public.requests for select
to authenticated
using (public.is_manager() or sender = auth.uid() or recipient = auth.uid());

create policy "team members create their own requests"
on public.requests for insert
to authenticated
with check (
  sender = auth.uid()
  and recipient <> auth.uid()
  and (
    task_id is null
    or exists (
      select 1 from public.tasks t
      where t.id = task_id
      and (public.is_manager() or t.assigned_to = auth.uid())
    )
  )
);

create policy "recipients can update request status"
on public.requests for update
to authenticated
using (public.is_manager() or recipient = auth.uid())
with check (public.is_manager() or recipient = auth.uid());

create or replace function public.enforce_request_update_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

create trigger enforce_request_update_permissions
before update on public.requests
for each row execute function public.enforce_request_update_permissions();

create policy "managers can delete requests"
on public.requests for delete
to authenticated
using (public.is_manager());
