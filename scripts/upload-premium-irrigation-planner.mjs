import { readFile } from "node:fs/promises";

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in this trusted shell.");
}

const file = new URL("../supabase/private-assets/irrigation-planner/index.html", import.meta.url);
const html = await readFile(file);
const response = await fetch(`${supabaseUrl}/storage/v1/object/premium-tools/irrigation-planner/index.html`, {
  method: "POST",
  headers: {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    "content-type": "text/html; charset=utf-8",
    "x-upsert": "true",
  },
  body: html,
});

if (!response.ok) {
  throw new Error(`Private planner upload failed with HTTP ${response.status}.`);
}

process.stdout.write("Uploaded the irrigation planner to the private premium-tools bucket.\n");
