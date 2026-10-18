// Edge Function: admin-users
// Mengelola akun (buat, ubah, atur ulang password, hapus) dengan service role.
// Semua aksi kecuali "bootstrap" hanya dilayani untuk Superadmin aktif.
// Deploy dengan verify_jwt = false (fungsi memeriksa token sendiri).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const DOMAIN = "users.pantaubiaya.id";
const emailOf = (u: string) => `${u.toLowerCase().replace(/[^a-z0-9._-]/g, "")}@${DOMAIN}`;
const ROLES = ["superadmin", "rs", "rs_view"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Metode tidak didukung" }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Body tidak valid" }, 400); }
  const action = body?.action;

  try {
    // ---------- penyiapan awal: hanya bila belum ada superadmin ----------
    if (action === "bootstrap") {
      const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "superadmin");
      if ((count ?? 0) > 0) return json({ error: "Sistem sudah disiapkan" }, 403);
      const { username, password, nama } = body;
      if (!username || !password || String(password).length < 6) return json({ error: "Username dan password (min. 6) wajib" }, 400);
      const { data, error } = await admin.auth.admin.createUser({ email: emailOf(username), password, email_confirm: true });
      if (error) return json({ error: error.message }, 400);
      const { error: e2 } = await admin.from("profiles").insert({ id: data.user.id, username: username.toLowerCase(), nama: nama || username, role: "superadmin" });
      if (e2) { await admin.auth.admin.deleteUser(data.user.id); return json({ error: e2.message }, 400); }
      return json({ ok: true, email: emailOf(username) });
    }

    // ---------- aksi lain: wajib superadmin aktif ----------
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: who, error: ue } = await admin.auth.getUser(jwt);
    if (ue || !who?.user) return json({ error: "Sesi tidak valid, silakan login ulang" }, 401);
    const { data: me } = await admin.from("profiles").select("*").eq("id", who.user.id).single();
    if (!me || !me.aktif || me.role !== "superadmin") return json({ error: "Hanya Superadmin yang boleh mengelola akun" }, 403);

    if (action === "create") {
      const { username, password, nama, role, hospital_id, aktif } = body;
      if (!username || !password || String(password).length < 6) return json({ error: "Username dan password (min. 6) wajib" }, 400);
      if (!ROLES.includes(role)) return json({ error: "Peran tidak dikenal" }, 400);
      if (role !== "superadmin" && !hospital_id) return json({ error: "Akun RS wajib memilih rumah sakit" }, 400);
      const { data, error } = await admin.auth.admin.createUser({ email: emailOf(username), password, email_confirm: true });
      if (error) return json({ error: error.message.includes("already") ? "Username sudah dipakai" : error.message }, 400);
      const { error: e2 } = await admin.from("profiles").insert({ id: data.user.id, username: username.toLowerCase(), nama: nama || username, role, hospital_id: role === "superadmin" ? null : hospital_id, aktif: aktif !== false });
      if (e2) { await admin.auth.admin.deleteUser(data.user.id); return json({ error: e2.message }, 400); }
      return json({ ok: true, id: data.user.id });
    }
    if (action === "update") {
      const { id, username, nama, role, hospital_id, aktif } = body;
      if (!ROLES.includes(role)) return json({ error: "Peran tidak dikenal" }, 400);
      if (id === me.id && role !== "superadmin") return json({ error: "Tidak bisa menurunkan peran akun sendiri" }, 400);
      if (username) { const { error } = await admin.auth.admin.updateUserById(id, { email: emailOf(username), email_confirm: true }); if (error) return json({ error: error.message }, 400); }
      const { error } = await admin.from("profiles").update({ username: username?.toLowerCase(), nama, role, hospital_id: role === "superadmin" ? null : hospital_id, aktif: aktif !== false }).eq("id", id);
      if (error) return json({ error: error.message }, 400);
      if (aktif === false) await admin.auth.admin.signOut(id).catch(() => {});
      return json({ ok: true });
    }
    if (action === "reset_password") {
      const { id, password } = body;
      if (!password || String(password).length < 6) return json({ error: "Password minimal 6 karakter" }, 400);
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    if (action === "delete") {
      if (body.id === me.id) return json({ error: "Tidak bisa menghapus akun sendiri" }, 400);
      const { error } = await admin.auth.admin.deleteUser(body.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    if (action === "delete_non_superadmin") {
      const { data: list } = await admin.from("profiles").select("id").neq("role", "superadmin");
      for (const p of list || []) await admin.auth.admin.deleteUser(p.id);
      return json({ ok: true, deleted: (list || []).length });
    }
    return json({ error: "Aksi tidak dikenal" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
