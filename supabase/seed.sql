insert into public.tasks (title, description, assigned_to, created_by, status, progress, current_step, note, due_date, completed_date, recurrence, recurrence_day)
select
  seed.title,
  seed.description,
  assigned_profile.id,
  creator_profile.id,
  seed.status::public.task_status,
  seed.progress,
  seed.current_step,
  seed.note,
  seed.due_date,
  seed.completed_date,
  seed.recurrence::public.task_recurrence,
  seed.recurrence_day
from (
  values
  ('คลิปสั้น 4 เทคนิค ปรับไฟล์ขายบน Etsy เปลี่ยนมือใหม่ให้เป็นมือโปร', null, 'Ja', 'Jin', 'เสร็จสิ้น', 100, 'เสร็จเรียบร้อย', null, date '2026-08-20', date '2026-08-20', 'once', null),
  ('Live สอนทำงาน 3 วัน', null, 'Ja', 'Jin', 'ยังไม่เริ่ม', 0, 'ยังไม่ได้เริ่ม', null, date '2026-08-31', null, 'once', null),
  ('Live สอนจนให้ตรงใจ ลง Sub', null, 'Ja', 'Jin', 'ยังไม่เริ่ม', 0, 'ยังไม่ได้เริ่ม', null, date '2026-08-24', null, 'once', null),
  ('คลิปสั้นวิธีการเลือกสินค้า', null, 'Ja', 'Jin', 'ยังไม่เริ่ม', 0, 'ยังไม่ได้เริ่ม', null, date '2026-08-22', null, 'once', null),
  ('คลิปสั้น มือใหม่ขายไฟล์ part 2', null, 'Ja', 'Jin', 'ยังไม่เริ่ม', 0, 'ยังไม่ได้เริ่ม', null, date '2026-08-21', null, 'once', null),
  ('คลิปสั้นลงยูทูปย้อนหลัง', null, 'Ja', 'Jin', 'ยังไม่เริ่ม', 0, 'ยังไม่ได้เริ่ม', null, date '2026-08-21', null, 'once', null),
  ('อัดคลิปสั้นใหม่ประจำสัปดาห์ 5 คลิป', null, 'Ice', 'Jin', 'กำลังทำ', 50, 'กำลังดำเนินงาน', null, date '2026-08-29', null, 'once', null),
  ('อัดคลิปสอน AI พาร์ทที่เหลือ 3 ตอน', null, 'Ice', 'Jin', 'กำลังทำ', 50, 'กำลังดำเนินงาน', null, date '2026-08-30', null, 'once', null),
  ('ตรวจโพสต์ AI ประจำ week x15', null, 'Ice', 'Jin', 'เสร็จสิ้น', 100, 'เสร็จเรียบร้อย', null, date '2026-08-27', date '2026-08-27', 'once', null),
  ('เตรียมภาพประกอบ Live สัปดาห์นี้', null, 'Ice', 'Jin', 'ยังไม่เริ่ม', 0, 'ยังไม่ได้เริ่ม', null, date '2026-08-30', null, 'once', null),
  ('วางแผนหัวข้อคอนเทนต์สัปดาห์หน้า', null, 'Jin', 'Jin', 'กำลังทำ', 50, 'กำลังเลือกหัวข้อหลัก', null, date '2026-08-29', null, 'once', null),
  ('ตรวจงานคลิปก่อนลงโพสต์', null, 'Jin', 'Jin', 'ยังไม่เริ่ม', 0, 'รอไฟล์จากทีม', null, date '2026-08-30', null, 'once', null),
  ('สรุปแผนงานประจำสัปดาห์', null, 'Jin', 'Jin', 'เสร็จสิ้น', 100, 'เสร็จเรียบร้อย', null, date '2026-08-27', date '2026-08-27', 'once', null),
  ('สรุปยอดและงานประจำสัปดาห์', 'สรุปสิ่งที่ทำเสร็จและงานค้าง', 'Jin', 'Jin', 'ยังไม่เริ่ม', 0, 'รอรอบวันศุกร์', null, date '2026-09-04', null, 'weekly', 5),
  ('เตรียม Content Calendar เดือนถัดไป', 'วางหัวข้อคอนเทนต์สำหรับเดือนหน้า', 'Ja', 'Jin', 'ยังไม่เริ่ม', 0, 'รอเริ่มงาน', null, date '2026-09-25', null, 'monthly', 25)
) as seed(title, description, assigned_name, creator_name, status, progress, current_step, note, due_date, completed_date, recurrence, recurrence_day)
join public.profiles assigned_profile on assigned_profile.display_name = seed.assigned_name::public.person_name
join public.profiles creator_profile on creator_profile.display_name = seed.creator_name::public.person_name
where not exists (
  select 1 from public.tasks existing
  where existing.title = seed.title
  and existing.due_date = seed.due_date
);

insert into public.requests (sender, recipient, task_id, type, urgency, message, status)
select sender_profile.id, recipient_profile.id, task.id, seed.type::public.request_type, seed.urgency::public.request_urgency, seed.message, seed.status::public.request_status
from (
  values
  ('Ja', 'Jin', 'ขอให้ช่วยตัดสินใจ', 'ปกติ', 'มี 2 หัวข้อที่ใกล้เคียงกัน อยากให้ช่วยเลือกหัวข้อที่จะทำก่อน', 'รอผู้รับตอบ', 'Live สอนทำงาน 3 วัน'),
  ('Ice', 'Jin', 'ขอข้อมูล / ไฟล์', 'ด่วน', 'ตัดต่อถึงช่วงตัวอย่างแล้ว แต่ยังขาดไฟล์ภาพประกอบ 3 รูป', 'รอผู้รับตอบ', 'อัดคลิปสอน AI พาร์ทที่เหลือ 3 ตอน')
) as seed(sender_name, recipient_name, type, urgency, message, status, task_title)
join public.profiles sender_profile on sender_profile.display_name = seed.sender_name::public.person_name
join public.profiles recipient_profile on recipient_profile.display_name = seed.recipient_name::public.person_name
left join public.tasks task on task.title = seed.task_title
where not exists (
  select 1 from public.requests existing
  where existing.sender = sender_profile.id
  and existing.recipient = recipient_profile.id
  and existing.message = seed.message
);
