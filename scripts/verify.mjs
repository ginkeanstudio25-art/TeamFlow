import { readFileSync } from "node:fs";

const requiredFiles = [
  "app/page.tsx",
  "app/globals.css",
  "lib/supabase.ts",
  "supabase/schema.sql",
  ".env.example"
];

for (const file of requiredFiles) {
  readFileSync(file, "utf8");
}

const schema = readFileSync("supabase/schema.sql", "utf8");
const app = readFileSync("app/page.tsx", "utf8");

const checks = [
  ["RLS enabled for tasks", /alter table public\.tasks enable row level security/i.test(schema)],
  ["RLS enabled for requests", /alter table public\.requests enable row level security/i.test(schema)],
  ["member task update trigger", /enforce_task_update_permissions/.test(schema)],
  ["routine task trigger", /create_next_routine_task/.test(schema)],
  ["Supabase auth login", /signInWithPassword/.test(app)],
  ["no localStorage data layer", !/localStorage/.test(app)]
];

const failed = checks.filter(([, passed]) => !passed);
if (failed.length) {
  console.error("Verification failed:");
  for (const [label] of failed) console.error(`- ${label}`);
  process.exit(1);
}

console.log("TeamFlow verification passed.");
