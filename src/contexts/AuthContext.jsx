import { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Refs to prevent concurrent operations in React Strict Mode
  const initInProgress = useRef(false);
  const abortController = useRef(null);

  // Fetch profile from database with abort handling
  const fetchProfile = async (userId, signal) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (signal?.aborted) return null;

      if (error) {
        // Silently handle common React Strict Mode errors
        if (error.message?.includes('Lock broken') || error.message?.includes('AbortError')) {
          console.warn("[AUTH] Profile fetch aborted (likely React Strict Mode)");
          return null;
        }
        console.error("[AUTH] Profile fetch error:", error);
        return null;
      }

      setProfile(data);
      return data;
    } catch (err) {
      if (signal?.aborted || err.name === 'AbortError') {
        console.warn("[AUTH] Profile fetch aborted");
        return null;
      }
      console.error("[AUTH] Profile fetch failed:", err);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;
    let timeoutId;

    const initializeAuth = async () => {
      if (initInProgress.current) return;
      initInProgress.current = true;
      console.log("[AUTH] Initializing session...");

      if (abortController.current) abortController.current.abort();
      abortController.current = new AbortController();

      try {
        // Race the session fetch against a 10s timeout
        const { data, error } = await Promise.race([
          supabase.auth.getSession(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('SESSION_TIMEOUT')), 10000))
        ]);

        if (!mounted) return;
        if (error) throw error;

        const session = data?.session;
        if (session?.user) {
          setUser(session.user);
          // Fetch profile but don't block the critical path for too long
          Promise.race([
            fetchProfile(session.user.id, abortController.current?.signal),
            new Promise((_, reject) => setTimeout(() => reject(new Error('PROFILE_TIMEOUT')), 5000))
          ]).catch(e => console.warn("[AUTH] Profile fetch delayed:", e.message));
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (err) {
        if (!mounted || err.name === 'AbortError') return;
        console.warn("[AUTH] Initialization warning:", err.message);
        // Don't clear user here if it might have been set by onAuthStateChange
      } finally {
        if (mounted) {
          setLoading(false);
          initInProgress.current = false;
        }
      }
    };

    // Safety timeout - force loading to false after 10 seconds if everything else fails
    timeoutId = setTimeout(() => {
      if (mounted && loading) {
        console.warn("[AUTH] Global initialization timeout reached");
        setLoading(false);
        initInProgress.current = false;
      }
    }, 10000);

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log("[AUTH] State event:", event, session?.user?.id ? "(User found)" : "(No user)");

      // Force route to reset password if we detect recovery link flow
      if (event === 'PASSWORD_RECOVERY') {
        window.location.href = '/reset-password';
      }

      if (session?.user) {
        setUser(session.user);
        // Non-blocking profile fetch for state changes
        fetchProfile(session.user.id).catch(err => console.error("[AUTH] Profile sync error:", err));
      } else {
        setUser(null);
        setProfile(null);
      }

      // Always clear loading if we get a state change
      if (loading) setLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      if (abortController.current) {
        abortController.current.abort();
      }
      initInProgress.current = false;
      subscription.unsubscribe();
    };
  }, []);

  // SIGN UP
  const signUp = async ({ email, password, name, role = "student" }) => {
    try {
      if (!email || !password || !name) {
        throw new Error("Email, password and name are required");
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role,
          },
        },
      });

      if (error) {
        if (error.message.includes("User already registered")) {
          throw new Error("Email already registered. Please login.");
        }

        if (error.message.includes("rate limit")) {
          throw new Error("Too many signup attempts. Please try later.");
        }

        throw error;
      }

      return data;
    } catch (err) {
      console.error("[AUTH] Signup failed:", err);
      throw err;
    }
  };

  // SIGN IN
  const signIn = async ({ email, password }) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      return data;
    } catch (err) {
      console.error("[AUTH] SignIn failed:", err);
      throw err;
    }
  };

  // SIGN OUT
  const signOut = async () => {
    try {
      console.log("[AUTH] Signing out...");
      await supabase.auth.signOut();
      console.log("[AUTH] Supabase sign out completed");

      // Immediately clear state
      setUser(null);
      setProfile(null);
      setLoading(false);

      console.log("[AUTH] User and profile reset, loading set to false");
    } catch (err) {
      if (err.message?.includes('Lock broken') || err.message?.includes('AbortError')) {
        console.warn("[AUTH] Sign out aborted (likely React Strict Mode), clearing state anyway");
        // Even if sign out fails due to lock issues, clear the local state
        setUser(null);
        setProfile(null);
        setLoading(false);
      } else {
        console.error("[AUTH] SignOut failed:", err);
        // Even if sign out fails, clear the local state
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    }
  };

  const updateProfile = async (updates) => {
    try {
      if (!user) throw new Error("No authenticated user");
      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;
      setProfile(data);
      return data;
    } catch (err) {
      console.error("[AUTH] Profile update failed:", err);
      throw err;
    }
  };

  const resetPassword = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
    } catch (err) {
      console.error("[AUTH] Password reset failed:", err);
      throw err;
    }
  };

  const updatePassword = async (newPassword) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
    } catch (err) {
      console.error("[AUTH] Password update failed:", err);
      throw err;
    }
  };

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
    isStudent: profile?.role === "student",
    isProvider: profile?.role === "provider",
    isAdmin: profile?.role === "admin",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
