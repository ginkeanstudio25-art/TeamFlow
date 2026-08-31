import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    process.env[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const now = new Date();
const isoDate = (offsetDays) => {
  const date = new Date(now);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

const tasks = [
  ["Live สอนทำงาน 3 วัน", "เตรียมคอนเทนต์และไลฟ์สอน workflow การทำงานให้ครบ 3 วัน", "Ja", "กำลังทำ", 50, "วาง outline วันที่ 2 และเตรียมไฟล์ประกอบ", "รอคอนเฟิร์มหัวข้อจาก Jin", 2, "งานครั้งเดียว", "once"],
  ["ตารางคอนเทนต์ประจำสัปดาห์", "จัดตารางโพสต์และสรุปหัวข้อคอนเทนต์รายสัปดาห์", "Jin", "ยังไม่เริ่ม", 0, "", "", 4, "งานประจำรายสัปดาห์", "weekly"],
  ["อัดคลิปสอน AI พาร์ทที่เหลือ 3 ตอน", "อัดคลิปสอน AI และจัดไฟล์ให้พร้อมส่งต่อทีมตัดต่อ", "Ice", "กำลังทำ", 75, "ตัดต่อ draft ตอนที่ 2", "ขาดภาพประกอบบางช่วง", 1, "งานครั้งเดียว", "once"],
  ["สรุปรายงานผลทีมรายเดือน", "รวบรวมสถานะงาน คำขอ และงานที่เลยกำหนดสำหรับประชุมเดือนนี้", "Jin", "รอตรวจ", 100, "รอเช็คตัวเลขสุดท้าย", "", 3, "งานประจำรายเดือน", "monthly"],
  ["เตรียมไฟล์ภาพประกอบโพสต์", "หาและจัดชุดไฟล์ภาพสำหรับโพสต์ประจำสัปดาห์", "Ice", "ยังไม่เริ่ม", 0, "", "", -2, "งานครั้งเดียว", "once"],
  ["เช็ค inbox และคำขอจากทีม", "ตรวจคำขอที่เข้ามาและตอบกลับรายการที่ต้องการการตัดสินใจ", "Jin", "เสร็จสิ้น", 100, "ปิดรายการแล้ว", "", -1, "งานประจำรายสัปดาห์", "weekly", 0],
];

const requests = [
  ["Ja", "Jin", "Live สอนทำงาน 3 วัน", "ขอให้ช่วยตัดสินใจ", "ปกติ", "มี 2 หัวข้อที่ใกล้เคียงกัน อยากให้ช่วยเลือกหัวข้อที่จะทำก่อน"],
  ["Ice", "Jin", "อัดคลิปสอน AI พาร์ทที่เหลือ 3 ตอน", "ขอข้อมูล / ไฟล์", "ด่วน", "ตัดต่อถึงช่วงตัวอย่างแล้ว แต่ยังขาดไฟล์ภาพประกอบ 3 รูป"],
];

const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id, display_name");
if (profilesError) throw profilesError;

const profileByName = new Map(profiles.map((profile) => [profile.display_name, profile]));
for (const name of ["Jin", "Ja", "Ice"]) {
  if (!profileByName.has(name)) throw new Error(`Missing profile for ${name}. Run npm run setup:users first.`);
}

const taskByTitle = new Map();

for (const [title, description, assigneeName, status, progress, current_step, note, offset, type, recurrence, completedOffset] of tasks) {
  const due_date = isoDate(offset);
  const { data: existing, error: existingError } = await supabase
    .from("tasks")
    .select("id, title")
    .eq("title", title)
    .eq("due_date", due_date)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    taskByTitle.set(title, existing);
    console.log(`Task already exists: ${title}`);
    continue;
  }

  const { data: created, error: createError } = await supabase
    .from("tasks")
    .insert({
      title,
      description,
      assigned_to: profileByName.get(assigneeName).id,
      created_by: profileByName.get("Jin").id,
      status,
      progress,
      current_step,
      note,
      due_date,
      completed_date: typeof completedOffset === "number" ? isoDate(completedOffset) : null,
      type,
      recurrence,
    })
    .select("id, title")
    .single();
  if (createError) throw createError;
  taskByTitle.set(title, created);
  console.log(`Seeded task: ${title}`);
}

for (const [senderName, recipientName, taskTitle, type, urgency, message] of requests) {
  const sender = profileByName.get(senderName);
  const recipient = profileByName.get(recipientName);
  const task = taskByTitle.get(taskTitle);
  if (!task) throw new Error(`Missing task for request: ${taskTitle}`);

  const { data: existing, error: existingError } = await supabase
    .from("requests")
    .select("id")
    .eq("sender", sender.id)
    .eq("recipient", recipient.id)
    .eq("task_id", task.id)
    .eq("message", message)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    console.log(`Request already exists: ${senderName} -> ${recipientName}`);
    continue;
  }

  const { error: createError } = await supabase.from("requests").insert({
    sender: sender.id,
    recipient: recipient.id,
    task_id: task.id,
    type,
    urgency,
    message,
    status: "รอผู้รับตอบ",
  });
  if (createError) throw createError;
  console.log(`Seeded request: ${senderName} -> ${recipientName}`);
}

console.log("TeamFlow seed data is ready.");


