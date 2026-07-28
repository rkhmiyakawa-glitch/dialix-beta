import { supabase } from "../lib/supabase";

function ensureClient() {
  if (!supabase) throw new Error("Supabaseが設定されていません。");
}

export async function fetchMyShifts(userId, month) {
  ensureClient();
  const start = `${month}-01`;
  const endDate = new Date(Number(month.slice(0,4)), Number(month.slice(5,7)), 0);
  const end = `${month}-${String(endDate.getDate()).padStart(2,"0")}`;
  const { data, error } = await supabase.from("shifts").select("*").eq("user_id", userId).gte("shift_date", start).lte("shift_date", end).order("shift_date");
  if (error) throw error;
  return data || [];
}

export async function fetchAllShifts(month) {
  ensureClient();
  const start = `${month}-01`;
  const endDate = new Date(Number(month.slice(0,4)), Number(month.slice(5,7)), 0);
  const end = `${month}-${String(endDate.getDate()).padStart(2,"0")}`;
  const { data, error } = await supabase.from("shifts").select("*").gte("shift_date", start).lte("shift_date", end).order("shift_date");
  if (error) throw error;
  return data || [];
}

export async function saveShift(payload) {
  ensureClient();
  const row = { user_id: payload.userId, shift_date: payload.shiftDate, start_time: payload.isOff ? null : payload.startTime, end_time: payload.isOff ? null : payload.endTime, break_minutes: Number(payload.breakMinutes || 0), memo: payload.memo || "", is_off: Boolean(payload.isOff) };
  const { data, error } = await supabase.from("shifts").upsert(row, { onConflict: "user_id,shift_date" }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteShift(id) {
  ensureClient();
  const { error } = await supabase.from("shifts").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchMyAttendance(userId, month) {
  ensureClient();
  const start = `${month}-01`;
  const endDate = new Date(Number(month.slice(0,4)), Number(month.slice(5,7)), 0);
  const end = `${month}-${String(endDate.getDate()).padStart(2,"0")}`;
  const { data, error } = await supabase.from("attendance_records").select("*").eq("user_id", userId).gte("work_date", start).lte("work_date", end).order("work_date", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function clockIn(userId) {
  ensureClient();
  const now = new Date();
  const workDate = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  const { data, error } = await supabase.from("attendance_records").upsert({ user_id: userId, work_date: workDate, clock_in: now.toISOString() }, { onConflict: "user_id,work_date" }).select().single();
  if (error) throw error;
  return data;
}

export async function clockOut(userId) {
  ensureClient();
  const now = new Date();
  const workDate = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  const { data, error } = await supabase.from("attendance_records").update({ clock_out: now.toISOString() }).eq("user_id", userId).eq("work_date", workDate).select().single();
  if (error) throw error;
  return data;
}
