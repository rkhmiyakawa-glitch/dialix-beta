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

export async function saveShifts(userId, dates, settings) {
  ensureClient();
  const rows = dates.map((shiftDate) => ({
    user_id: userId, shift_date: shiftDate,
    start_time: settings.isOff ? null : settings.startTime,
    end_time: settings.isOff ? null : settings.endTime,
    break_minutes: Number(settings.breakMinutes || 0),
    memo: settings.memo || "", is_off: Boolean(settings.isOff),
  }));
  const { data, error } = await supabase.from("shifts").upsert(rows, { onConflict: "user_id,shift_date" }).select();
  if (error) throw error;
  return data || [];
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

export async function fetchAllAttendance(month) {
  ensureClient();
  const start = `${month}-01`;
  const endDate = new Date(Number(month.slice(0,4)), Number(month.slice(5,7)), 0);
  const end = `${month}-${String(endDate.getDate()).padStart(2,"0")}`;
  const { data, error } = await supabase.from("attendance_records").select("*").gte("work_date", start).lte("work_date", end).order("work_date", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function submitAttendanceCorrectionRequest(payload) {
  ensureClient();
  const row = {
    user_id: payload.userId,
    work_date: payload.workDate,
    requested_clock_in: payload.clockIn || null,
    requested_clock_out: payload.clockOut || null,
    reason_type: payload.reasonType,
    reason_detail: payload.reasonDetail || "",
    status: "pending",
  };
  const { data, error } = await supabase.from("attendance_correction_requests").insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function fetchMyAttendanceCorrectionRequests(userId) {
  ensureClient();
  const { data, error } = await supabase.from("attendance_correction_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchAttendanceCorrectionRequests(status = "pending") {
  ensureClient();
  let query = supabase.from("attendance_correction_requests").select("*").order("created_at", { ascending: false });
  if (status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function updateAttendanceRecordAsManager(payload) {
  ensureClient();
  const row = {
    user_id: payload.userId,
    work_date: payload.workDate,
    clock_in: payload.clockIn || null,
    clock_out: payload.clockOut || null,
    break_minutes: Number(payload.breakMinutes || 0),
    correction_reason: payload.reason || "管理者修正",
    corrected_by: payload.managerId,
    corrected_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("attendance_records").upsert(row, { onConflict: "user_id,work_date" }).select().single();
  if (error) throw error;
  return data;
}

export async function resolveAttendanceCorrectionRequest(payload) {
  ensureClient();
  if (payload.status === "approved") {
    await updateAttendanceRecordAsManager({
      userId: payload.userId,
      workDate: payload.workDate,
      clockIn: payload.clockIn,
      clockOut: payload.clockOut,
      breakMinutes: payload.breakMinutes,
      reason: payload.managerNote || "勤怠修正依頼を承認",
      managerId: payload.managerId,
    });
  }
  const { data, error } = await supabase.from("attendance_correction_requests").update({
    status: payload.status,
    manager_note: payload.managerNote || "",
    reviewed_by: payload.managerId,
    reviewed_at: new Date().toISOString(),
  }).eq("id", payload.requestId).select().single();
  if (error) throw error;
  return data;
}
