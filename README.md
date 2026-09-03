# TeamFlow

TeamFlow คือเว็บแอปจัดการงานทีมภาษาไทยที่ย้ายจาก prototype `TeamFlow.html` มาเป็น Next.js + Supabase + Vercel โดยยังคง sidebar, dashboard, ตารางงาน, modal, request form และ calendar workflow เดิมไว้ให้มากที่สุด

## สิ่งที่เปลี่ยนจาก prototype เดิม

- Login ใช้ Supabase Authentication จริง ไม่ใช้ password ที่ hard-code ใน frontend
- ข้อมูล tasks และ requests เก็บใน Supabase tables ไม่ใช้ `localStorage` เป็นฐานข้อมูลหลัก
- สิทธิ์ของ Jin, Ja และ Ice มาจาก table `profiles` หลัง login อัตโนมัติ
- Supabase RLS ป้องกันไม่ให้ member query หรือแก้ข้อมูลที่ไม่มีสิทธิ์ แม้แก้ frontend เอง
- Routine task สร้างรอบใหม่ด้วย database trigger เมื่อปิดงานเดิมเป็น `เสร็จสิ้น`

## Architecture

- `app/page.tsx` คือหน้า TeamFlow หลักแบบ client-side React
- `app/globals.css` เก็บ style ที่ย้ายมาจาก prototype เดิม
- `lib/supabase.ts` สร้าง Supabase browser client ด้วย anon key เท่านั้น
- `lib/types.ts` เก็บ type ของ profiles, tasks และ requests
- `supabase/schema.sql` สร้าง tables, foreign keys, triggers และ RLS policies
- `supabase/seed.sql` เพิ่มข้อมูลงานตัวอย่างหลังสร้าง users/profiles แล้ว

## 1. สร้าง Supabase project

1. เข้า Supabase แล้วสร้าง project ใหม่
2. ไปที่ SQL Editor
3. เปิดไฟล์ `supabase/schema.sql`
4. Copy SQL ทั้งหมดไปรันใน SQL Editor

หลังรันเสร็จจะได้ tables หลัก:

- `profiles`
- `tasks`
- `requests`

## 2. สร้างผู้ใช้ 3 คน

ไปที่ Supabase Dashboard > Authentication > Users แล้วสร้าง user 3 คน:

- Jin
- Ja
- Ice

ตั้ง email และ password เองใน Supabase Dashboard ห้ามนำ password มาใส่ใน source code

หรือใช้สคริปต์ admin ของโปรเจกต์นี้เพื่อสร้าง/อัปเดต users และ profiles อัตโนมัติ:

1. เพิ่มค่าต่อไปนี้ใน `.env.local`
2. ใส่ password ตามที่ต้องการใช้จริง
3. รัน `npm run setup:users`

```bash
SUPABASE_SERVICE_ROLE_KEY=service-role-key-from-supabase
JIN_EMAIL=jin@teamflow.local
JA_EMAIL=ja@teamflow.local
ICE_EMAIL=ice@teamflow.local
JIN_PASSWORD=ใส่รหัสของ Jin
JA_PASSWORD=ใส่รหัสของ Ja
ICE_PASSWORD=ใส่รหัสของ Ice
```

`SUPABASE_SERVICE_ROLE_KEY` ใช้เฉพาะบนเครื่องตอน setup เท่านั้น ห้ามนำไปตั้งเป็น public client env และห้ามใช้ชื่อขึ้นต้นด้วย `NEXT_PUBLIC_`

## 3. เพิ่ม profiles

หลังสร้าง Auth users แล้ว ให้ copy UUID ของแต่ละ user จากหน้า Authentication > Users แล้วรัน SQL นี้ใน SQL Editor โดยแทนค่า UUID ให้ตรงกับ user จริง:

```sql
insert into public.profiles (id, display_name, role, team_title) values
  ('UUID-ของ-Jin', 'Jin', 'manager', 'หัวหน้าทีม'),
  ('UUID-ของ-Ja', 'Ja', 'member', 'คอนเทนต์ / ผู้ช่วยงาน'),
  ('UUID-ของ-Ice', 'Ice', 'member', 'งานภาพ / งานหลังบ้าน');
```

## 4. เพิ่มข้อมูลตัวอย่าง

