"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import type {
  HelpRequest,
  PersonName,
  Profile,
  Progress,
  Recurrence,
  RequestStatus,
  RequestType,
  Task,
  TaskStatus,
  Urgency
} from "@/lib/types";

const PEOPLE: PersonName[] = ["Jin", "Ja", "Ice"];
const STATUSES: TaskStatus[] = ["ยังไม่เริ่ม", "กำลังทำ", "รอตรวจ", "เสร็จสิ้น"];
const PROGRESS_VALUES: Progress[] = [0, 25, 50, 75, 100];
const REQUEST_TYPES: RequestType[] = [
  "ติดปัญหา",
  "ขออนุมัติ",
  "ขอข้อมูล / ไฟล์",
  "ขอให้ช่วยตัดสินใจ",
  "ขอเปลี่ยนกำหนดส่ง",
  "อื่นๆ"
];
const URGENCIES: Urgency[] = ["ปกติ", "ด่วน", "ด่วนมาก"];

const today = new Date();

type PageId = "dashboard" | "alltasks" | "mytasks" | "myrequests" | "team" | "calendar" | "completed";
type TaskForm = {
  title: string;
  description: string;
  assigned_to: string;
  status: TaskStatus;
  progress: Progress;
  current_step: string;
  note: string;
  due_date: string;
  created_at: string;
  completed_date: string;
  recurrence: Recurrence;
  recurrence_day: number | "";
};
type RequestForm = {
  title: string;
  task_id: string;
  recipient: string;
  type: RequestType;
  urgency: Urgency;
  message: string;
};

const emptyTaskForm = (): TaskForm => ({
  title: "",
  description: "",
  assigned_to: "",
  status: "ยังไม่เริ่ม",
  progress: 0,
  current_step: "ยังไม่ได้เริ่ม",
  note: "",
  due_date: isoDate(today),
  created_at: isoDate(today),
  completed_date: "",
  recurrence: "once",
  recurrence_day: ""
});

