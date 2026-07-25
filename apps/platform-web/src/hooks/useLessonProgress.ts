import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const LESSONS_CHANGED_EVENT = "ecolearn-lessons-changed";

export function useLessonProgress() {
  const { user } = useAuth();
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshCompletedLessons = useCallback(async () => {
    if (!user) {
      setCompletedLessonIds([]);
      setLoading(false);
      return [];
    }

    const { data, error } = await supabase
      .from("lesson_progress")
      .select("lesson_id")
      .eq("user_id", user.id)
      .eq("status", "completed");

    if (error) {
      console.error("Error fetching completed lessons:", error);
      setLoading(false);
      return [];
    }

    const lessonIds = Array.from(
      new Set((data || []).map((row: { lesson_id: string }) => row.lesson_id)),
    );
    setCompletedLessonIds(lessonIds);
    setLoading(false);
    return lessonIds;
  }, [user]);

  useEffect(() => {
    void refreshCompletedLessons();
  }, [refreshCompletedLessons]);

  useEffect(() => {
    const handleLessonsChanged = () => {
      void refreshCompletedLessons();
    };

    window.addEventListener(LESSONS_CHANGED_EVENT, handleLessonsChanged);
    return () => window.removeEventListener(LESSONS_CHANGED_EVENT, handleLessonsChanged);
  }, [refreshCompletedLessons]);

  return {
    completedLessonIds,
    loading,
    refreshCompletedLessons,
    markLessonsChanged: () => window.dispatchEvent(new Event(LESSONS_CHANGED_EVENT)),
  };
}
