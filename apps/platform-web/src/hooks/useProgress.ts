import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const PROGRESS_CHANGED_EVENT = "ecolearn-progress-changed";

export type UserProgress = {
  user_id: string;
  xp: number;
  level: number;
  total_scans: number;
  total_lessons_completed: number;
  streak_days: number;
  last_activity_date: string | null;
};

export function useProgress() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProgress = useCallback(async () => {
    if (!user) {
      setProgress(null);
      setLoading(false);
      return null;
    }
    const { data, error } = await supabase
      .from("user_progress")
      .select("user_id, xp, level, total_scans, total_lessons_completed, streak_days, last_activity_date")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) console.error("Error fetching progress:", error);
    else setProgress(data as UserProgress | null);
    setLoading(false);
    return data as UserProgress | null;
  }, [user]);

  useEffect(() => {
    void fetchProgress();
  }, [fetchProgress]);

  useEffect(() => {
    const handleProgressChanged = () => {
      void fetchProgress();
    };
    window.addEventListener(PROGRESS_CHANGED_EVENT, handleProgressChanged);
    return () => window.removeEventListener(PROGRESS_CHANGED_EVENT, handleProgressChanged);
  }, [fetchProgress]);

  const claimReward = async (rewardKey: "daily_three_scans" | "weekend_reusable_cup") => {
    const { error } = await supabase.rpc("claim_ecolearn_reward", {
      p_reward_key: rewardKey,
    });
    if (!error) {
      await fetchProgress();
      window.dispatchEvent(new Event(PROGRESS_CHANGED_EVENT));
    }
    return { error };
  };

  return { progress, loading, claimReward, refreshProgress: fetchProgress };
}
