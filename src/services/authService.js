import { isSupabaseConfigured, supabase } from "../lib/supabase";

export async function getCurrentSession() {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signIn(email, password) {
  if (!isSupabaseConfigured) {
    return {
      session: {
        user: {
          id: "demo-user",
          email: email || "demo@dialix.local",
        },
      },
      demoMode: true,
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return { session: data.session, demoMode: false };
}

export async function signOut() {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function refreshCurrentSession() {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.auth.refreshSession();
  if (error) throw error;
  return data.session;
}

export function subscribeAuth(callback) {
  if (!isSupabaseConfigured) return () => {};

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session, event);
  });

  return () => subscription.unsubscribe();
}
