import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function useProgress() {
  const { user } = useAuth();
  const { toast } = useToast();
  type UserProgress = Database['public']['Tables']['user_progress']['Row'];
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProgress = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching progress:', error);
    } else {
      setProgress(data);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) void fetchProgress();
  }, [fetchProgress, user]);

  const addXP = async (amount: number) => {
    if (!user || !progress) return;

    const newXP = (progress.xp ?? 0) + amount;
    const newLevel = Math.floor(newXP / 100) + 1;

    const { error } = await supabase
      .from('user_progress')
      .update({ 
        xp: newXP, 
        level: newLevel,
        last_activity_date: new Date().toISOString().split('T')[0]
      })
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating XP:', error);
      toast({
        title: "Error",
        description: "Failed to update XP",
        variant: "destructive",
      });
    } else {
      await fetchProgress();
      if (newLevel > (progress.level ?? 1)) {
        toast({
          title: "Level Up!",
          description: `You've reached level ${newLevel}! 🎉`,
        });
      }
    }
  };

  const updateStreak = async () => {
    if (!user || !progress) return;

    const today = new Date().toISOString().split('T')[0];
    const lastActivity = progress.last_activity_date;
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let newStreak = progress.streak_days ?? 0;
    
    if (lastActivity === yesterdayStr) {
      newStreak += 1;
    } else if (lastActivity !== today) {
      newStreak = 1;
    }

    const { error } = await supabase
      .from('user_progress')
      .update({ 
        streak_days: newStreak,
        last_activity_date: today
      })
      .eq('user_id', user.id);

    if (!error) {
      await fetchProgress();
    }
  };

  const incrementScans = async () => {
    if (!user || !progress) return;

    const { error } = await supabase
      .from('user_progress')
      .update({ total_scans: (progress.total_scans ?? 0) + 1 })
      .eq('user_id', user.id);

    if (!error) {
      await fetchProgress();
    }
  };

  const incrementLessons = async () => {
    if (!user || !progress) return;

    const { error } = await supabase
      .from('user_progress')
      .update({ total_lessons_completed: (progress.total_lessons_completed ?? 0) + 1 })
      .eq('user_id', user.id);

    if (!error) {
      await fetchProgress();
    }
  };

  return {
    progress,
    loading,
    addXP,
    updateStreak,
    incrementScans,
    incrementLessons,
    refreshProgress: fetchProgress,
  };
}