const emptyRequestForm = (): RequestForm => ({
  title: "",
  task_id: "",
  recipient: "",
  type: "ติดปัญหา",
  urgency: "ปกติ",
  message: ""
});

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [page, setPage] = useState<PageId>("dashboard");
  const [taskTab, setTaskTab] = useState<"all" | "requests">("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [myStatusFilter, setMyStatusFilter] = useState("");
  const [calendarOwner, setCalendarOwner] = useState<"all" | PersonName>("all");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyTaskForm);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestForm, setRequestForm] = useState<RequestForm>(emptyRequestForm);
  const [inlineRequestOpen, setInlineRequestOpen] = useState(false);
  const [inlineRequest, setInlineRequest] = useState<RequestForm>(emptyRequestForm);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setError("ยังไม่ได้ตั้งค่า NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY");
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfiles([]);
      setTasks([]);
      setRequests([]);
      setLoading(false);
      return;
    }
    loadData(user.id);
  }, [user]);

  useEffect(() => {
    if (!profile) return;
    setPage(profile.role === "manager" ? "dashboard" : "mytasks");
  }, [profile]);

  const isManager = profile?.role === "manager";
  const canDeleteEditingTask = Boolean(editingTask && (isManager || editingTask.assigned_to === profile?.id));
  const currentName = profile?.display_name ?? "Jin";
  const scopedTasks = useMemo(() => {
    if (!profile) return [];
    return isManager ? tasks : tasks.filter((task) => task.assigned_to === profile.id);
  }, [isManager, profile, tasks]);

  const incomingRequests = useMemo(() => {
    if (!profile) return [];
    return requests.filter((request) => request.recipient === profile.id);
  }, [profile, requests]);

  const sentRequests = useMemo(() => {
    if (!profile) return [];
    return requests.filter((request) => request.sender === profile.id);
  }, [profile, requests]);

  async function loadData(userId: string) {
    setLoading(true);
    setError("");
    const { data: me, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError || !me) {
      setError("ไม่พบ profile ของผู้ใช้นี้ กรุณาตรวจขั้นตอน setup ใน README");
      setLoading(false);
      return;
    }

    setProfile(me);
    const [{ data: allProfiles, error: profilesError }, { data: taskRows, error: tasksError }, { data: requestRows, error: requestsError }] =
      await Promise.all([
        supabase.from("profiles").select("*").order("display_name"),
        supabase
          .from("tasks")
          .select("*, assigned_profile:profiles!tasks_assigned_to_fkey(*), created_profile:profiles!tasks_created_by_fkey(*)")
          .order("created_at", { ascending: false }),
        supabase
          .from("requests")
          .select("*, sender_profile:profiles!requests_sender_fkey(*), recipient_profile:profiles!requests_recipient_fkey(*), task:tasks(id,title)")
          .order("created_at", { ascending: false })
      ]);

    if (profilesError || tasksError || requestsError) {
      setError(profilesError?.message || tasksError?.message || requestsError?.message || "โหลดข้อมูลไม่สำเร็จ");
    } else {
      setProfiles((allProfiles ?? []) as Profile[]);
      setTasks((taskRows ?? []) as Task[]);
      setRequests((requestRows ?? []) as HelpRequest[]);
    }
    setLoading(false);
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
  }

  async function logout() {
    await supabase.auth.signOut();
    setEmail("");
    setPassword("");
    setPage("dashboard");
  }

  function openNewTask() {
    const form = emptyTaskForm();
    form.assigned_to = profile?.id ?? "";
    setEditingTask(null);
    setTaskForm(form);
    setInlineRequest(emptyRequestForm());
    setInlineRequestOpen(false);
    setTaskModalOpen(true);
  }

  function openEditTask(task: Task) {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description ?? "",
      assigned_to: task.assigned_to,
      status: task.status,
      progress: task.progress,
      current_step: task.current_step ?? "",
      note: task.note ?? "",
      due_date: task.due_date ?? "",
      created_at: isoDate(new Date(task.created_at)),
      completed_date: task.completed_date ?? "",
      recurrence: task.recurrence,
      recurrence_day: task.recurrence_day ?? ""
    });
    setInlineRequest(emptyRequestForm());
    setInlineRequestOpen(false);
    setTaskModalOpen(true);
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !taskForm.title.trim()) return;
    setError("");

    const isNewMemberTask = !isManager && !editingTask;
    const done = taskForm.status === "เสร็จสิ้น" || taskForm.progress === 100;
    const payload = {
      title: taskForm.title.trim(),
      description: taskForm.description.trim() || null,
      assigned_to: isNewMemberTask ? profile.id : taskForm.assigned_to,
      status: done ? "เสร็จสิ้น" : taskForm.status,
      progress: done ? 100 : taskForm.progress,
      current_step: taskForm.current_step.trim() || null,
      note: taskForm.note.trim() || null,
      due_date: taskForm.due_date || null,
      completed_date: done ? taskForm.completed_date || isoDate(today) : taskForm.completed_date || null,
      recurrence: taskForm.recurrence,
      recurrence_day: taskForm.recurrence === "weekly" || taskForm.recurrence === "monthly" ? Number(taskForm.recurrence_day || 1) : null,
      type: "task"
    };
    const writePayload = isManager ? { ...payload, created_at: `${taskForm.created_at || isoDate(today)}T00:00:00` } : payload;

    const result = editingTask
      ? await supabase.from("tasks").update(writePayload).eq("id", editingTask.id).select().single()
      : await supabase
          .from("tasks")
          .insert({ ...writePayload, created_by: profile.id })
          .select()
          .single();

    if (result.error) {
      setError(result.error.message);
      return;
    }

    const savedTaskId = (result.data as Task).id;
    if (!editingTask) {
      await notifyLine({ kind: "task", taskId: savedTaskId });
    }
    if (inlineRequest.recipient) {
      await createRequest({
        ...inlineRequest,
        title: `${inlineRequest.type}: ${payload.title}`,
        task_id: savedTaskId
      });
    }

    setTaskModalOpen(false);
    await loadData(profile.id);
  }

  async function deleteTask() {
    if (!profile || !editingTask || !confirm(`ลบงาน "${editingTask.title}" ใช่ไหม?`)) return;
    setError("");
    const deletedTaskId = editingTask.id;
    const { data: deletedRows, error: deleteError } = await supabase.from("tasks").delete().eq("id", deletedTaskId).select("id");
    if (deleteError) {
      setError(`ลบงานไม่สำเร็จ: ${deleteError.message}`);
      return;
    }
    if (!deletedRows?.length) {
      setError("ลบงานไม่สำเร็จ: ไม่พบงานนี้ หรือบัญชีนี้ไม่มีสิทธิ์ลบงาน");
      return;
    }
    setTasks((current) => current.filter((task) => task.id !== deletedTaskId));
    setRequests((current) => current.map((request) => request.task_id === deletedTaskId ? { ...request, task_id: null, task: null } : request));
    setEditingTask(null);
    setTaskModalOpen(false);
    await loadData(profile.id);
  }

  function openRequest(taskId = "") {
    const sender = profile?.id ?? "";
    const firstRecipient = profiles.find((p) => p.id !== sender)?.id ?? "";
    setRequestForm({ ...emptyRequestForm(), recipient: firstRecipient, task_id: taskId });
    setRequestModalOpen(true);
  }

  async function notifyLine(body: { kind: "task"; taskId: string } | { kind: "request"; requestId: string }) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    await fetch("/api/line/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body)
    }).catch(() => undefined);
  }

  async function createRequest(form: RequestForm) {
    if (!profile || !form.recipient) return;
    const taskTitle = tasks.find((task) => task.id === form.task_id)?.title;
    const { data: createdRequest, error: requestError } = await supabase
      .from("requests")
      .insert({
        sender: profile.id,
        recipient: form.recipient,
        task_id: form.task_id || null,
        type: form.type,
        urgency: form.urgency,
        message: form.message || form.title || "",
        status: "รอผู้รับตอบ"
      })
      .select("id")
      .single();
    if (requestError) setError(requestError.message);
    if (!requestError && createdRequest?.id) {
      await notifyLine({ kind: "request", requestId: createdRequest.id });
    }
    if (!requestError && !form.title && taskTitle) setError("");
  }

  async function saveRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requestForm.message.trim()) {
      setError("กรุณาใส่รายละเอียดคำขอ");
      return;
    }
    await createRequest(requestForm);
    setRequestModalOpen(false);
    if (profile) await loadData(profile.id);
  }

  async function updateRequestStatus(request: HelpRequest, status: RequestStatus) {
    if (!profile) return;
    const { error: updateError } = await supabase.from("requests").update({ status }).eq("id", request.id);
    if (updateError) setError(updateError.message);
    else await loadData(profile.id);
  }

  const filteredTasks = scopedTasks.filter((task) => {
    const ownerName = task.assigned_profile?.display_name;
    const matchesSearch = task.title.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || task.status === statusFilter;
    const matchesOwner = !ownerFilter || ownerName === ownerFilter;
    return matchesSearch && matchesStatus && matchesOwner;
  });

  const myTasks = scopedTasks.filter((task) => !myStatusFilter || task.status === myStatusFilter);
  const completedTasks = scopedTasks.filter((task) => task.status === "เสร็จสิ้น");
  const dashboardRequests = incomingRequests.filter((request) => request.status !== "แก้ไขแล้ว");
  const attentionTasks = scopedTasks.filter((task) => overdueDays(task) > 0 || (task.due_date && dueSoon(task)));

  if (!user) {
    return (
      <div className="login-screen">
        <form className="login-card" onSubmit={login}>
          <div className="login-logo">✓ ทีมโฟลว์</div>
          <div className="login-sub">เข้าสู่ระบบก่อนเริ่มทำงาน</div>
          <label htmlFor="email">อีเมล</label>
          <input id="email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
          <label htmlFor="password">รหัสผ่าน</label>
          <input id="password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required />
          <button className="btn primary" type="submit">เข้าสู่ TeamFlow</button>
          {error ? <div className="login-error visible">{error}</div> : null}
          <div className="login-note">ระบบใช้ Supabase Auth และดึงชื่อกับสิทธิ์จาก profile หลัง login อัตโนมัติ</div>
        </form>
      </div>
    );
  }

  if (loading || !profile) {
    return <div className="loading">กำลังโหลด TeamFlow...</div>;
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">✓ ทีมโฟลว์</div>
        <NavButton active={page === "dashboard"} hidden={!isManager} onClick={() => setPage("dashboard")}>▦ ภาพรวมทีม</NavButton>
        <NavButton active={page === "alltasks"} hidden={!isManager} onClick={() => setPage("alltasks")}>☑ งานทั้งหมด</NavButton>
        <NavButton active={page === "mytasks"} onClick={() => setPage("mytasks")}>☑ งานของฉัน</NavButton>
        <NavButton active={page === "myrequests"} onClick={() => setPage("myrequests")}>✉ คำขอของฉัน</NavButton>
        <NavButton active={page === "team"} hidden={!isManager} onClick={() => setPage("team")}>👥 ทีมงาน</NavButton>
        <NavButton active={page === "calendar"} onClick={() => setPage("calendar")}>▣ ปฏิทิน</NavButton>
        <NavButton active={page === "completed"} onClick={() => setPage("completed")}>✓ งานเสร็จแล้ว</NavButton>
        <div className="userbox">
          <div className="smalltxt">กำลังใช้งานในชื่อ</div>
          <div className="who">{currentName} — {profile.role === "manager" ? "หัวหน้าทีม" : "ทีมงาน"}</div>
          <button type="button" onClick={logout}>ออกจากระบบ</button>
        </div>
      </aside>

      <main className="main">
        <div className="top">
          <div>
            <h1>{pageMeta(page)[0]}</h1>
            <div className="sub">{pageMeta(page)[1]}</div>
          </div>
          <button className="btn primary" onClick={openNewTask}>{isManager ? "+ เพิ่มงาน" : "+ เพิ่มงานของฉัน"}</button>
        </div>
        {error ? <div className="runtime-error">{error}</div> : null}

        {page === "dashboard" && (
          <section className="page active">
            <Stats tasks={scopedTasks} />
            <div className="dashgrid">
              <div className="panel">
                <h3>ภาพรวมทีมงาน</h3>
                <MemberOverview profiles={profiles} tasks={tasks} />
              </div>
              <div className="stack">
                <div className="panel">
                  <div className="section-title">
                    <h3>คำขอความช่วยเหลือที่ส่งถึง Jin</h3>
                    <button className="btn small warn" onClick={() => openRequest()}>+ ส่งคำขอ</button>
                  </div>
                  <RequestList requests={dashboardRequests.slice(0, 3)} tasks={tasks} profile={profile} compact onStatus={updateRequestStatus} />
                </div>
                <div className="panel"><h3>งานที่ต้องรีบจัดการ</h3><NoticeList tasks={attentionTasks} /></div>
                <div className="panel"><h3>งานใกล้ถึงกำหนด</h3><NoticeList tasks={scopedTasks.filter(dueSoon)} /></div>
              </div>
            </div>
          </section>
        )}

        {page === "alltasks" && (
          <section className="page active">
            <div className="tabs">
              <button className={`tab ${taskTab === "all" ? "active" : ""}`} onClick={() => setTaskTab("all")}>งานทั้งหมด</button>
              <button className={`tab ${taskTab === "requests" ? "active" : ""}`} onClick={() => setTaskTab("requests")}>คำขอ</button>
            </div>
            {taskTab === "all" ? (
              <>
                <div className="controls">
                  <div className="cgroup">
                    <input className="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่องาน..." />
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                      <option value="">ทุกสถานะ</option>
                      {STATUSES.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </div>
                  <div className="cgroup">
                    <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
                      <option value="">แสดงงานของ: ทุกคน</option>
                      {PEOPLE.map((person) => <option key={person}>{person}</option>)}
                    </select>
                  </div>
                </div>
                <TaskTable tasks={filteredTasks} onEdit={openEditTask} />
              </>
            ) : (
              <div className="panel">
                <div className="section-title">
                  <div><h3>คำขอที่ส่งมาถึงฉัน</h3><div className="sub">ใช้เมื่อทีมงานติดปัญหา ต้องการคำตอบ การอนุมัติ หรือสิ่งที่หัวหน้าต้องช่วย</div></div>
                  <button className="btn warn" onClick={() => openRequest()}>+ ส่งคำขอใหม่</button>
                </div>
                <RequestList requests={incomingRequests} tasks={tasks} profile={profile} onStatus={updateRequestStatus} />
              </div>
            )}
          </section>
        )}

        {page === "mytasks" && (
          <section className="page active">
            <div className="panel">
              <div className="section-title"><h3>งานของฉัน</h3><span className="pill">{profile.role === "manager" ? "หัวหน้าทีม — Jin" : `ทีมงาน — ${currentName}`}</span></div>
              <div className="cgroup filter-row">
                <select value={myStatusFilter} onChange={(event) => setMyStatusFilter(event.target.value)}>
                  <option value="">ทุกสถานะ</option>
                  {STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </div>
              <TaskTable tasks={myTasks} onEdit={openEditTask} personal />
            </div>
          </section>
        )}

        {page === "myrequests" && (
          <section className="page active">
            <div className="panel">
              <div className="section-title">
                <div><h3>คำขอของฉัน</h3><div className="sub">คำขอที่ฉันส่งให้คนอื่น เช่น ขอไฟล์ ขออนุมัติ ขอคำตอบ หรือขอความช่วยเหลือ</div></div>
                <button className="btn warn" onClick={() => openRequest()}>+ ส่งคำขอใหม่</button>
              </div>
              <RequestList requests={sentRequests} tasks={tasks} profile={profile} sent onStatus={updateRequestStatus} />
            </div>
          </section>
        )}

        {page === "team" && <section className="page active"><div className="teamcards"><TeamCards profiles={profiles} tasks={tasks} /></div></section>}

        {page === "calendar" && (
          <section className="page active">
            <div className="panel">
              <div className="cal-toolbar">
                <h3>ปฏิทินงาน — {monthTitle(today)}</h3>
                {isManager ? (
                  <div className="cal-filter">
                    <label htmlFor="calendarOwnerFilter">ดูงานของ</label>
                    <select id="calendarOwnerFilter" value={calendarOwner} onChange={(event) => setCalendarOwner(event.target.value as "all" | PersonName)}>
                      <option value="all">ทุกคน</option>
                      {PEOPLE.map((person) => <option key={person} value={person}>{person}{person === "Jin" ? " — งานของฉัน" : ""}</option>)}
                    </select>
                  </div>
                ) : null}
              </div>
              <div className="cal-legend">
                <Legend who="jin" label="Jin" /><Legend who="ja" label="Ja" /><Legend who="ice" label="Ice" />
                <div className="legend-item"><span className="legend-dot over" /> เลยกำหนด</div>
                <div className="legend-item"><span className="legend-dot done" /> เสร็จแล้ว</div>
              </div>
              <Calendar tasks={calendarTasks(scopedTasks, tasks, calendarOwner, isManager)} />
            </div>
          </section>
        )}

        {page === "completed" && (
          <section className="page active">
            <TaskTable tasks={completedTasks} onEdit={openEditTask} completed />
          </section>
        )}
      </main>

      {taskModalOpen ? (
        <div className="modal open" onMouseDown={(event) => event.target === event.currentTarget && setTaskModalOpen(false)}>
          <form className="modalbox" onSubmit={saveTask}>
            <h2>{editingTask ? "แก้ไข / อัปเดตความคืบหน้า" : "เพิ่มงานใหม่"}</h2>
            <div className="form">
              <Field label="ชื่องาน" full><input disabled={!isManager && Boolean(editingTask)} value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} required /></Field>
              <Field label="รายละเอียด" full><textarea disabled={!isManager && Boolean(editingTask)} rows={3} value={taskForm.description} onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })} /></Field>
              <Field label="คนทำ"><select disabled={!isManager} value={taskForm.assigned_to} onChange={(event) => setTaskForm({ ...taskForm, assigned_to: event.target.value })}>{profiles.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}</select></Field>
              <Field label="สถานะ"><select value={taskForm.status} onChange={(event) => setTaskForm(syncStatus(taskForm, event.target.value as TaskStatus))}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
              <Field label="ความคืบหน้า"><select value={taskForm.progress} onChange={(event) => setTaskForm(syncProgress(taskForm, Number(event.target.value) as Progress))}>{PROGRESS_VALUES.map((p) => <option key={p} value={p}>{p}%</option>)}</select></Field>
              <Field label="ตอนนี้ทำถึงขั้นตอนไหนแล้ว" full><input value={taskForm.current_step} onChange={(event) => setTaskForm({ ...taskForm, current_step: event.target.value })} /></Field>
              <Field label="โน้ต / สิ่งที่ติดอยู่" full><textarea rows={2} value={taskForm.note} onChange={(event) => setTaskForm({ ...taskForm, note: event.target.value })} /></Field>
              <Field label="ประเภทงาน"><select disabled={!isManager && Boolean(editingTask)} value={taskForm.recurrence} onChange={(event) => setTaskForm({ ...taskForm, recurrence: event.target.value as Recurrence })}><option value="once">งานครั้งเดียว</option><option value="daily">↻ งานประจำรายวัน</option><option value="weekly">↻ งานประจำรายสัปดาห์</option><option value="monthly">↻ งานประจำรายเดือน</option></select></Field>
              {taskForm.recurrence === "weekly" || taskForm.recurrence === "monthly" ? <Field label={taskForm.recurrence === "weekly" ? "ทำซ้ำทุก" : "วันที่ของทุกเดือน"}><select disabled={!isManager && Boolean(editingTask)} value={taskForm.recurrence_day} onChange={(event) => setTaskForm({ ...taskForm, recurrence_day: Number(event.target.value) })}>{routineOptions(taskForm.recurrence)}</select></Field> : null}
              {taskForm.recurrence !== "once" ? <div className="field full routine-preview">↻ เมื่อรอบนี้เสร็จ ระบบจะสร้างงานรอบถัดไปและเก็บรอบเดิมไว้ในประวัติ</div> : null}
              {(isManager || !editingTask) ? <Field label="กำหนดส่ง"><input type="date" value={taskForm.due_date} onChange={(event) => setTaskForm({ ...taskForm, due_date: event.target.value })} /></Field> : null}
              <Field label="วันที่สร้าง"><input disabled={!isManager} type="date" value={taskForm.created_at} onChange={(event) => setTaskForm({ ...taskForm, created_at: event.target.value })} /></Field>
              <Field label="วันที่ทำเสร็จ"><input type="date" value={taskForm.completed_date} onChange={(event) => setTaskForm({ ...taskForm, completed_date: event.target.value })} /></Field>
              <div className="field full inline-request-section">
                {!inlineRequestOpen ? (
                  <button type="button" className="btn inline-toggle" onClick={() => setInlineRequestOpen(true)}>＋ ส่งคำขอเกี่ยวกับงานนี้</button>
                ) : (
                  <div>
                    <div className="inline-title">ส่งคำขอ</div>
                    <div className="form">
                      <Field label="ส่งคำขอถึง"><select value={inlineRequest.recipient} onChange={(event) => setInlineRequest({ ...inlineRequest, recipient: event.target.value })}><option value="">— ไม่ส่งคำขอ —</option>{profiles.filter((p) => p.id !== profile.id).map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}</select></Field>
                      <Field label="ประเภทคำขอ"><select value={inlineRequest.type} onChange={(event) => setInlineRequest({ ...inlineRequest, type: event.target.value as RequestType })}>{REQUEST_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
                      <Field label="ความเร่งด่วน"><select value={inlineRequest.urgency} onChange={(event) => setInlineRequest({ ...inlineRequest, urgency: event.target.value as Urgency })}>{URGENCIES.map((u) => <option key={u}>{u}</option>)}</select></Field>
                      <Field label="รายละเอียดคำขอ" full><textarea rows={3} value={inlineRequest.message} onChange={(event) => setInlineRequest({ ...inlineRequest, message: event.target.value })} /></Field>
                    </div>
                    <button type="button" className="btn close-inline" onClick={() => { setInlineRequestOpen(false); setInlineRequest(emptyRequestForm()); }}>ยกเลิกคำขอ</button>
                  </div>
                )}
              </div>
            </div>
            <div className="modalactions">
              {canDeleteEditingTask ? <button type="button" className="btn delete" onClick={deleteTask}>ลบงาน</button> : null}
              <button type="button" className="btn" onClick={() => setTaskModalOpen(false)}>ยกเลิก</button>
              <button className="btn primary" type="submit">บันทึกการเปลี่ยนแปลง</button>
            </div>
          </form>
        </div>
      ) : null}

      {requestModalOpen ? (
        <div className="modal open" onMouseDown={(event) => event.target === event.currentTarget && setRequestModalOpen(false)}>
          <form className="modalbox" onSubmit={saveRequest}>
            <h2>{isManager ? "ส่งคำขอให้ทีมงาน" : "ส่งคำขอให้คนในทีม"}</h2>
            <div className="form">
              <Field label="ผูกกับงาน"><select value={requestForm.task_id} onChange={(event) => setRequestForm({ ...requestForm, task_id: event.target.value })}><option value="">— ไม่ได้ผูกกับงานใด —</option>{scopedTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></Field>
              <Field label="ส่งคำขอถึง"><select value={requestForm.recipient} onChange={(event) => setRequestForm({ ...requestForm, recipient: event.target.value })}>{profiles.filter((p) => p.id !== profile.id).map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}</select></Field>
              <Field label="ประเภทคำขอ"><select value={requestForm.type} onChange={(event) => setRequestForm({ ...requestForm, type: event.target.value as RequestType })}>{REQUEST_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
              <Field label="ความเร่งด่วน"><select value={requestForm.urgency} onChange={(event) => setRequestForm({ ...requestForm, urgency: event.target.value as Urgency })}>{URGENCIES.map((u) => <option key={u}>{u}</option>)}</select></Field>
              <Field label="รายละเอียด" full><textarea rows={4} value={requestForm.message} onChange={(event) => setRequestForm({ ...requestForm, message: event.target.value })} required /></Field>
            </div>
            <div className="modalactions">
              <button type="button" className="btn" onClick={() => setRequestModalOpen(false)}>ยกเลิก</button>
              <button className="btn primary" type="submit">ส่งคำขอ</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function NavButton({ active, hidden, children, onClick }: { active: boolean; hidden?: boolean; children: React.ReactNode; onClick: () => void }) {
  if (hidden) return null;
  return <button className={`navbtn ${active ? "active" : ""}`} onClick={onClick}>{children}</button>;
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return <div className={`field ${full ? "full" : ""}`}><label>{label}</label>{children}</div>;
}

function Stats({ tasks }: { tasks: Task[] }) {
  const items = [
    ["งานทั้งหมด", tasks.length],
    ["ยังไม่เริ่ม", tasks.filter((t) => t.status === "ยังไม่เริ่ม").length],
    ["กำลังทำ", tasks.filter((t) => t.status === "กำลังทำ").length],
    ["รอตรวจ", tasks.filter((t) => t.status === "รอตรวจ").length],
    ["เสร็จแล้ว", tasks.filter((t) => t.status === "เสร็จสิ้น").length],
    ["เกินกำหนด", tasks.filter((t) => overdueDays(t) > 0).length]
  ];
  return <div className="stats">{items.map(([label, value]) => <div className="stat" key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>;
}

function MemberOverview({ profiles, tasks }: { profiles: Profile[]; tasks: Task[] }) {
  return (
    <>
      {profiles.map((profile) => {
        const mine = tasks.filter((task) => task.assigned_to === profile.id);
        return (
          <div className="memberrow" key={profile.id}>
            <div><b>{profile.display_name}</b><div className="sub member-sub">{profile.team_title ?? (profile.role === "manager" ? "หัวหน้าทีม" : "ทีมงาน")}</div></div>
            <div className="chips">
              <span className="pill">ทั้งหมด {mine.length}</span>
              <span className="pill">ยังไม่เริ่ม {mine.filter((t) => t.status === "ยังไม่เริ่ม").length}</span>
              <span className="pill">กำลังทำ {mine.filter((t) => t.status === "กำลังทำ").length}</span>
              <span className="pill red">เลยกำหนด {mine.filter((t) => overdueDays(t) > 0).length}</span>
            </div>
          </div>
        );
      })}
    </>
  );
}

function TeamCards({ profiles, tasks }: { profiles: Profile[]; tasks: Task[] }) {
  return profiles.map((profile) => {
    const mine = tasks.filter((task) => task.assigned_to === profile.id);
    return (
      <div className="teamcard" key={profile.id}>
        <h3>{profile.display_name}</h3>
        <div className="sub">{profile.team_title ?? "ทีมงาน"}</div>
        <div className="mini-grid">
          <Mini label="ทั้งหมด" value={mine.length} />
          <Mini label="ยังไม่เริ่ม" value={mine.filter((t) => t.status === "ยังไม่เริ่ม").length} />
          <Mini label="กำลังทำ" value={mine.filter((t) => t.status === "กำลังทำ").length} />
          <Mini label="เสร็จแล้ว" value={mine.filter((t) => t.status === "เสร็จสิ้น").length} />
        </div>
      </div>
    );
  });
}

function Mini({ label, value }: { label: string; value: number }) {
  return <div className="mini"><b>{value}</b><small>{label}</small></div>;
}

function TaskTable({ tasks, onEdit, personal, completed }: { tasks: Task[]; onEdit: (task: Task) => void; personal?: boolean; completed?: boolean }) {
  if (!tasks.length) {
    return <div className="tablewrap"><table><tbody><tr><td className="empty">ยังไม่มีงาน</td></tr></tbody></table></div>;
  }
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th className="c-name">Aa ชื่อ</th>
            <th className="c-owner">♟ คนทำ</th>
            <th className="c-status">✨ สถานะ</th>
            <th>ความคืบหน้า</th>
            <th className="c-dead">⏰ กำหนดส่ง</th>
            <th className="c-created">▣ วันที่สร้าง</th>
            {!completed ? <th className="c-act">{personal ? "อัปเดต" : "แก้ไข"}</th> : null}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td><button className="tasklink" onClick={() => onEdit(task)}>{task.title}</button>{routineLabel(task) ? <span className="pill routine-label">{routineLabel(task)}</span> : null}<span className="stage-note">{task.current_step}</span>{task.note ? <span className="stage-note">โน้ต: {task.note}</span> : null}</td>
              <td><span className={`owner ${ownerClass(task.assigned_profile?.display_name)}`}>{task.assigned_profile?.display_name ?? "-"}</span></td>
              <td><span className={`status ${statusClass(task.status)}`}>{task.status}</span></td>
              <td><div className="progress-wrap"><b>{task.progress}%</b><div className="progressbar"><div className="progressfill" style={{ width: `${task.progress}%` }} /></div></div></td>
              <td className={overdueDays(task) > 0 ? "dead over" : "dead"}>{dateTH(task.due_date)}{overdueDays(task) > 0 ? <span className="overtext">เลยกำหนด {overdueDays(task)} วัน</span> : null}</td>
              <td>{dateTH(task.created_at)}</td>
              {!completed ? <td><button className="actionbtn edit" onClick={() => onEdit(task)}>{personal ? "อัปเดต" : "แก้ไข"}</button></td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RequestList({ requests, tasks, profile, compact, sent, onStatus }: { requests: HelpRequest[]; tasks: Task[]; profile: Profile; compact?: boolean; sent?: boolean; onStatus: (request: HelpRequest, status: RequestStatus) => void }) {
  if (!requests.length) return <div className="sub">ยังไม่มีคำขอ</div>;
  return (
    <>
      {requests.map((request) => {
        const canRespond = request.recipient === profile.id && request.status !== "แก้ไขแล้ว";
        return (
          <div className={`request-card ${sent ? "sent" : ""}`} key={request.id}>
            <div className="request-head">
              <div>
                <div className="request-title">{request.type}: {request.task?.title ?? tasks.find((task) => task.id === request.task_id)?.title ?? "ไม่ได้ผูกกับงาน"}</div>
                <div className="request-meta">จาก {request.sender_profile?.display_name} → {request.recipient_profile?.display_name} · {dateTH(request.created_at)}</div>
              </div>
              <div><span className={`req-badge ${request.urgency === "ด่วนมาก" ? "red" : request.urgency === "ด่วน" ? "orange" : ""}`}>{request.urgency}</span></div>
            </div>
            {!compact ? <div className="request-msg">{request.message}</div> : null}
            <div className="req-actions">
              <span className={`pill ${request.status === "แก้ไขแล้ว" ? "success" : request.status === "กำลังช่วย" ? "warn" : ""}`}>{request.status}</span>
              {canRespond ? <button className="btn small warn" onClick={() => onStatus(request, "กำลังช่วย")}>รับเรื่อง</button> : null}
              {canRespond ? <button className="btn small success" onClick={() => onStatus(request, "แก้ไขแล้ว")}>แก้ไขแล้ว</button> : null}
            </div>
          </div>
        );
      })}
    </>
  );
}

function NoticeList({ tasks }: { tasks: Task[] }) {
  if (!tasks.length) return <div className="sub">ยังไม่มีงานในกลุ่มนี้</div>;
  return (
    <>
      {tasks.slice(0, 5).map((task) => <div className="notice" key={task.id}><b>{task.title}</b><span className={`pill ${overdueDays(task) > 0 ? "red" : "orange"}`}>{overdueDays(task) > 0 ? `เลย ${overdueDays(task)} วัน` : dateTH(task.due_date)}</span></div>)}
    </>
  );
}

function Calendar({ tasks }: { tasks: Task[] }) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: React.ReactNode[] = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."].map((name) => <div className="dow" key={name}>{name}</div>);
  for (let i = 0; i < firstDay; i += 1) cells.push(<div key={`blank-${i}`} />);
  for (let day = 1; day <= days; day += 1) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const events = tasks.filter((task) => task.due_date === iso);
    cells.push(
      <div className="day" key={iso}>
        <b>{day}</b>
        {events.map((task) => {
          const done = task.status === "เสร็จสิ้น";
          const od = overdueDays(task);
          return <div className={`event ${ownerClass(task.assigned_profile?.display_name)} ${done ? "done" : ""} ${od > 0 ? "overdue" : ""}`} key={task.id}>{done ? <span className="done-mark">✓</span> : null}{task.title}{od > 0 ? <span className="warn">เลยกำหนด {od} วัน</span> : null}</div>;
        })}
      </div>
    );
  }
  return <div className="calendar">{cells}</div>;
}

function Legend({ who, label }: { who: string; label: string }) {
  return <div className="legend-item"><span className={`legend-dot ${who}`} /> งานของ {label}</div>;
}

function syncStatus(form: TaskForm, status: TaskStatus): TaskForm {
  if (status === "ยังไม่เริ่ม") return { ...form, status, progress: 0 };
  if (status === "กำลังทำ" && form.progress === 0) return { ...form, status, progress: 50 };
  if (status === "เสร็จสิ้น") return { ...form, status, progress: 100, completed_date: form.completed_date || isoDate(today) };
  return { ...form, status };
}

function syncProgress(form: TaskForm, progress: Progress): TaskForm {
  if (progress === 100) return { ...form, progress, status: "เสร็จสิ้น", completed_date: form.completed_date || isoDate(today) };
  return { ...form, progress };
}

function calendarTasks(scoped: Task[], all: Task[], owner: "all" | PersonName, isManager: boolean) {
  if (!isManager) return scoped;
  if (owner === "all") return all;
  return all.filter((task) => task.assigned_profile?.display_name === owner);
}

function routineOptions(recurrence: Recurrence) {
  if (recurrence === "weekly") {
    return ["วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์", "วันอาทิตย์"].map((day, index) => <option key={day} value={index + 1}>{day}</option>);
  }
  return Array.from({ length: 31 }, (_, index) => <option key={index + 1} value={index + 1}>วันที่ {index + 1}</option>);
}

function pageMeta(page: PageId) {
  return {
    dashboard: ["ภาพรวมงานของทีม", "ดูภาพรวมงาน กำหนดส่ง และความคืบหน้าของทุกคน"],
    alltasks: ["งานทั้งหมด", "ดูรายละเอียดงานทั้งหมดในตารางเดียว"],
    mytasks: ["งานของฉัน", "แสดงเฉพาะงานที่มอบหมายให้ฉัน"],
    myrequests: ["คำขอของฉัน", "ดูคำขอที่ฉันส่งให้คนอื่น รวมถึงงานที่ต้องส่งต่อให้ทีม"],
    team: ["ทีมงาน", "ดูภาพรวมของ Jin, Ja และ Ice"],
    calendar: ["ปฏิทิน", "ดูงานตามกำหนดส่ง"],
    completed: ["งานเสร็จแล้ว", "ดูงานที่ปิดเรียบร้อยแล้ว"]
  }[page];
}

function ownerClass(name?: PersonName) {
  if (name === "Jin") return "jin";
  if (name === "Ice") return "ice";
  return "ja";
}

function statusClass(status: TaskStatus) {
  return status === "เสร็จสิ้น" ? "st-done" : status === "กำลังทำ" || status === "รอตรวจ" ? "st-doing" : "st-todo";
}

function routineLabel(task: Task) {
  return task.recurrence === "daily" ? "↻ ทุกวัน" : task.recurrence === "weekly" ? "↻ ทุกสัปดาห์" : task.recurrence === "monthly" ? "↻ ทุกเดือน" : "";
}

function overdueDays(task: Task) {
  if (!task.due_date || task.status === "เสร็จสิ้น") return 0;
  return Math.max(0, Math.floor((today.getTime() - new Date(`${task.due_date}T23:59:59`).getTime()) / 86400000));
}

function dueSoon(task: Task) {
  if (!task.due_date || task.status === "เสร็จสิ้น") return false;
  const diff = (new Date(`${task.due_date}T00:00:00`).getTime() - new Date(isoDate(today)).getTime()) / 86400000;
  return diff >= 0 && diff <= 3;
}

function dateTH(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getDate()} ${months[date.getMonth()]} ${String(date.getFullYear() + 543).slice(-2)}`;
}

function monthTitle(date: Date) {
  const months = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  return `${months[date.getMonth()]} ${date.getFullYear() + 543}`;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}