ถ้าต้องการข้อมูลเริ่มต้นจาก prototype ให้รันไฟล์ `supabase/seed.sql` ใน SQL Editor หลังเพิ่ม profiles แล้ว

## 5. ตั้งค่า environment

สร้างไฟล์ `.env.local` ที่ root project:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

หา 2 ค่านี้ได้จาก Supabase Dashboard > Project Settings > API

ใช้เฉพาะ anon public key ใน frontend เท่านั้น ห้ามใส่ service role key ใน `.env.local`, Vercel env หรือ source code ฝั่ง client

## 6. รันบนเครื่อง

```bash
npm install
npm run dev
```

เปิด `http://localhost:3000` แล้ว login ด้วย email/password ที่สร้างไว้ใน Supabase

## 7. ทดสอบสิทธิ์

ควรทดสอบครบ 3 users:

- Login เป็น Jin แล้วตรวจว่าเห็นงานทุกคน เพิ่ม/แก้/ลบงานได้ และมอบหมายงานให้ Jin/Ja/Ice ได้
- Login เป็น Ja แล้วตรวจว่าเห็นเฉพาะงานของ Ja ในหน้ารายการงาน และแก้ได้เฉพาะ status, progress, current step, note, completed date
- Login เป็น Ice แล้วตรวจแบบเดียวกับ Ja
- ลองแก้ request status จากผู้รับคำขอ
- ลองปิด routine task เป็น `เสร็จสิ้น` แล้วตรวจว่ามี task รอบใหม่ถูกสร้าง โดย task รอบเดิมยังอยู่เป็น history

## 8. Deploy Vercel

1. Push project นี้ขึ้น GitHub
2. เข้า Vercel แล้ว Import project
3. ตั้ง Framework เป็น Next.js
4. เพิ่ม Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. กด Deploy

หลัง deploy แล้วให้เข้า Supabase Dashboard > Authentication > URL Configuration และเพิ่ม Vercel URL ใน allowed redirect/site URL ตามโดเมนที่ใช้งานจริง

## 9. แจ้งเตือน LINE

ระบบรองรับ LINE Messaging API แบบส่งแจ้งเตือนเข้ากลุ่มทีม โดยข้อความใน LINE จะเป็นข้อความสั้น ๆ เช่น มีงานใหม่หรือมีคำขอใหม่ และให้เปิดเว็บ TeamFlow เพื่อดูรายละเอียดหลัง login

1. ใน LINE Official Account Manager เปิด Messaging API
2. ตั้ง Webhook URL เป็น `https://teamflow-workapp.vercel.app/api/line/webhook`
3. เปิดใช้งาน Webhook
4. ใน Vercel > Project > Environment Variables เพิ่มค่าเหล่านี้:
   - `SUPABASE_SERVICE_ROLE_KEY` ใช้เฉพาะ server-side เท่านั้น ห้ามตั้งเป็น `NEXT_PUBLIC_`
   - `LINE_CHANNEL_SECRET`
   - `LINE_CHANNEL_ACCESS_TOKEN`
5. Redeploy หนึ่งครั้ง
6. เพิ่ม LINE Official Account เข้ากลุ่มทีม แล้วพิมพ์ `ไอดีกลุ่ม`
7. นำค่าที่บอทตอบกลับมาใส่ใน Vercel เป็น `LINE_GROUP_ID`
8. Redeploy อีกครั้ง

หลังจากนั้น เมื่อมีการสร้างงานใหม่หรือส่งคำขอใหม่ ระบบจะส่งแจ้งเตือนเข้ากลุ่ม LINE
## คำสั่งตรวจคุณภาพ

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Security Notes

- RLS เปิดอยู่บน `profiles`, `tasks` และ `requests`
- Manager เห็นและจัดการ tasks ทั้งหมด
- Member เห็นเฉพาะ tasks ที่ assigned ให้ตัวเอง
- Member update task ได้เฉพาะ `status`, `progress`, `current_step`, `note`, `completed_date`
- Member ลบงานไม่ได้และสร้างงานเองไม่ได้
- Requests เห็นได้เฉพาะ manager หรือผู้ที่เป็น sender/recipient
- Password ถูกจัดการโดย Supabase Auth เท่านั้น

