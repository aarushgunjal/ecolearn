import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { supabase } from "./supabase";

type Role = "student" | "teacher" | "admin";
type Community = {
  id: string;
  name: string;
  description: string;
  kind: string;
  role: "owner" | "manager" | "member";
  member_count: number;
  classroom_count: number;
  total_xp: number;
  total_scans: number;
  join_code?: string | null;
};
type Classroom = {
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
type Assignment = {
  id: string;
  classroom_id: string;
  classroom_name: string;
  lesson_title: string;
  title: string;
  due_at?: string | null;
  completed: boolean;
};
type Announcement = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  scope: "community" | "classroom";
  scope_id: string;
};
type Event = {
  id: string;
  community_id: string;
  title: string;
  description: string;
  starts_at: string;
  location: string;
  rsvp_count: number;
  rsvped: boolean;
};
type Hub = {
  profile: { role: Role; alias: string };
  communities: Community[];
  classrooms: Classroom[];
  assignments: Assignment[];
  announcements: Announcement[];
  events: Event[];
};
type StudentMetric = {
  user_id: string;
  alias: string;
  xp: number;
  level: number;
  scans: number;
  lessons: number;
  streak: number;
};
type Standing = {
  id: string;
  name: string;
  grade_label: string;
  student_count: number;
  total_xp: number;
  total_scans: number;
  lesson_completions: number;
};
type LessonOption = { id: string; title: string };
const emptyHub: Hub = {
  profile: { role: "student", alias: "Eco learner" },
  communities: [],
  classrooms: [],
  assignments: [],
  announcements: [],
  events: [],
};

