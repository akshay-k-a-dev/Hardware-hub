import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = async (userId) => {
        try {
            console.log('[AUTH] Fetching profile:', { userId });
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('[AUTH] Profile fetch error:', error);
                return null;
            }

            console.log('[AUTH] Profile fetched:', data);
            setProfile(data);
            return data;
        } catch (err) {
            console.error('[AUTH] Profile fetch failed:', err);
            return null;
        }
    };

    useEffect(() => {
        let isMounted = true;

        const initSession = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) throw error;

                console.log('[AUTH] Session retrieved:', { hasSession: !!session, session });

                if (!isMounted) return;
                setUser(session?.user ?? null);

                if (session?.user) {
                    await fetchProfile(session.user.id);
                }
            } catch (err) {
                if (err.name !== 'AbortError' && !err.message?.includes('Lock broken')) {
                    console.error('[AUTH] Session retrieval failed:', err);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        initSession();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!isMounted) return;
                console.log('[AUTH] State changed:', { event, hasSession: !!session, session });
                setUser(session?.user ?? null);
                if (session?.user) {
                    try {
                        await fetchProfile(session.user.id);
                    } catch (e) {
                        if (e.name !== 'AbortError' && !e.message?.includes('Lock broken')) {
                            console.error('[AUTH] Profile fetch on state change failed:', e);
                        }
                    }
                } else {
                    setProfile(null);
                }
                setLoading(false);
            }
        );

        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
            subscription.unsubscribe();
        };
    }, []);

    const signUp = async ({ email, password, name, role = 'student' }) => {
        console.log('[AUTH] Starting signup:', { email, name, role });

        try {
            // Validate inputs
            if (!email || !password || !name) {
                throw new Error('Email, password, and name are required');
            }

            if (password.length < 6) {
                throw new Error('Password must be at least 6 characters');
            }

            // Attempt signup with better error details
            console.log('[AUTH] Calling supabase.auth.signUp...');
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { name, role },
                },
            });

            if (error) {
                console.error('[AUTH] Supabase signup error:', {
                    code: error.code,
                    message: error.message,
                    status: error.status,
                    fullError: error,
                });

                // Provide more helpful error messages
                if (error.message.includes('rate limit') || error.message.includes('email rate')) {
                    throw new Error(
                        'Email service rate limit exceeded. Please wait 1-2 hours before trying again, or contact support if the issue persists.'
                    );
                } else if (error.message.includes('Database error saving new user')) {
                    throw new Error(
                        'Database error occurred. This may be due to: 1) Email already registered, 2) Server configuration issue. Please try again or contact support.'
                    );
                } else if (error.message.includes('User already registered')) {
                    throw new Error('This email is already registered. Please log in or use a different email.');
                }

                throw error;
            }

            if (!data?.user?.id) {
                throw new Error('User creation returned no user ID');
            }

            console.log('[AUTH] Signup successful, user created:', { userId: data.user.id, email });

            // Wait for the trigger to create the profile
            console.log('[AUTH] Waiting for profile creation trigger...');
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Verify profile exists
            console.log('[AUTH] Verifying profile was created...');
            const { data: existingProfile, error: fetchError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .maybeSingle();

            if (fetchError) {
                console.error('[AUTH] Error fetching profile:', fetchError);
                // Don't throw here - the profile might exist despite fetch error
            } else if (existingProfile) {
                console.log('[AUTH] Profile verified:', existingProfile);
                return data;
            } else {
                console.warn('[AUTH] Profile not found after trigger, attempting manual creation');
            }

            // Manually create profile using RPC function if trigger failed
            console.log('[AUTH] Attempting to create profile via RPC function...');
            const { data: rpcResult, error: rpcError } = await supabase
                .rpc('create_user_profile', {
                    user_id: data.user.id,
                    user_name: name || 'User',
                    user_email: email,
                    user_role: role || 'student',
                });

            if (rpcError) {
                console.error('[AUTH] RPC profile creation failed:', rpcError);
                throw new Error(
                    `Profile creation failed: ${rpcError.message || 'Unknown error'}. Please contact support.`
                );
            }

            if (rpcResult?.success === false) {
                console.error('[AUTH] RPC returned error:', rpcResult);
                throw new Error(
                    `Profile creation failed: ${rpcResult.error || 'Unknown error'}. Please contact support.`
                );
            }

            console.log('[AUTH] Profile created successfully via RPC:', rpcResult);
            return data;
        } catch (err) {
            console.error('[AUTH] SignUp failed:', {
                message: err.message,
                fullError: err,
            });
            throw err;
        }
    };

    const signIn = async ({ email, password }) => {
        console.log('[AUTH] Starting signin:', { email });
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) {
                console.error('[AUTH] SignIn error:', error);
                throw error;
            }
            console.log('[AUTH] SignIn successful:', { userId: data?.user?.id, email });
            return data;
        } catch (err) {
            console.error('[AUTH] SignIn failed:', err);
            throw err;
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
    };

    const value = {
        user,
        profile,
        loading,
        signUp,
        signIn,
        signOut,
        isStudent: profile?.role === 'student',
        isProvider: profile?.role === 'provider',
        isAdmin: profile?.role === 'admin',
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
