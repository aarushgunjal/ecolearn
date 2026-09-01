import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Trophy, 
  Flame, 
  Star, 
  Target,
  LogOut
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProgress } from "@/hooks/useProgress";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type DailyQuest = Database["public"]["Tables"]["daily_quests"]["Row"] & {
  current_progress: number;
  completed: boolean;
};

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { progress, loading } = useProgress();
  const [dailyQuests, setDailyQuests] = useState<DailyQuest[]>([]);

  const fetchDailyQuests = useCallback(async () => {
    if (!user) return;
    
    const { data: quests } = await supabase
      .from('daily_quests')
      .select('*')
      .limit(3);

    const { data: userQuests } = await supabase
      .from('user_daily_quests')
      .select('*')
      .eq('user_id', user.id)
      .eq('quest_date', new Date().toISOString().split('T')[0]);

    const questsWithProgress = (quests || []).map(quest => {
      const userQuest = userQuests?.find(uq => uq.quest_id === quest.id);
      return {
        ...quest,
        current_progress: userQuest?.current_progress || 0,
        completed: userQuest?.completed || false
      };
    });

    setDailyQuests(questsWithProgress);
  }, [user]);

  useEffect(() => {
    if (user) void fetchDailyQuests();
  }, [fetchDailyQuests, user]);

  const xpToNextLevel = progress ? ((progress.level ?? 1) * 100) - (progress.xp ?? 0) : 100;
  const xpProgress = progress ? ((progress.xp ?? 0) % 100) : 0;

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Welcome Back!</h1>
          <p className="text-muted-foreground">{user?.email}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={signOut}>
          <LogOut className="h-5 h-5" />
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">Level</span>
            </div>
            <div className="text-3xl font-bold text-primary">{progress?.level || 1}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-5 h-5 text-destructive" />
              <span className="text-sm text-muted-foreground">Streak</span>
            </div>
            <div className="text-3xl font-bold text-destructive">{progress?.streak_days || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* XP Progress */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>XP Progress</CardTitle>
              <CardDescription>{progress?.xp || 0} XP • {xpToNextLevel} XP to next level</CardDescription>
            </div>
            <Trophy className="w-6 h-6 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={xpProgress} className="h-3" />
        </CardContent>
      </Card>

      {/* Daily Quests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Daily Quests
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {dailyQuests.map((quest) => (
            <div 
              key={quest.id}
              className={`p-4 rounded-lg border ${
                quest.completed ? 'bg-success/10 border-success/20' : 'bg-muted/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{quest.title}</h3>
                <Badge variant={quest.completed ? "default" : "outline"}>
                  +{quest.xp_reward} XP
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{quest.description}</p>
              <div className="flex items-center gap-2">
                <Progress 
                  value={(quest.current_progress / quest.target_value) * 100} 
                  className="flex-1 h-2" 
                />
                <span className="text-sm font-medium">
                  {quest.current_progress}/{quest.target_value}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground mb-1">
              {progress?.total_lessons_completed || 0}
            </div>
            <div className="text-sm text-muted-foreground">Lessons Completed</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground mb-1">
              {progress?.total_scans || 0}
            </div>
            <div className="text-sm text-muted-foreground">Items Scanned</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
