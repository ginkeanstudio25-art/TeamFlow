import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

loadDotEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const users = [
  {
    email: process.env.JIN_EMAIL || "jin@teamflow.local",
    password: process.env.JIN_PASSWORD,
    display_name: "Jin",
    role: "manager",
    team_title: "หัวหน้าทีม"
  },
  {
    email: process.env.JA_EMAIL || "ja@teamflow.local",
    password: process.env.JA_PASSWORD,
    display_name: "Ja",
    role: "member",
    team_title: "คอนเทนต์ / ผู้ช่วยงาน"
  },
  {
    email: process.env.ICE_EMAIL || "ice@teamflow.local",
    password: process.env.ICE_PASSWORD,
    display_name: "Ice",
    role: "member",
    team_title: "งานภาพ / งานหลังบ้าน"
  }
];

if (!supabaseUrl || !serviceRoleKey) {
  fail("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
}

const missingPassword = users.find((user) => !user.password);
if (missingPassword) {
  fail(`Missing password for ${missingPassword.display_name}. Set JIN_PASSWORD, JA_PASSWORD, and ICE_PASSWORD in .env.local`);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

for (const userConfig of users) {
  const existing = await findUserByEmail(userConfig.email);
  const authUser = existing
    ? await updateUser(existing.id, userConfig)
    : await createUser(userConfig);

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({
      id: authUser.id,
      display_name: userConfig.display_name,
      role: userConfig.role,
      team_title: userConfig.team_title
    });

  if (profileError) fail(`Profile setup failed for ${userConfig.display_name}: ${profileError.message}`);

  console.log(`${userConfig.display_name} ready: ${userConfig.email}`);
}

console.log("TeamFlow users and profiles are ready.");

async function createUser(userConfig) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: userConfig.email,
    password: userConfig.password,
    email_confirm: true,
    user_metadata: { display_name: userConfig.display_name }
  });

  if (error) fail(`Create user failed for ${userConfig.display_name}: ${error.message}`);
  return data.user;
}

async function updateUser(id, userConfig) {
  const { data, error } = await supabase.auth.admin.updateUserById(id, {
    email: userConfig.email,
    password: userConfig.password,
    email_confirm: true,
    user_metadata: { display_name: userConfig.display_name }
  });

  if (error) fail(`Update user failed for ${userConfig.display_name}: ${error.message}`);
  return data.user;
}

async function findUserByEmail(email) {
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) fail(`Could not list Supabase users: ${error.message}`);
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 100) return null;
    page += 1;
  }
}

function loadDotEnvLocal() {
  if (!existsSync(".env.local")) return;
  const content = readFileSync(".env.local", "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
