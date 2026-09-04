-- Allow Ja/Ice members to delete only tasks assigned to themselves.
-- Jin/manager can still delete every task.
-- Run this once in Supabase SQL Editor.

drop policy if exists "managers delete tasks" on public.tasks;
drop policy if exists "managers and assigned members delete tasks" on public.tasks;

create policy "managers and assigned members delete tasks"
on public.tasks for delete
to authenticated
using (public.is_manager() or assigned_to = auth.uid());
