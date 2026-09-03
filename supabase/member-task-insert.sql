drop policy if exists "managers create tasks" on public.tasks;

create policy "managers and members create permitted tasks"
on public.tasks for insert
to authenticated
with check (
  (
    public.is_manager()
    and created_by = auth.uid()
  )
  or (
    not public.is_manager()
    and created_by = auth.uid()
    and assigned_to = auth.uid()
    and due_date is null
    and recurrence = 'once'
    and recurrence_day is null
  )
);