export function CommunityScreen({
  onOpenLesson,
}: {
  onOpenLesson: () => void;
}) {
  const [hub, setHub] = useState<Hub>(emptyHub);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alias, setAlias] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [communityName, setCommunityName] = useState("");
  const [communityKind, setCommunityKind] = useState("neighborhood");
  const [className, setClassName] = useState("");
  const [grade, setGrade] = useState("");
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(
    null,
  );
  const [selectedClassroom, setSelectedClassroom] = useState<string | null>(
    null,
  );
  const [students, setStudents] = useState<StudentMetric[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [assignmentLesson, setAssignmentLesson] = useState("");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentDue, setAssignmentDue] = useState("");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventStarts, setEventStarts] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [expanded, setExpanded] = useState<
    "join" | "create" | "class" | "assignment" | "announcement" | "event" | null
  >(null);

  const refresh = useCallback(async () => {
    setError(null);
    const { data, error: requestError } =
      await supabase.rpc("ecolearn_get_hub");
    if (requestError)
      setError(
        requestError.code === "42883"
          ? "The secure classroom update still needs to be deployed."
          : requestError.message,
      );
    else if (data) {
      const next = data as unknown as Hub;
      setHub(next);
      setAlias(next.profile.alias ?? "");
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    void supabase
      .from("lessons")
      .select("id,title")
      .eq("is_published", true)
      .order("sort_order")
      .then(({ data }) => {
        const next = (data ?? []) as LessonOption[];
        setLessons(next);
        setAssignmentLesson((current) => current || next[0]?.id || "");
      });
  }, []);

  const schools = useMemo(
    () => hub.communities.filter((item) => item.kind === "school"),
    [hub.communities],
  );
  useEffect(() => {
    if (!selectedSchool && schools[0]) setSelectedSchool(schools[0].id);
  }, [schools, selectedSchool]);
  useEffect(() => {
    if (!selectedCommunity && hub.communities[0])
      setSelectedCommunity(hub.communities[0].id);
    if (!selectedClassroom) {
      const managed = hub.classrooms.find((item) => item.role === "teacher");
      if (managed) setSelectedClassroom(managed.id);
    }
  }, [hub.classrooms, hub.communities, selectedClassroom, selectedCommunity]);
  useEffect(() => {
    if (!selectedSchool) {
      setStandings([]);
      return;
    }
    void supabase
      .rpc("ecolearn_get_school_standings", { p_community_id: selectedSchool })
      .then(({ data }) => setStandings((data ?? []) as unknown as Standing[]));
  }, [selectedSchool, hub.classrooms]);
  useEffect(() => {
    const managed = hub.classrooms.find(
      (item) => item.id === selectedClassroom && item.role === "teacher",
    );
    if (!managed) {
      setStudents([]);
      return;
    }
    void supabase
      .rpc("ecolearn_get_classroom_dashboard", { p_classroom_id: managed.id })
      .then(({ data }) =>
        setStudents(
          (data as { students?: StudentMetric[] } | null)?.students ?? [],
        ),
      );
  }, [hub.classrooms, selectedClassroom]);

  const managedCommunity = hub.communities.find(
    (item) =>
      item.id === selectedCommunity &&
      (item.role === "owner" || item.role === "manager"),
  );
  const managedClassroom = hub.classrooms.find(
    (item) => item.id === selectedClassroom && item.role === "teacher",
  );

  const run = async (
    name: string,
    params: Record<string, unknown>,
    success: string,
  ) => {
    setSaving(true);
    const { data, error: requestError } = await supabase.rpc(name, params);
    setSaving(false);
    if (requestError)
      return Alert.alert("Could not save", requestError.message);
    await refresh();
    setExpanded(null);
    const code =
      data && typeof data === "object" && "join_code" in data
        ? String((data as { join_code: unknown }).join_code)
        : null;
    Alert.alert(
      success,
      code
        ? `Share join code ${code} with the people you invite.`
        : "Your changes are live.",
    );
  };
  const copyCode = (code?: string | null) =>
    code && Alert.alert("Join code", code);
  const createTeacherInvite = async (classroomId: string) => {
    setSaving(true);
    const { data, error: requestError } = await supabase.rpc(
      "ecolearn_rotate_join_code",
      {
        p_scope: "classroom",
        p_scope_id: classroomId,
        p_access_role: "teacher",
      },
    );
    setSaving(false);
    if (requestError)
      return Alert.alert("Could not create invitation", requestError.message);
    Alert.alert(
      "Private teacher invitation",
      `Share ${String(data)} only with an authorized educator.`,
    );
  };

  if (loading)
    return (
      <View style={s.center}>
        <ActivityIndicator color="#28723d" />
        <Text style={s.meta}>Loading your communities…</Text>
      </View>
    );
  return (
    <>
      <Text style={s.kicker}>LEARN TOGETHER</Text>
      <Text style={s.title}>Your communities.</Text>
      <Text style={s.body}>
        Join a class, school, neighborhood, faith group, or local organization.
        One account can belong to as many spaces as you need.
      </Text>
      {error && (
        <View style={s.error}>
          <Ionicons name="alert-circle-outline" size={19} color="#9b5516" />
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      <View style={s.profileCard}>
        <View style={s.row}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>
              {(hub.profile.alias || "E").slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={s.flex}>
            <Text style={s.profileTitle}>
              {hub.profile.alias || "Eco learner"}
            </Text>
            <Text style={s.profileMeta}>
              {hub.profile.role === "admin"
                ? "EcoLearn administrator"
                : `${hub.profile.role[0].toUpperCase()}${hub.profile.role.slice(1)} access`}
            </Text>
          </View>
        </View>
        <TextInput
          value={alias}
          onChangeText={setAlias}
          placeholder="Student-safe display name"
          style={s.input}
          maxLength={60}
        />
        <Text style={s.accessNote}>
          Teacher access requires a private teacher invitation. Admin access is
          assigned separately and cannot be self-selected.
        </Text>
        <Pressable
          disabled={saving}
          onPress={() =>
            void run(
              "ecolearn_set_profile",
              {
                p_alias: alias || "Eco learner",
                p_role:
                  hub.profile.role === "admin" ? "teacher" : hub.profile.role,
              },
              "Profile saved",
            )
          }
        >
          <Text style={s.link}>Save display name</Text>
        </Pressable>
      </View>

      <View style={s.actions}>
        <Pressable
          style={s.primary}
          onPress={() => setExpanded(expanded === "join" ? null : "join")}
        >
          <Ionicons name="enter-outline" size={18} color="#fff" />
          <Text style={s.primaryText}>Join with code</Text>
        </Pressable>
        {(hub.profile.role === "teacher" || hub.profile.role === "admin") && (
          <Pressable
            style={s.secondary}
            onPress={() => setExpanded(expanded === "create" ? null : "create")}
          >
            <Ionicons name="add" size={19} color="#276f3c" />
            <Text style={s.secondaryText}>Create space</Text>
          </Pressable>
        )}
      </View>
      {expanded === "join" && (
        <View style={s.form}>
          <Text style={s.cardTitle}>Enter a private join code</Text>
          <Text style={s.meta}>
            Your teacher or community organizer provides this code.
          </Text>
          <TextInput
            value={joinCode}
            onChangeText={(value) => setJoinCode(value.toUpperCase())}
            autoCapitalize="characters"
            placeholder="ABC12345"
            style={s.input}
            maxLength={12}
          />
          <Pressable
            disabled={saving || joinCode.length < 6}
            style={s.primary}
            onPress={() =>
              void run(
                "ecolearn_join_space",
                { p_code: joinCode },
                "Welcome to your new space",
              )
            }
          >
            <Text style={s.primaryText}>Join community or class</Text>
          </Pressable>
        </View>
      )}
      {expanded === "create" && (
        <View style={s.form}>
          <Text style={s.cardTitle}>Create a community</Text>
          <TextInput
            value={communityName}
            onChangeText={setCommunityName}
            placeholder="Community or school name"
            style={s.input}
          />
          <View style={s.chips}>
            {[
              ["neighborhood", "Neighborhood"],
              ["school", "School"],
              ["faith", "Faith group"],
              ["club", "Club"],
            ].map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => setCommunityKind(value)}
                style={[s.chip, communityKind === value && s.chipActive]}
              >
                <Text
                  style={[
                    s.chipText,
                    communityKind === value && s.chipTextActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            disabled={saving || communityName.trim().length < 2}
            style={s.primary}
            onPress={() =>
              void run(
                "ecolearn_create_community",
                {
                  p_name: communityName,
                  p_kind: communityKind,
                  p_description: "",
                },
                "Community created",
              )
            }
          >
            <Text style={s.primaryText}>Create and get join code</Text>
          </Pressable>
        </View>
      )}

      <Text style={s.section}>My communities</Text>
      {hub.communities.length ? (
        hub.communities.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setSelectedCommunity(item.id)}
            style={[s.card, selectedCommunity === item.id && s.cardSelected]}
          >
            <View style={s.row}>
              <View style={s.icon}>
                <Ionicons
                  name={item.kind === "school" ? "school" : "people"}
                  size={20}
                  color="#28723d"
                />
              </View>
              <View style={s.flex}>
                <Text style={s.cardTitle}>{item.name}</Text>
                <Text style={s.meta}>
                  {item.kind} · {item.member_count} members ·{" "}
                  {item.classroom_count} classes
                </Text>
              </View>
            </View>
            <View style={s.metrics}>
              <Metric value={item.total_xp} label="XP" />
              <Metric value={item.total_scans} label="checks" />
            </View>
            {item.join_code && (
              <Pressable onPress={() => copyCode(item.join_code)}>
                <Text style={s.link}>Show community join code</Text>
              </Pressable>
            )}
          </Pressable>
        ))
      ) : (
        <Empty text="Join or create a community to learn with people you know." />
      )}

      <Text style={s.section}>My classrooms</Text>
      {hub.classrooms.length ? (
        hub.classrooms.map((item) => (
          <Pressable
            key={item.id}
            onPress={() =>
              item.role === "teacher" && setSelectedClassroom(item.id)
            }
            style={[s.card, selectedClassroom === item.id && s.cardSelected]}
          >
            <View style={s.row}>
              <View style={s.icon}>
                <Ionicons name="easel" size={20} color="#28723d" />
              </View>
              <View style={s.flex}>
                <Text style={s.cardTitle}>{item.name}</Text>
                <Text style={s.meta}>
                  {item.school_name}
                  {item.grade_label ? ` · ${item.grade_label}` : ""} ·{" "}
                  {item.student_count} students
                </Text>
              </View>
            </View>
            <View style={s.metrics}>
              <Metric value={item.total_xp} label="class XP" />
              <Metric value={item.lesson_completions} label="lessons" />
            </View>
            {item.join_code && (
              <>
                <Pressable onPress={() => copyCode(item.join_code)}>
                  <Text style={s.link}>Show student join code</Text>
                </Pressable>
                <Pressable
                  disabled={saving}
                  onPress={() => void createTeacherInvite(item.id)}
                >
                  <Text style={s.link}>Create private teacher invitation</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        ))
      ) : (
        <Empty text="Classes you join will appear here." />
      )}

      {(hub.profile.role === "teacher" || hub.profile.role === "admin") &&
        schools.length > 0 && (
          <>
            <Pressable
              style={s.secondaryWide}
              onPress={() => setExpanded(expanded === "class" ? null : "class")}
            >
              <Ionicons name="add-circle-outline" size={19} color="#276f3c" />
              <Text style={s.secondaryText}>
                Create a class inside a school
              </Text>
            </Pressable>
            {expanded === "class" && (
              <View style={s.form}>
                <Text style={s.cardTitle}>New classroom</Text>
                <View style={s.chips}>
                  {schools.map((school) => (
                    <Pressable
                      key={school.id}
                      onPress={() => setSelectedSchool(school.id)}
                      style={[
                        s.chip,
                        selectedSchool === school.id && s.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          s.chipText,
                          selectedSchool === school.id && s.chipTextActive,
                        ]}
                      >
                        {school.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  value={className}
                  onChangeText={setClassName}
                  placeholder="Class name"
                  style={s.input}
                />
                <TextInput
                  value={grade}
                  onChangeText={setGrade}
                  placeholder="Grade or room (optional)"
                  style={s.input}
                />
                <Pressable
                  disabled={
                    saving || !selectedSchool || className.trim().length < 2
                  }
                  style={s.primary}
                  onPress={() =>
                    void run(
                      "ecolearn_create_classroom",
                      {
                        p_community_id: selectedSchool,
                        p_name: className,
                        p_grade_label: grade,
                      },
                      "Classroom created",
                    )
                  }
                >
                  <Text style={s.primaryText}>Create classroom</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

      {managedClassroom && (
        <>
          <Text style={s.section}>Teacher tools</Text>
          <Text style={s.caption}>
            Managing {managedClassroom.name}. Tap another teacher-owned class
            above to switch.
          </Text>
          <View style={s.toolActions}>
            <Pressable
              style={s.secondaryWide}
              onPress={() =>
                setExpanded(expanded === "assignment" ? null : "assignment")
              }
            >
              <Ionicons name="book-outline" size={18} color="#276f3c" />
              <Text style={s.secondaryText}>Assign lesson</Text>
            </Pressable>
            <Pressable
              style={s.secondaryWide}
              disabled={saving}
              onPress={() => void createTeacherInvite(managedClassroom.id)}
            >
              <Ionicons name="key-outline" size={18} color="#276f3c" />
              <Text style={s.secondaryText}>Invite teacher</Text>
            </Pressable>
          </View>
          {expanded === "assignment" && (
            <View style={s.form}>
              <Text style={s.cardTitle}>Assign a published lesson</Text>
              <View style={s.chips}>
                {lessons.map((lesson) => (
                  <Pressable
                    key={lesson.id}
                    onPress={() => {
                      setAssignmentLesson(lesson.id);
                      setAssignmentTitle(lesson.title);
                    }}
                    style={[
                      s.chip,
                      assignmentLesson === lesson.id && s.chipActive,
                    ]}
                  >
                    <Text
                      style={[
                        s.chipText,
                        assignmentLesson === lesson.id && s.chipTextActive,
                      ]}
                    >
                      {lesson.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={assignmentTitle}
                onChangeText={setAssignmentTitle}
                placeholder="Assignment title"
                style={s.input}
              />
              <TextInput
                value={assignmentDue}
                onChangeText={setAssignmentDue}
                placeholder="Due date (optional, e.g. 2026-09-15)"
                style={s.input}
                autoCapitalize="none"
              />
              <Pressable
                disabled={
                  saving ||
                  !assignmentLesson ||
                  assignmentTitle.trim().length < 2 ||
                  Boolean(
                    assignmentDue && Number.isNaN(Date.parse(assignmentDue)),
                  )
                }
                style={s.primary}
                onPress={() =>
                  void run(
                    "ecolearn_create_assignment",
                    {
                      p_classroom_id: managedClassroom.id,
                      p_lesson_id: assignmentLesson,
                      p_title: assignmentTitle,
                      p_due_at: assignmentDue
                        ? new Date(assignmentDue).toISOString()
                        : null,
                    },
                    "Lesson assigned",
                  )
                }
              >
                <Text style={s.primaryText}>Assign to class</Text>
              </Pressable>
            </View>
          )}
        </>
      )}

      {managedCommunity && (
        <>
          <Text style={s.section}>Community manager tools</Text>
          <Text style={s.caption}>Publishing to {managedCommunity.name}.</Text>
          <View style={s.toolActions}>
            <Pressable
              style={s.secondaryWide}
              onPress={() =>
                setExpanded(expanded === "announcement" ? null : "announcement")
              }
            >
              <Ionicons name="megaphone-outline" size={18} color="#276f3c" />
              <Text style={s.secondaryText}>Post update</Text>
            </Pressable>
            <Pressable
              style={s.secondaryWide}
              onPress={() => setExpanded(expanded === "event" ? null : "event")}
            >
              <Ionicons name="calendar-outline" size={18} color="#276f3c" />
              <Text style={s.secondaryText}>Create event</Text>
            </Pressable>
          </View>
          {expanded === "announcement" && (
            <View style={s.form}>
              <Text style={s.cardTitle}>Community announcement</Text>
              <TextInput
                value={announcementTitle}
                onChangeText={setAnnouncementTitle}
                placeholder="Title"
                style={s.input}
              />
              <TextInput
                value={announcementBody}
                onChangeText={setAnnouncementBody}
                placeholder="Message"
                multiline
                style={[s.input, s.multiline]}
              />
              <Pressable
                disabled={
                  saving ||
                  announcementTitle.trim().length < 2 ||
                  announcementBody.trim().length < 2
                }
                style={s.primary}
                onPress={() =>
                  void run(
                    "ecolearn_create_announcement",
                    {
                      p_scope: "community",
                      p_scope_id: managedCommunity.id,
                      p_title: announcementTitle,
                      p_body: announcementBody,
                    },
                    "Announcement published",
                  )
                }
              >
                <Text style={s.primaryText}>Publish update</Text>
              </Pressable>
            </View>
          )}
          {expanded === "event" && (
            <View style={s.form}>
              <Text style={s.cardTitle}>Community event</Text>
              <TextInput
                value={eventTitle}
                onChangeText={setEventTitle}
                placeholder="Event title"
                style={s.input}
              />
              <TextInput
                value={eventDescription}
                onChangeText={setEventDescription}
                placeholder="Description"
                multiline
                style={[s.input, s.multiline]}
              />
              <TextInput
                value={eventStarts}
                onChangeText={setEventStarts}
                placeholder="Start (e.g. 2026-09-15 15:30)"
                style={s.input}
                autoCapitalize="none"
              />
              <TextInput
                value={eventLocation}
                onChangeText={setEventLocation}
                placeholder="Location"
                style={s.input}
              />
              <Pressable
                disabled={
                  saving ||
                  eventTitle.trim().length < 2 ||
                  Number.isNaN(Date.parse(eventStarts))
                }
                style={s.primary}
                onPress={() =>
                  void run(
                    "ecolearn_create_event",
                    {
                      p_community_id: managedCommunity.id,
                      p_title: eventTitle,
                      p_description: eventDescription,
                      p_starts_at: new Date(eventStarts).toISOString(),
                      p_location: eventLocation,
                    },
                    "Event created",
                  )
                }
              >
                <Text style={s.primaryText}>Publish event</Text>
              </Pressable>
            </View>
          )}
        </>
      )}

      {standings.length > 0 && (
        <>
          <Text style={s.section}>School class standings</Text>
          <Text style={s.caption}>
            Class totals encourage teamwork without exposing individual
            students.
          </Text>
          {standings.map((item, index) => (
            <View key={item.id} style={s.standing}>
              <Text style={s.rank}>#{index + 1}</Text>
              <View style={s.flex}>
                <Text style={s.cardTitle}>{item.name}</Text>
                <Text style={s.meta}>
                  {item.student_count} students · {item.total_scans} checks ·{" "}
                  {item.lesson_completions} lessons
                </Text>
              </View>
              <Text style={s.xp}>{item.total_xp.toLocaleString()} XP</Text>
            </View>
          ))}
        </>
      )}
      {students.length > 0 && (
        <>
          <Text style={s.section}>Teacher class pulse</Text>
          <Text style={s.caption}>
            Private to class teachers and EcoLearn administrators.
          </Text>
          {students.map((student) => (
            <View key={student.user_id} style={s.student}>
              <View style={s.flex}>
                <Text style={s.cardTitle}>{student.alias}</Text>
                <Text style={s.meta}>
                  Level {student.level} · {student.scans} checks ·{" "}
                  {student.lessons} lessons · {student.streak} day streak
                </Text>
              </View>
              <Text style={s.xp}>{student.xp} XP</Text>
            </View>
          ))}
        </>
      )}

      {hub.assignments.length > 0 && (
        <>
          <Text style={s.section}>Assignments</Text>
          {hub.assignments.map((item) => (
            <Pressable key={item.id} style={s.card} onPress={onOpenLesson}>
              <Text style={s.cardTitle}>{item.title}</Text>
              <Text style={s.meta}>
                {item.classroom_name} · {item.lesson_title}
              </Text>
              <Text style={[s.status, item.completed && s.statusDone]}>
                {item.completed
                  ? "Completed"
                  : item.due_at
                    ? `Due ${new Date(item.due_at).toLocaleDateString()}`
                    : "Ready to begin"}
              </Text>
            </Pressable>
          ))}
        </>
      )}
      {hub.announcements.length > 0 && (
        <>
          <Text style={s.section}>Updates</Text>
          {hub.announcements.slice(0, 6).map((item) => (
            <View key={item.id} style={s.card}>
              <Text style={s.cardTitle}>{item.title}</Text>
              <Text style={s.body}>{item.body}</Text>
              <Text style={s.meta}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
          ))}
        </>
      )}
      {hub.events.length > 0 && (
        <>
          <Text style={s.section}>Community events</Text>
          {hub.events.map((item) => (
            <View key={item.id} style={s.card}>
              <Text style={s.cardTitle}>{item.title}</Text>
              <Text style={s.body}>{item.description}</Text>
              <Text style={s.meta}>
                {new Date(item.starts_at).toLocaleString()} · {item.location}
              </Text>
              <Pressable
                disabled={item.rsvped}
                onPress={() =>
                  void run(
                    "ecolearn_rsvp_event",
                    { p_event_id: item.id, p_status: "going" },
                    "RSVP saved",
                  )
                }
              >
                <Text style={s.link}>
                  {item.rsvped
                    ? "You’re going"
                    : `RSVP · ${item.rsvp_count} going`}
                </Text>
              </Pressable>
            </View>
          ))}
        </>
      )}
    </>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <View>
      <Text style={s.metricValue}>{value.toLocaleString()}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <View style={s.empty}>
      <Ionicons name="people-outline" size={23} color="#6b796f" />
      <Text style={s.meta}>{text}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  center: { alignItems: "center", gap: 10, paddingVertical: 80 },
  kicker: {
    color: "#43834e",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.8,
    marginTop: 6,
  },
  title: {
    color: "#173d2a",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1.3,
    marginTop: 8,
  },
  body: { color: "#68766c", fontSize: 14, lineHeight: 22, marginTop: 7 },
  error: {
    flexDirection: "row",
    gap: 9,
    backgroundColor: "#fff3e1",
    borderRadius: 15,
    padding: 13,
    marginTop: 16,
  },
  errorText: { flex: 1, color: "#7f501c", fontSize: 12, lineHeight: 18 },
  profileCard: {
    backgroundColor: "#173d2a",
    borderRadius: 24,
    padding: 19,
    marginTop: 20,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: "#dff0d6",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#173d2a", fontSize: 19, fontWeight: "900" },
  cardTitle: { color: "#173d2a", fontSize: 16, fontWeight: "900" },
  profileTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },
  profileMeta: { color: "#c9d9cc", fontSize: 12, marginTop: 2 },
  meta: { color: "#6b786e", fontSize: 12, lineHeight: 18, marginTop: 2 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dce3da",
    borderRadius: 13,
    minHeight: 47,
    paddingHorizontal: 14,
    marginTop: 13,
    color: "#183d2a",
  },
  accessNote: { color: "#c9d9cc", fontSize: 11, lineHeight: 17, marginTop: 11 },
  actions: { flexDirection: "row", gap: 9, marginTop: 14 },
  toolActions: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  primary: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 15,
    backgroundColor: "#173d2a",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  primaryText: { color: "#fff", fontWeight: "900", textAlign: "center" },
  secondary: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 13,
    backgroundColor: "#edf6e9",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  secondaryWide: {
    minHeight: 49,
    backgroundColor: "#edf6e9",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    marginTop: 12,
  },
  secondaryText: { color: "#276f3c", fontWeight: "900", fontSize: 13 },
  form: {
    borderWidth: 1,
    borderColor: "#dce5d9",
    backgroundColor: "#f7faf5",
    borderRadius: 20,
    padding: 16,
    marginTop: 12,
  },
  multiline: { minHeight: 94, paddingTop: 13, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  chip: {
    borderWidth: 1,
    borderColor: "#d7e1d4",
    borderRadius: 99,
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: "#173d2a", borderColor: "#173d2a" },
  chipText: { color: "#55645a", fontWeight: "700", fontSize: 11 },
  chipTextActive: { color: "#fff" },
  section: {
    color: "#173d2a",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginTop: 28,
    marginBottom: 10,
  },
  caption: { color: "#6b786e", fontSize: 12, marginTop: -5, marginBottom: 9 },
  card: {
    borderWidth: 1,
    borderColor: "#dfe5dc",
    borderRadius: 19,
    padding: 16,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  cardSelected: { borderColor: "#4b9656", backgroundColor: "#f3f9f0" },
  icon: {
    width: 41,
    height: 41,
    borderRadius: 13,
    backgroundColor: "#eaf4e5",
    alignItems: "center",
    justifyContent: "center",
  },
  metrics: {
    flexDirection: "row",
    gap: 32,
    borderTopWidth: 1,
    borderTopColor: "#edf0eb",
    marginTop: 13,
    paddingTop: 12,
  },
  metricValue: { color: "#1d5b32", fontSize: 19, fontWeight: "900" },
  metricLabel: { color: "#77837a", fontSize: 10, fontWeight: "700" },
  link: { color: "#4ba65b", fontWeight: "900", fontSize: 12, marginTop: 13 },
  empty: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#d7dfd5",
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    gap: 5,
  },
  standing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderWidth: 1,
    borderColor: "#dfe5dc",
    backgroundColor: "#fff",
    borderRadius: 17,
    padding: 14,
    marginBottom: 8,
  },
  rank: { color: "#aa7215", fontSize: 17, fontWeight: "900" },
  xp: { color: "#26713c", fontSize: 12, fontWeight: "900" },
  student: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e8ece6",
    paddingVertical: 12,
  },
  status: {
    alignSelf: "flex-start",
    color: "#985e14",
    backgroundColor: "#fff1d7",
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 10,
  },
  statusDone: { color: "#26713c", backgroundColor: "#e3f3de" },
});
