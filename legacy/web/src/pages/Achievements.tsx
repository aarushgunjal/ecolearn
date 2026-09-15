import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProgress } from "@/hooks/useProgress";
import type { Database } from "@/integrations/supabase/types";

type Achievement = Database["public"]["Tables"]["achievements"]["Row"];
type UserAchievement = Database["public"]["Tables"]["user_achievements"]["Row"];

export default function Achievements() {
  const { user } = useAuth();
  const { progress } = useProgress();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAchievements = useCallback(async () => {
    if (!user) return;

    const { data: allAchievements } = await supabase
      .from('achievements')
      .select('*')
      .order('requirement_value');

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

  const isAchievementEarned = (achievementId: string) => {
    return userAchievements.some(ua => ua.achievement_id === achievementId);
  };

  const getProgressValue = (achievement: Achievement) => {
    if (!progress) return 0;
    
    let current = 0;
    switch (achievement.requirement_type) {
      case 'scans':
        current = progress.total_scans ?? 0;
        break;
      case 'lessons':
        current = progress.total_lessons_completed ?? 0;
        break;
      case 'streak':
        current = progress.streak_days ?? 0;
        break;
      case 'level':
        current = progress.level ?? 1;
        break;
    }
    
    return Math.min((current / achievement.requirement_value) * 100, 100);
  };

  const earnedCount = userAchievements.length;
  const totalCount = achievements.length;
  const completionPercentage = totalCount > 0 ? (earnedCount / totalCount) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 p-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto bg-gradient-to-r from-eco-primary to-eco-secondary rounded-full flex items-center justify-center animate-bounce-soft">
          <Trophy className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">Achievements</h1>
        <p className="text-muted-foreground">
          {earnedCount} of {totalCount} unlocked
        </p>
      </div>

      {/* Progress Overview */}
      <Card className="bg-gradient-to-r from-eco-primary/10 to-eco-secondary/10">
        <CardHeader>
          <CardTitle>Overall Progress</CardTitle>
          <CardDescription>Keep going to unlock all achievements!</CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={completionPercentage} className="h-3" />
        </CardContent>
      </Card>

      {/* Achievements Grid */}
      <div className="space-y-4">
        {achievements.map((achievement) => {
          const earned = isAchievementEarned(achievement.id);
          const progressValue = getProgressValue(achievement);

          return (
            <Card 
              key={achievement.id} 
              className={`transition-all ${earned ? "bg-gradient-to-r from-success/10 to-success/5" : "opacity-70"}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl ${
                    earned 
                      ? "bg-gradient-to-r from-eco-primary to-eco-secondary" 
                      : "bg-muted"
                  }`}>
                    {earned ? achievement.icon : <Lock className="w-8 h-8 text-muted-foreground" />}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-lg">{achievement.title}</h3>
                      {earned && (
                        <Badge className="bg-success text-white">Unlocked</Badge>
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-3">
                      {achievement.description}
                    </p>

                    {!earned && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{Math.floor(progressValue)}%</span>
                        </div>
                        <Progress value={progressValue} className="h-2" />
                      </div>
                    )}

                    {earned && (
                      <div className="flex items-center gap-2 text-sm text-success">
                        <Trophy className="w-4 h-4" />
                        <span>Achievement Unlocked!</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
