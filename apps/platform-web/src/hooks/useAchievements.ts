import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Achievement = {
  id: string;
  title: string;
  description: string | null;
  icon: string;
};

export type UserAchievement = {
  achievement_id: string;
  achievements?: Achievement | null;
};

export function useAchievements() {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAchievements = useCallback(async () => {
    if (!user) {
      setAchievements([]);
      setUserAchievements([]);
      setLoading(false);
      return;
    }
    const [{ data: allAchievements }, { data: earned }] = await Promise.all([
      supabase.from("achievements").select("id, title, description, icon"),
      supabase
        .from("user_achievements")
        .select("achievement_id, achievements(id, title, description, icon)")
        .eq("user_id", user.id),
    ]);
    setAchievements((allAchievements ?? []) as Achievement[]);
    setUserAchievements((earned ?? []) as unknown as UserAchievement[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void fetchAchievements();
  }, [fetchAchievements]);

  return {
    achievements,
    userAchievements,
    loading,
    refreshAchievements: fetchAchievements,
  };
}
