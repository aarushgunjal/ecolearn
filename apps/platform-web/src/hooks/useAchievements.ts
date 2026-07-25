import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export function useAchievements() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [achievements, setAchievements] = useState<any[]>([]);
  const [userAchievements, setUserAchievements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchAchievements();
    }
  }, [user]);

  const fetchAchievements = async () => {
    if (!user) return;

    const { data: allAchievements } = await supabase.from("achievements").select("*");

    const { data: earned } = await supabase
      .from("user_achievements")
      .select("*, achievements(*)")
      .eq("user_id", user.id);

    setAchievements(allAchievements || []);
    setUserAchievements(earned || []);
    setLoading(false);
  };

  const checkAndAwardAchievements = async (progress: any) => {
    if (!user || !progress) return;

    const earnedIds = userAchievements.map((ua) => ua.achievement_id);

    for (const achievement of achievements) {
      if (earnedIds.includes(achievement.id)) continue;

      let shouldAward = false;

      switch (achievement.requirement_type) {
        case "scans":
          shouldAward = progress.total_scans >= achievement.requirement_value;
          break;
        case "lessons":
          shouldAward = progress.total_lessons_completed >= achievement.requirement_value;
          break;
        case "streak":
          shouldAward = progress.streak_days >= achievement.requirement_value;
          break;
        case "level":
          shouldAward = progress.level >= achievement.requirement_value;
          break;
      }

      if (shouldAward) {
        const { error } = await supabase.from("user_achievements").insert({ user_id: user.id, achievement_id: achievement.id });

        if (!error) {
          toast({
            title: "Achievement Unlocked! 🏆",
            description: `${achievement.icon} ${achievement.title}`,
          });
        }
      }
    }

    await fetchAchievements();
  };

  return {
    achievements,
    userAchievements,
    loading,
    checkAndAwardAchievements,
    refreshAchievements: fetchAchievements,
  };
}
