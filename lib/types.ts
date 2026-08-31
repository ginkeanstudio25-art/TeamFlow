export type Role = "manager" | "member";
export type PersonName = "Jin" | "Ja" | "Ice";
export type TaskStatus = "ยังไม่เริ่ม" | "กำลังทำ" | "รอตรวจ" | "เสร็จสิ้น";
export type Progress = 0 | 25 | 50 | 75 | 100;
export type Recurrence = "once" | "weekly" | "monthly";
export type RequestType =
  | "ติดปัญหา"
  | "ขออนุมัติ"
  | "ขอข้อมูล / ไฟล์"
  | "ขอให้ช่วยตัดสินใจ"
  | "ขอเปลี่ยนกำหนดส่ง"
  | "อื่นๆ";
export type Urgency = "ปกติ" | "ด่วน" | "ด่วนมาก";
export type RequestStatus = "รอผู้รับตอบ" | "รอหัวหน้าตอบ" | "กำลังช่วย" | "แก้ไขแล้ว";

export type Profile = {
  id: string;
  display_name: PersonName;
  role: Role;
  team_title: string | null;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string;
  assigned_profile?: Profile | null;
  created_by: string;
  created_profile?: Profile | null;
  status: TaskStatus;
  progress: Progress;
  current_step: string | null;
  note: string | null;
  created_at: string;
  due_date: string | null;
  completed_date: string | null;
  type: "task";
  recurrence: Recurrence;
  recurrence_day: number | null;
  next_generated_task_id: string | null;
};

export type HelpRequest = {
  id: string;
  sender: string;
  sender_profile?: Profile | null;
  recipient: string;
  recipient_profile?: Profile | null;
  task_id: string | null;
  task?: Pick<Task, "id" | "title"> | null;
  type: RequestType;
  urgency: Urgency;
  message: string;
  status: RequestStatus;
  created_at: string;
};
