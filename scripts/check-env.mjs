import { existsSync, readFileSync } from "node:fs";

if (!existsSync(".env.local")) {
  console.log("NO_FILE");
  process.exit(0);
}

const content = readFileSync(".env.local", "utf8");
for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "JIN_PASSWORD",
  "JA_PASSWORD",
  "ICE_PASSWORD"
]) {
  const value = content.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1] ?? "";
  console.log(`${key}=${value ? "SET" : "EMPTY_OR_MISSING"}`);
}
