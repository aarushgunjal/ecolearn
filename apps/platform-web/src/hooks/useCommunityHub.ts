import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type AccountRole = "student" | "teacher" | "admin";
export type Community = {
  id: string;
  name: string;
  description: string;
  kind:
    | "school"
    | "neighborhood"
    | "faith"
    | "club"
    | "organization"
    | "municipality";
  role: "owner" | "manager" | "member";
  member_count: number;
  classroom_count: number;
  total_xp: number;
  total_scans: number;
  join_code?: string | null;
};
export type Classroom = {
  id: string;
  community_id: string;
  school_name: string;
  name: string;
  grade_label: string;
  role: "teacher" | "student";
  student_count: number;
  total_xp: number;
  lesson_completions: number;
  join_code?: string | null;
};
export type Assignment = {
  id: string;
  classroom_id: string;
  classroom_name: string;
  lesson_id: string;
  lesson_title: string;
  title: string;
  due_at?: string | null;
  completed: boolean;
};
export type Announcement = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  scope: "community" | "classroom";
  scope_id: string;
  created_by: string;
  creator_alias: string;
};
export type CommunityEvent = {
  id: string;
  community_id: string;
  title: string;
  description: string;
  starts_at: string;
  location: string;
  rsvp_count: number;
  rsvped: boolean;
  created_by: string;
  creator_alias: string;
};
export type BlockedUser = { user_id: string; alias: string };
export type ModerationReport = {
  id: string;
  target_type: "announcement" | "event";
  target_id: string;
  target_title: string;
  target_body: string;
  reported_alias: string;
  reporter_alias: string;
  reason: "inappropriate" | "bullying" | "spam" | "privacy" | "other";
  details: string;
  status: "pending" | "reviewed";
  created_at: string;
};
export type HubData = {
  profile: { role: AccountRole; alias: string };
  communities: Community[];
  classrooms: Classroom[];
  assignments: Assignment[];
  announcements: Announcement[];
  events: CommunityEvent[];
  blocked_users: BlockedUser[];
};
export type ClassroomDashboard = {
  students: Array<{
    user_id: string;
    alias: string;
    xp: number;
    level: number;
    scans: number;
    lessons: number;
    streak: number;
  }>;
  assignments: Array<{
    id: string;
    title: string;
    lesson_id: string;
    lesson_title: string;
    due_at?: string | null;
    completed_count: number;
    student_count: number;
  }>;
};
export type SchoolStanding = {
  id: string;
  name: string;
  grade_label: string;
  student_count: number;
  total_xp: number;
  total_scans: number;
  lesson_completions: number;
};

const emptyHub: HubData = {
  profile: { role: "student", alias: "Eco learner" },
  communities: [],
  classrooms: [],
  assignments: [],
  announcements: [],
  events: [],
  blocked_users: [],
};

const messageFor = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "EcoLearn could not complete that request.";

export function useCommunityHub() {
  const { user } = useAuth();
  const [data, setData] = useState<HubData>(emptyHub);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setData(emptyHub);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data: response, error: requestError } =
      await supabase.rpc("ecolearn_get_hub");
    if (requestError) {
      setError(
        requestError.code === "42883"
          ? "The secure community database update has not been deployed yet."
          : requestError.message,
      );
    } else if (response) {
      setData(response as unknown as HubData);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(
    async <T>(name: string, params: Record<string, unknown>) => {
      const { data: response, error: requestError } = await supabase.rpc(
        name,
        params,
      );
      if (requestError) throw new Error(requestError.message);
      await refresh();
      return response as T;
    },
    [refresh],
  );
  const getClassroomDashboard = useCallback(async (classroomId: string) => {
    const { data: response, error: requestError } = await supabase.rpc(
      "ecolearn_get_classroom_dashboard",
      { p_classroom_id: classroomId },
    );
    if (requestError) throw new Error(requestError.message);
    return response as unknown as ClassroomDashboard;
  }, []);
  const getSchoolStandings = useCallback(async (communityId: string) => {
    const { data: response, error: requestError } = await supabase.rpc(
      "ecolearn_get_school_standings",
      { p_community_id: communityId },
    );
    if (requestError) throw new Error(requestError.message);
    return (response ?? []) as unknown as SchoolStanding[];
  }, []);
  const getModerationQueue = useCallback(async () => {
    const { data: response, error: requestError } = await supabase.rpc(
      "ecolearn_get_moderation_queue",
    );
    if (requestError) throw new Error(requestError.message);
    return (response ?? []) as unknown as ModerationReport[];
  }, []);

  return {
    user,
    data,
    loading,
    error,
    refresh,
    messageFor,
    setProfile: (alias: string, role: "student" | "teacher") =>
      run("ecolearn_set_profile", { p_alias: alias, p_role: role }),
    joinSpace: (code: string) => run("ecolearn_join_space", { p_code: code }),
    createCommunity: (
      name: string,
      kind: Community["kind"],
      description: string,
    ) =>
      run<{ join_code: string }>("ecolearn_create_community", {
        p_name: name,
        p_kind: kind,
        p_description: description,
      }),
    createClassroom: (communityId: string, name: string, grade: string) =>
      run<{ join_code: string }>("ecolearn_create_classroom", {
        p_community_id: communityId,
        p_name: name,
        p_grade_label: grade,
      }),
    rotateCode: (
      scope: "community" | "classroom",
      id: string,
      accessRole?: "student" | "teacher",
    ) =>
      run<string>("ecolearn_rotate_join_code", {
        p_scope: scope,
        p_scope_id: id,
        p_access_role: accessRole ?? null,
      }),
    createAssignment: (
      classroomId: string,
      lessonId: string,
      title: string,
      dueAt?: string | null,
    ) =>
      run("ecolearn_create_assignment", {
        p_classroom_id: classroomId,
        p_lesson_id: lessonId,
        p_title: title,
        p_due_at: dueAt || null,
      }),
    createAnnouncement: (
      scope: "community" | "classroom",
      id: string,
      title: string,
      body: string,
    ) =>
      run("ecolearn_create_announcement", {
        p_scope: scope,
        p_scope_id: id,
        p_title: title,
        p_body: body,
      }),
    createEvent: (
      communityId: string,
      title: string,
      description: string,
      startsAt: string,
      location: string,
    ) =>
      run("ecolearn_create_event", {
        p_community_id: communityId,
        p_title: title,
        p_description: description,
        p_starts_at: startsAt,
        p_location: location,
      }),
    rsvpEvent: (eventId: string) =>
      run("ecolearn_rsvp_event", { p_event_id: eventId, p_status: "going" }),
    reportContent: (
      targetType: "announcement" | "event",
      targetId: string,
      reason: ModerationReport["reason"],
      details: string,
    ) =>
      run("ecolearn_report_content", {
        p_target_type: targetType,
        p_target_id: targetId,
        p_reason: reason,
        p_details: details,
      }),
    blockUser: (userId: string) =>
      run("ecolearn_block_user", { p_user_id: userId }),
    unblockUser: (userId: string) =>
      run("ecolearn_unblock_user", { p_user_id: userId }),
    resolveReport: (
      reportId: string,
      reportAction: "remove" | "dismiss",
      note = "",
    ) =>
      run("ecolearn_resolve_report", {
        p_report_id: reportId,
        p_action: reportAction,
        p_note: note,
      }),
    getClassroomDashboard,
    getSchoolStandings,
    getModerationQueue,
  };
}
