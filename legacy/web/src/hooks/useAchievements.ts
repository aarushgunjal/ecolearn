import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function useAchievements() {
  const { user } = useAuth();
  const { toast } = useToast();
  type Achievement = Database['public']['Tables']['achievements']['Row'];
  type UserAchievement = Database['public']['Tables']['user_achievements']['Row'];
  type UserProgress = Database['public']['Tables']['user_progress']['Row'];
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAchievements = useCallback(async () => {
    if (!user) return;

    const { data: allAchievements } = await supabase
      .from('achievements')
      .select('*');

    const { data: earned } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', user.id);

    setAchievements(allAchievements || []);
    setUserAchievements(earned || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) void fetchAchievements();
  }, [fetchAchievements, user]);

  const checkAndAwardAchievements = async (progress: UserProgress) => {
    if (!user || !progress) return;

    const earnedIds = userAchievements.map(ua => ua.achievement_id);
    
    for (const achievement of achievements) {
      if (earnedIds.includes(achievement.id)) continue;

      let shouldAward = false;
      
      switch (achievement.requirement_type) {
        case 'scans':
          shouldAward = (progress.total_scans ?? 0) >= achievement.requirement_value;
          break;
        case 'lessons':
          shouldAward = (progress.total_lessons_completed ?? 0) >= achievement.requirement_value;
          break;
        case 'streak':
          shouldAward = (progress.streak_days ?? 0) >= achievement.requirement_value;
          break;
        case 'level':
          shouldAward = (progress.level ?? 1) >= achievement.requirement_value;
          break;
      }

      if (shouldAward) {
        const { error } = await supabase
          .from('user_achievements')
          .insert({ user_id: user.id, achievement_id: achievement.id });

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
