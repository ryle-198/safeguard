import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

export type AppRole = 'RESIDENT' | 'GUARD' | 'ADMIN';

interface AuthRoleState {
  /** True until the initial session + role lookup has finished. */
  initializing: boolean;
  session: Session | null;
  /** null while logged out, or if the profile row couldn't be read. */
  role: AppRole | null;
}

/**
 * Tracks the current Supabase auth session and resolves it to a role via
 * profiles.role. App.tsx uses this to decide which set of screens
 * (auth / resident / guard) to render.
 */
export function useAuthRole(): AuthRoleState {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadRoleForSession = async (activeSession: Session | null) => {
      if (!activeSession) {
        if (isMounted) {
          setRole(null);
        }
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', activeSession.user.id)
        .single();

      if (!isMounted) {
        return;
      }

      if (error) {
        console.error('Failed to load profile role:', error.message);
        setRole(null);
        return;
      }

      setRole((data?.role as AppRole) ?? null);
    };

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!isMounted) {
        return;
      }

      setSession(initialSession);
      await loadRoleForSession(initialSession);

      if (isMounted) {
        setInitializing(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) {
        return;
      }

      setSession(newSession);
      await loadRoleForSession(newSession);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return { initializing, session, role };
}