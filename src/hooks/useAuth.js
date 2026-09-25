import { useCallback, useEffect, useState } from "react";
import { OWNER_EMAIL, supabase } from "../lib/supabase.js";

function isOwner(user) {
  return user?.email?.toLowerCase() === OWNER_EMAIL;
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (!error && isOwner(data.user)) setUser(data.user);
      else if (data.user) supabase.auth.signOut({ scope: "local" });
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(isOwner(session?.user) ? session.user : null);
      setLoading(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const sendMagicLink = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOtp({
      email: OWNER_EMAIL,
      options: {
        shouldCreateUser: true,
      },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  return { user, loading, sendMagicLink, signOut };
}
