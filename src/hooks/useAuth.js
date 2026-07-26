import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentSession, refreshCurrentSession, signIn, signOut, subscribeAuth } from "../services/authService";
import { isSupabaseConfigured } from "../lib/supabase";

export default function useAuth() {
  const [session, setSession] = useState(null);
  const sessionRef = useRef(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [sessionState, setSessionState] = useState("ready");

  const updateSession = useCallback((nextSession) => {
    sessionRef.current = nextSession;
    setSession(nextSession);
  }, []);

  const recoverSession = useCallback(async () => {
    if (!isSupabaseConfigured) return null;
    setSessionState("recovering");
    try {
      const nextSession = await refreshCurrentSession();
      updateSession(nextSession);
      setSessionState(nextSession ? "ready" : "expired");
      return nextSession;
    } catch {
      setSessionState("offline");
      return null;
    }
  }, [updateSession]);

  useEffect(() => {
    let mounted = true;

    getCurrentSession()
      .then((currentSession) => {
        if (mounted) updateSession(currentSession);
      })
      .catch(() => {
        if (mounted) setSessionState("offline");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    // 認証監視は初回マウント時に1回だけ登録する。
    // sessionを依存配列に含めると、INITIAL_SESSION通知のたびに再登録され、
    // APIリクエストが無限に増える原因になる。
    const unsubscribe = subscribeAuth((nextSession, event) => {
      if (!mounted) return;
      updateSession(nextSession);
      setLoading(false);
      if (event === "TOKEN_REFRESH_FAILED" || (!nextSession && event !== "SIGNED_OUT")) {
        setSessionState("expired");
      } else {
        setSessionState("ready");
      }
    });

    const onVisibility = () => {
      if (document.visibilityState === "visible" && sessionRef.current) {
        recoverSession();
      }
    };
    const onOnline = () => {
      if (sessionRef.current) recoverSession();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);

    return () => {
      mounted = false;
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [recoverSession, updateSession]);

  async function login(email, password) {
    const result = await signIn(email, password);
    updateSession(result.session);
    setSessionState("ready");
    return result;
  }

  async function logout() {
    await signOut();
    updateSession(null);
  }

  return { session, loading, login, logout, recoverSession, sessionState, demoMode: !isSupabaseConfigured };
}
