import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export function useAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!user) {
        if (active) {
          setIsAdmin(false);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      const { data, error } = await supabase.rpc("is_app_admin");
      if (active) {
        if (error) console.error("Unable to check admin access:", error);
        setIsAdmin(!error && data === true);
        setLoading(false);
      }
    };
    void check();
    return () => {
      active = false;
    };
  }, [user]);

  return { isAdmin, loading };
}
