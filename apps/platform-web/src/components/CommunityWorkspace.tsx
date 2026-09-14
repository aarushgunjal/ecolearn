import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  ClipboardCopy,
  Flag,
  GraduationCap,
  LoaderCircle,
  Megaphone,
  Plus,
  School,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRoundCheck,
  UserRoundCog,
  UserRoundX,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  type Announcement,
  type Assignment,
  type Classroom,
  type ClassroomDashboard,
  type Community,
  type CommunityEvent,
  type ModerationReport,
  type SchoolStanding,
  useCommunityHub,
} from "@/hooks/useCommunityHub";

type LessonOption = { id: string; title: string };
type HubController = ReturnType<typeof useCommunityHub>;
type Action = (
  key: string,
  work: () => Promise<unknown>,
  success: string,
) => Promise<void>;
type Setter = Dispatch<SetStateAction<string>>;
const communityKinds: Array<[Community["kind"], string]> = [
  ["neighborhood", "Neighborhood"],
  ["faith", "Faith community"],
  ["club", "Club"],
  ["organization", "Organization"],
  ["municipality", "Town / municipality"],
  ["school", "School"],
];
const field =
  "w-full rounded-xl border border-[#dce5d9] bg-white px-4 py-3 text-sm outline-none focus:border-[#4b9656]";
const primary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173d2a] px-4 py-3 text-sm font-bold text-white disabled:opacity-50";
const secondary =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#cfe0ca] bg-white px-3 py-2 text-sm font-bold text-[#2d7340] disabled:opacity-50";

export function CommunityWorkspace({ mode }: { mode: "community" | "school" | "organization" }) {
  const hub = useCommunityHub();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [roleChoice, setRoleChoice] = useState<"student" | "teacher">("student");
  const [alias, setAlias] = useState(hub.data.profile.alias);
  const [communityName, setCommunityName] = useState("");
  const [communityDescription, setCommunityDescription] = useState("");
  const [communityKind, setCommunityKind] = useState<Community["kind"]>(
    mode === "school" ? "school" : mode === "organization" ? "organization" : "neighborhood",
  );
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(
    null,
  );
  const [className, setClassName] = useState("");
  const [grade, setGrade] = useState("");
  const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(
    null,
  );
  const [dashboard, setDashboard] = useState<ClassroomDashboard | null>(null);
  const [detailError, setDetailError] = useState("");
  const [standings, setStandings] = useState<SchoolStanding[]>([]);
  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [assignmentLesson, setAssignmentLesson] = useState("");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentDue, setAssignmentDue] = useState("");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [moderationReports, setModerationReports] = useState<
    ModerationReport[]
  >([]);

  const schoolCommunities = useMemo(
    () => hub.data.communities.filter((item) => item.kind === "school"),
    [hub.data.communities],
  );
  const visibleCommunities =
    mode === "school" ? schoolCommunities : mode === "organization" ? hub.data.communities.filter((item) => item.kind === "organization") : hub.data.communities;
  const selectedCommunity =
    visibleCommunities.find((item) => item.id === selectedCommunityId) ??
    visibleCommunities[0] ??
    null;
  const classrooms = hub.data.classrooms.filter(
    (item) => !selectedCommunity || item.community_id === selectedCommunity.id,
  );
  const selectedClassroom =
    classrooms.find((item) => item.id === selectedClassroomId) ??
    classrooms[0] ??
    null;
  const canTeach =
    hub.data.profile.role === "teacher" || hub.data.profile.role === "admin";
  const canManageCommunity =
    selectedCommunity?.role === "owner" ||
    selectedCommunity?.role === "manager" ||
    hub.data.profile.role === "admin";
  const canManageClassroom =
    selectedClassroom?.role === "teacher" || canManageCommunity;
  const canModerate =
    hub.data.profile.role === "admin" ||
    hub.data.communities.some(
      (item) => item.role === "owner" || item.role === "manager",
    ) ||
    hub.data.classrooms.some((item) => item.role === "teacher");
  const getSchoolStandings = hub.getSchoolStandings;
  const getClassroomDashboard = hub.getClassroomDashboard;
  const getModerationQueue = hub.getModerationQueue;

  useEffect(() => { setAlias(hub.data.profile.alias); setRoleChoice(hub.data.profile.role === "student" ? "student" : "teacher"); }, [hub.data.profile]);
  useEffect(() => {
    if (!hub.user || !canTeach) return;
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
  }, [canTeach, hub.user]);
  useEffect(() => {
    if (!selectedCommunity || selectedCommunity.kind !== "school") {
      setStandings([]);
      return;
    }
    void getSchoolStandings(selectedCommunity.id)
      .then(setStandings)
      .catch(() => setStandings([]));
  }, [getSchoolStandings, selectedCommunity]);
  useEffect(() => {
    let live = true;
    setDashboard(null);
    setDetailError("");
    if (!selectedClassroom || !canManageClassroom) {
      setDashboard(null);
      return;
    }
    void getClassroomDashboard(selectedClassroom.id)
      .then((result) => { if (live) setDashboard(result); })
      .catch((error: unknown) => { if (live) setDetailError(error instanceof Error ? error.message : "Could not load classroom progress. Please retry."); });
    return () => { live = false; };
  }, [canManageClassroom, getClassroomDashboard, selectedClassroom]);
  const refreshModeration = useCallback(async () => {
    if (!canModerate) return setModerationReports([]);
    try {
      setModerationReports(await getModerationQueue());
    } catch {
      setModerationReports([]);
    }
  }, [canModerate, getModerationQueue]);
  useEffect(() => {
    void refreshModeration();
  }, [refreshModeration, hub.data.announcements, hub.data.events]);

  const action = async (
    key: string,
    work: () => Promise<unknown>,
    success: string,
  ) => {
    setBusy(key);
    try {
      await work();
      toast({ title: success });
    } catch (error) {
      toast({
        title: "Could not complete that action",
        description: hub.messageFor(error),
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };
  const copyCode = async (code?: string | null) => {
    if (!code) return;
    try { await navigator.clipboard.writeText(code); toast({ title: "Join code copied", description: code }); }
    catch { toast({ title: "Your join code", description: code }); }
  };

  if (!hub.user) return <SignedOut mode={mode} />;
  if (hub.loading)
    return (
      <div className="grid min-h-[45vh] place-items-center">
        <LoaderCircle className="animate-spin text-[#347c46]" />
      </div>
    );

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[#468b52]">
            {mode === "school" ? (
              <GraduationCap size={18} />
            ) : (
              <Users size={18} />
            )}
            {mode === "school"
              ? "SCHOOL + CLASSROOM NETWORK"
              : "YOUR ECO COMMUNITIES"}
          </p>
          <h1 className="display-serif mt-2 text-4xl tracking-[-.05em] sm:text-5xl">
            {mode === "school"
              ? "Your classrooms"
              : "Your communities and classrooms"}
          </h1>
          <p className="mt-3 max-w-3xl leading-7 text-[#68766c]">
            {mode === "school"
              ? "Students can belong to multiple classes and their school community. Teachers assign lessons and see real progress; class standings use aggregate XP."
              : "Manage your schools, classes, and local groups in one place."}
          </p>
        </div>
        <RolePill role={hub.data.profile.role} />
      </header>

      {hub.error && (
        <div className="mb-5 rounded-2xl border border-[#e7bd7c] bg-[#fff7e7] p-4 text-sm text-[#76551f]">
          {hub.error}
          <button className="ml-3 underline" onClick={() => void hub.refresh()}>Retry</button>
        </div>
      )}

      {detailError && <p role="alert" className="my-4 rounded-xl bg-red-50 p-4">{detailError} <button className="underline" onClick={() => void hub.refresh()}>Retry</button></p>}

      <div className="grid gap-5 xl:grid-cols-[.72fr_1.28fr]">
        <aside className="space-y-5">
          <section className="rounded-2xl border border-[#dde6da] bg-white p-5">
            <div className="flex items-center gap-3">
              <UserRoundCog className="text-[#347d46]" />
              <div>
                <h2 className="font-semibold">Account settings</h2>
                <p className="text-xs text-[#718076]">
                  Choose how your name appears to other members.
                </p>
              </div>
            </div>
            <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-[#617067]">
              Public alias
            </label>
            <input
              className={`${field} mt-2`}
              value={alias}
              maxLength={40}
              onChange={(event) => setAlias(event.target.value)}
            />
            <p className="mt-3 rounded-xl bg-[#f3f7f1] p-3 text-xs leading-5 text-[#627168]">
              Teachers can create their own spaces. Joining another teacher’s classroom requires its invitation code.
            </p>
            <label className="mt-3 block text-sm">Account type
              <select aria-label="Account type" className={field} value={roleChoice} onChange={(event) => setRoleChoice(event.target.value as "student" | "teacher")}><option value="student">Student</option><option value="teacher">Teacher</option></select>
            </label>
            <button
              disabled={busy !== null}
              className={`${primary} mt-3 w-full`}
              onClick={() =>
                void action(
                  "profile",
                  () =>
                    hub.setProfile(
                      alias,
                      roleChoice,
                    ),
                  "Profile saved",
                )
              }
            >
              {busy === "profile" ? (
                <LoaderCircle className="animate-spin" size={16} />
              ) : (
                <Check size={16} />
              )}
              Save profile
            </button>
          </section>

          <section className="rounded-2xl border border-[#dde6da] bg-white p-5">
            <h2 className="font-semibold">Join with a code</h2>
            <p className="mt-2 text-xs">Creators are already members of their spaces.</p>
            <p className="mt-1 text-sm leading-6 text-[#718076]">
              One account can join as many communities and classrooms as you
              need.
            </p>
            <input
              className={`${field} mt-4 uppercase`}
              aria-label="Join code"
              value={joinCode}
              onChange={(event) =>
                setJoinCode(event.target.value.toUpperCase())
              }
              placeholder="CLS-XXXXXXX"
              autoCapitalize="characters"
            />
            <button
              disabled={busy !== null || joinCode.trim().length < 8 || [...hub.data.communities, ...hub.data.classrooms].some((space) => space.join_code === joinCode.trim().toUpperCase())}
              className={`${primary} mt-3 w-full`}
              onClick={() =>
                void action(
                  "join",
                  async () => {
                    await hub.joinSpace(joinCode);
                    setJoinCode("");
                  },
                  "You joined successfully",
                )
              }
            >
              {busy === "join" ? (
                <LoaderCircle className="animate-spin" size={16} />
              ) : (
                <Plus size={16} />
              )}
              Join space
            </button>
          </section>

          {canTeach && (
            <CreateCommunityCard
              mode={mode}
              name={communityName}
              setName={setCommunityName}
              description={communityDescription}
              setDescription={setCommunityDescription}
              kind={communityKind}
              setKind={setCommunityKind}
              busy={busy}
              create={() =>
                action(
                  "community",
                  async () => {
                    const result = await hub.createCommunity(
                      communityName,
                      mode === "school" ? "school" : communityKind,
                      communityDescription,
                    );
                    setCommunityName("");
                    setCommunityDescription("");
                    await copyCode(result.join_code);
                  },
                  mode === "school"
                    ? "School community created"
                    : "Community created",
                )
              }
            />
          )}
          <SafetyCenter
            hub={hub}
            reports={moderationReports}
            canModerate={canModerate}
            busy={busy}
            action={action}
            refreshModeration={refreshModeration}
          />
        </aside>

        <main className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-[#dde6da] bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#4a8b53]">
                  MEMBERSHIPS
                </p>
                <h2 className="mt-1 text-2xl font-semibold">
                  {mode === "school" ? "Your schools" : "Your communities"}
                </h2>
              </div>
              <span className="rounded-full bg-[#eef6ea] px-3 py-1.5 text-xs font-bold text-[#347744]">
                {visibleCommunities.length} joined
              </span>
            </div>
            {!visibleCommunities.length ? (
              <Empty
                icon={mode === "school" ? <School /> : <Building2 />}
                title={
                  mode === "school"
                    ? "No school community yet"
                    : "No communities yet"
                }
                body={
                  canTeach
                    ? "Create one here or join with a code."
                    : "Ask a teacher or community leader for a join code."
                }
              />
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {visibleCommunities.map((community) => (
                  <button
                    key={community.id}
                    onClick={() => {
                      setSelectedCommunityId(community.id);
                      setSelectedClassroomId(null);
                    }}
                    className={`rounded-2xl border p-4 text-left transition ${selectedCommunity?.id === community.id ? "border-[#4b9656] bg-[#f0f8ec]" : "border-[#e1e7de] hover:border-[#a9cda1]"}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e3f1dd] text-[#347b45]">
                        {community.kind === "school" ? (
                          <School size={20} />
                        ) : (
                          <Users size={20} />
                        )}
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold">
                          {community.name}
                        </h3>
                        <p className="mt-1 text-xs capitalize text-[#748177]">
                          {community.kind} · {community.role}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <TinyMetric
                        value={community.member_count}
                        label="Members"
                      />
                      <TinyMetric value={community.total_xp} label="XP" />
                      <TinyMetric value={community.total_scans} label="Scans" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {mode !== "school" && hub.data.classrooms.length > 0 && <section aria-label="Your classrooms" className="rounded-2xl border border-[#dde6da] bg-white p-5">
            <h2 className="font-semibold">Your classrooms</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">{hub.data.classrooms.map((room) => <button key={room.id} className={`${secondary} justify-start text-left`} onClick={() => { setSelectedCommunityId(room.community_id); setSelectedClassroomId(room.id); }}><GraduationCap size={18} /><span>{room.name}<span className="block text-xs font-normal text-[#68766c]">{room.school_name}</span></span></button>)}</div>
          </section>}
          {selectedCommunity && <SpaceActions scope="community" space={selectedCommunity} canDelete={selectedCommunity.can_delete ?? (selectedCommunity.role === "owner" || hub.data.profile.role === "admin")} canLeave={selectedCommunity.role === "member"} hub={hub} action={action} busy={busy} />}
          <details key={selectedCommunity?.id} open={selectedCommunity?.kind !== "school"} className="rounded-2xl border border-[#dde6da] bg-white p-5">
            <summary className="cursor-pointer font-semibold">Updates and events</summary>
            <div className="mt-4">
            <CommunityDetail
              community={selectedCommunity}
              canManage={Boolean(canManageCommunity)}
              hub={hub}
              busy={busy}
              action={action}
              copyCode={copyCode}
              announcementTitle={announcementTitle}
              setAnnouncementTitle={setAnnouncementTitle}
              announcementBody={announcementBody}
              setAnnouncementBody={setAnnouncementBody}
              eventTitle={eventTitle}
              setEventTitle={setEventTitle}
              eventDescription={eventDescription}
              setEventDescription={setEventDescription}
              eventDate={eventDate}
              setEventDate={setEventDate}
              eventLocation={eventLocation}
              setEventLocation={setEventLocation}
            />
            </div>
          </details>
          {selectedCommunity?.kind === "school" && (
            <SchoolDetail
              school={selectedCommunity}
              classrooms={classrooms}
              selectedClassroom={selectedClassroom}
              selectClassroom={setSelectedClassroomId}
              canTeach={canTeach}
              canManageCommunity={Boolean(canManageCommunity)}
              canManageClassroom={Boolean(canManageClassroom)}
              standings={standings}
              dashboard={dashboard}
              hub={hub}
              busy={busy}
              action={action}
              copyCode={copyCode}
              classNameValue={className}
              setClassName={setClassName}
              grade={grade}
              setGrade={setGrade}
              lessons={lessons}
              assignmentLesson={assignmentLesson}
              setAssignmentLesson={setAssignmentLesson}
              assignmentTitle={assignmentTitle}
              setAssignmentTitle={setAssignmentTitle}
              assignmentDue={assignmentDue}
              setAssignmentDue={setAssignmentDue}
            />
          )}
        </main>
      </div>
    </div>
  );
}

type CommunityDetailProps = {
  community: Community | null;
  canManage: boolean;
  hub: HubController;
  busy: string | null;
  action: Action;
  copyCode: (code?: string | null) => Promise<void>;
  announcementTitle: string;
  setAnnouncementTitle: Setter;
  announcementBody: string;
  setAnnouncementBody: Setter;
  eventTitle: string;
  setEventTitle: Setter;
  eventDescription: string;
  setEventDescription: Setter;
  eventDate: string;
  setEventDate: Setter;
  eventLocation: string;
  setEventLocation: Setter;
};
function CommunityDetail({
  community,
  canManage,
  hub,
  busy,
  action,
  copyCode,
  announcementTitle,
  setAnnouncementTitle,
  announcementBody,
  setAnnouncementBody,
  eventTitle,
  setEventTitle,
  eventDescription,
  setEventDescription,
  eventDate,
  setEventDate,
  eventLocation,
  setEventLocation,
}: CommunityDetailProps) {
  if (!community) return null;
  const announcements = hub.data.announcements.filter(
    (item: Announcement) =>
      item.scope === "community" && item.scope_id === community.id,
  );
  const events = hub.data.events.filter(
    (item: CommunityEvent) => item.community_id === community.id,
  );
  return (
    <>
      <section className="rounded-2xl bg-[#173d2a] p-6 text-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#a7d49a]">
              SELECTED COMMUNITY
            </p>
            <h2 className="mt-2 text-2xl font-semibold">{community.name}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#d5e4d1]">
              {community.description ||
                "A shared space for real sustainability learning and action."}
            </p>
          </div>
          {community.join_code && (
            <button
              className="rounded-xl bg-white/10 px-4 py-3 text-left"
              onClick={() => void copyCode(community.join_code)}
            >
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#a7d49a]">
                Member code
              </span>
              <span className="mt-1 flex items-center gap-2 font-mono font-bold">
                <ClipboardCopy size={15} />
                {community.join_code}
              </span>
            </button>
          )}
        </div>
      </section>
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#dde6da] bg-white p-5">
          <div className="flex items-center gap-2">
            <Megaphone className="text-[#3a844a]" size={20} />
            <h2 className="font-semibold">Announcements</h2>
          </div>
          {announcements.length ? (
            <div className="mt-4 space-y-3">
              {announcements.map((item: Announcement) => (
                <article key={item.id} className="rounded-xl bg-[#f4f8f1] p-4">
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#66746a]">
                    {item.body}
                  </p>
                  <p className="mt-2 text-xs text-[#879188]">
                    {item.creator_alias} · {new Date(item.created_at).toLocaleDateString()}
                  </p>
                  {canManage && <DeleteContent kind="announcement" id={item.id} hub={hub} busy={busy} action={action} />}
                  <SafetyActions
                    targetType="announcement"
                    targetId={item.id}
                    createdBy={item.created_by}
                    creatorAlias={item.creator_alias}
                    hub={hub}
                    busy={busy}
                    action={action}
                  />
                </article>
              ))}
            </div>
          ) : (
            <Empty
              icon={<Megaphone />}
              title="No announcements"
              body="Updates from community managers will appear here."
            />
          )}
          {canManage && (
            <div className="mt-4 border-t border-[#e6ebe3] pt-4">
              <input
                className={field}
                value={announcementTitle}
                onChange={(e) => setAnnouncementTitle(e.target.value)}
                placeholder="Announcement title"
              />
              <textarea
                className={`${field} mt-2 min-h-24`}
                value={announcementBody}
                onChange={(e) => setAnnouncementBody(e.target.value)}
                placeholder="Share an update"
              />
              <button
                className={`${primary} mt-3`}
                disabled={
                  busy !== null ||
                  !announcementTitle.trim() ||
                  !announcementBody.trim()
                }
                onClick={() =>
                  void action(
                    "announcement",
                    async () => {
                      await hub.createAnnouncement(
                        "community",
                        community.id,
                        announcementTitle,
                        announcementBody,
                      );
                      setAnnouncementTitle("");
                      setAnnouncementBody("");
                    },
                    "Announcement published",
                  )
                }
              >
                Publish
              </button>
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-[#dde6da] bg-white p-5">
          <div className="flex items-center gap-2">
            <CalendarDays className="text-[#3a844a]" size={20} />
            <h2 className="font-semibold">Upcoming events</h2>
          </div>
          {events.length ? (
            <div className="mt-4 space-y-3">
              {events.map((event: CommunityEvent) => (
                <article
                  key={event.id}
                  className="rounded-xl border border-[#e1e7de] p-4"
                >
                  <h3 className="font-semibold">{event.title}</h3>
                  <p className="mt-1 text-sm text-[#66746a]">
                    {new Date(event.starts_at).toLocaleString()}{" "}
                    {event.location ? `· ${event.location}` : ""}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#718076]">
                    {event.description}
                  </p>
                  <p className="mt-2 text-xs text-[#879188]">
                    Posted by {event.creator_alias}
                  </p>
                  <button
                    className={`${secondary} mt-3`}
                    disabled={busy !== null}
                    onClick={() =>
                      void action(
                        `rsvp-${event.id}`,
                        () => hub.rsvpEvent(event.id, event.rsvped),
                        "RSVP saved",
                      )
                    }
                  >
                    {event.rsvped
                      ? "Cancel RSVP"
                      : `RSVP · ${event.rsvp_count} going`}
                  </button>
                  {canManage && <DeleteContent kind="event" id={event.id} hub={hub} busy={busy} action={action} />}
                  <SafetyActions
                    targetType="event"
                    targetId={event.id}
                    createdBy={event.created_by}
                    creatorAlias={event.creator_alias}
                    hub={hub}
                    busy={busy}
                    action={action}
                  />
                </article>
              ))}
            </div>
          ) : (
            <Empty
              icon={<CalendarDays />}
              title="No upcoming events"
              body="Community cleanups, workshops, and challenges will appear here."
            />
          )}
          {canManage && (
            <div className="mt-4 border-t border-[#e6ebe3] pt-4">
              <input
                className={field}
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="Event title"
              />
              <textarea
                className={`${field} mt-2 min-h-20`}
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
                placeholder="What will happen?"
              />
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <input
                  type="datetime-local"
                  className={field}
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
                <input
                  className={field}
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  placeholder="Location"
                />
              </div>
              <button
                className={`${primary} mt-3`}
                disabled={busy !== null || !eventTitle.trim() || !eventDate}
                onClick={() =>
                  void action(
                    "event",
                    async () => {
                      await hub.createEvent(
                        community.id,
                        eventTitle,
                        eventDescription,
                        new Date(eventDate).toISOString(),
                        eventLocation,
                      );
                      setEventTitle("");
                      setEventDescription("");
                      setEventDate("");
                      setEventLocation("");
                    },
                    "Event created",
                  )
                }
              >
                Create event
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

const reportReasons: Array<[ModerationReport["reason"], string]> = [
  ["inappropriate", "Inappropriate content"],
  ["bullying", "Bullying or harassment"],
  ["spam", "Spam or misleading content"],
  ["privacy", "Personal or private information"],
  ["other", "Another safety concern"],
];

function SafetyActions({
  targetType,
  targetId,
  createdBy,
  creatorAlias,
  hub,
  busy,
  action,
}: {
  targetType: "announcement" | "event";
  targetId: string;
  createdBy: string;
  creatorAlias: string;
  hub: HubController;
  busy: string | null;
  action: Action;
}) {
  if (!createdBy || createdBy === hub.user?.id) return null;
  const report = () => {
    const entered = window.prompt(
      `Why are you reporting this ${targetType}?\n\nEnter: inappropriate, bullying, spam, privacy, or other`,
      "inappropriate",
    );
    if (!entered) return;
    const reason = entered.trim().toLowerCase() as ModerationReport["reason"];
    if (!reportReasons.some(([value]) => value === reason)) {
      window.alert("Choose inappropriate, bullying, spam, privacy, or other.");
      return;
    }
    const details = window.prompt(
      "Add optional details for the community moderator (500 characters maximum).",
      "",
    );
    if (details === null) return;
    void action(
      `report-${targetId}`,
      () => hub.reportContent(targetType, targetId, reason, details.slice(0, 500)),
      "Report sent to the community moderator",
    );
  };
  const block = () => {
    if (
      !window.confirm(
        `Block ${creatorAlias}? Their announcements and events will disappear for you. You can unblock them from Safety & moderation.`,
      )
    )
      return;
    void action(
      `block-${createdBy}`,
      () => hub.blockUser(createdBy),
      `${creatorAlias} blocked`,
    );
  };
  return (
    <div className="mt-3 flex flex-wrap gap-2 border-t border-[#e5ebe2] pt-3">
      <button
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold text-[#69766d] hover:bg-[#f2f5f0]"
        disabled={busy !== null}
        onClick={report}
      >
        <Flag size={14} /> Report
      </button>
      <button
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold text-[#69766d] hover:bg-[#f2f5f0]"
        disabled={busy !== null}
        onClick={block}
      >
        <UserRoundX size={14} /> Block {creatorAlias}
      </button>
    </div>
  );
}

function SafetyCenter({
  hub,
  reports,
  canModerate,
  busy,
  action,
  refreshModeration,
}: {
  hub: HubController;
  reports: ModerationReport[];
  canModerate: boolean;
  busy: string | null;
  action: Action;
  refreshModeration: () => Promise<void>;
}) {
  return (
    <section className="rounded-2xl border border-[#dde6da] bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eaf4e5] text-[#347b45]">
          <ShieldAlert size={20} />
        </span>
        <div>
          <h2 className="font-semibold">Safety &amp; moderation</h2>
          <p className="mt-1 text-xs leading-5 text-[#718076]">
            Teacher-managed publishing, automatic safety filtering, member reporting, and blocking help keep shared spaces appropriate.
          </p>
        </div>
      </div>

      {hub.data.blocked_users.length > 0 && (
        <div className="mt-4 border-t border-[#e6ebe3] pt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[#617067]">
            Blocked accounts
          </p>
          <div className="mt-2 space-y-2">
            {hub.data.blocked_users.map((blocked) => (
              <div
                key={blocked.user_id}
                className="flex items-center justify-between gap-3 rounded-xl bg-[#f5f8f3] px-3 py-2"
              >
                <span className="text-sm font-semibold text-[#294233]">
                  {blocked.alias}
                </span>
                <button
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2d7340]"
                  disabled={busy !== null}
                  onClick={() =>
                    void action(
                      `unblock-${blocked.user_id}`,
                      () => hub.unblockUser(blocked.user_id),
                      `${blocked.alias} unblocked`,
                    )
                  }
                >
                  <UserRoundCheck size={14} /> Unblock
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {canModerate && (
        <div className="mt-4 border-t border-[#e6ebe3] pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[#617067]">
              Moderator queue
            </p>
            <span className="rounded-full bg-[#eef6ea] px-2.5 py-1 text-[10px] font-bold text-[#347744]">
              {reports.length} open
            </span>
          </div>
          {reports.length ? (
            <div className="mt-3 space-y-3">
              {reports.map((report) => (
                <article
                  key={report.id}
                  className="rounded-xl border border-[#e1e7de] p-3"
                >
                  <p className="text-sm font-semibold text-[#294233]">
                    {report.target_title}
                  </p>
                  <p className="mt-1 line-clamp-3 text-xs leading-5 text-[#718076]">
                    {report.target_body}
                  </p>
                  <p className="mt-2 text-[11px] text-[#7b877e]">
                    {reportReasons.find(([value]) => value === report.reason)?.[1] ?? report.reason} · reported by {report.reporter_alias}
                  </p>
                  {report.details && (
                    <p className="mt-1 text-[11px] italic text-[#7b877e]">
                      “{report.details}”
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#173d2a] px-3 py-2 text-xs font-bold text-white"
                      disabled={busy !== null}
                      onClick={() =>
                        void action(
                          `remove-${report.id}`,
                          async () => {
                            await hub.resolveReport(report.id, "remove");
                            await refreshModeration();
                          },
                          "Content removed",
                        )
                      }
                    >
                      <ShieldCheck size={14} /> Remove
                    </button>
                    <button
                      className={`${secondary} min-h-0 px-3 py-2 text-xs`}
                      disabled={busy !== null}
                      onClick={() =>
                        void action(
                          `dismiss-${report.id}`,
                          async () => {
                            await hub.resolveReport(report.id, "dismiss");
                            await refreshModeration();
                          },
                          "Report dismissed",
                        )
                      }
                    >
                      Dismiss
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs leading-5 text-[#718076]">
              No reports need attention.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

type SchoolDetailProps = {
  school: Community | null;
  classrooms: Classroom[];
  selectedClassroom: Classroom | null;
  selectClassroom: Dispatch<SetStateAction<string | null>>;
  canTeach: boolean;
  canManageCommunity: boolean;
  canManageClassroom: boolean;
  standings: SchoolStanding[];
  dashboard: ClassroomDashboard | null;
  hub: HubController;
  busy: string | null;
  action: Action;
  copyCode: (code?: string | null) => Promise<void>;
  classNameValue: string;
  setClassName: Setter;
  grade: string;
  setGrade: Setter;
  lessons: LessonOption[];
  assignmentLesson: string;
  setAssignmentLesson: Setter;
  assignmentTitle: string;
  setAssignmentTitle: Setter;
  assignmentDue: string;
  setAssignmentDue: Setter;
};
function SchoolDetail({
  school,
  classrooms,
  selectedClassroom,
  selectClassroom,
  canTeach,
  canManageCommunity,
  canManageClassroom,
  standings,
  dashboard,
  hub,
  busy,
  action,
  copyCode,
  classNameValue,
  setClassName,
  grade,
  setGrade,
  lessons,
  assignmentLesson,
  setAssignmentLesson,
  assignmentTitle,
  setAssignmentTitle,
  assignmentDue,
  setAssignmentDue,
}: SchoolDetailProps) {
  if (!school) return null;
  return (
    <>
      <section className="rounded-2xl bg-[#173d2a] p-6 text-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#a7d49a]">
              SCHOOL COMMUNITY
            </p>
            <h2 className="mt-2 text-2xl font-semibold">{school.name}</h2>
            <p className="mt-2 text-sm text-[#d5e4d1]">
              {school.member_count} members · {school.classroom_count} classes ·{" "}
              {school.total_xp.toLocaleString()} XP
            </p>
          </div>
          {school.join_code && (
            <button
              className="rounded-xl bg-white/10 px-4 py-3 text-left"
              onClick={() => void copyCode(school.join_code)}
            >
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#a7d49a]">
                School code
              </span>
              <span className="mt-1 flex items-center gap-2 font-mono font-bold">
                <ClipboardCopy size={15} />
                {school.join_code}
              </span>
            </button>
          )}
        </div>
      </section>
      {canTeach && canManageCommunity && (
        <section className="rounded-2xl border border-[#dde6da] bg-white p-5">
          <div className="flex items-center gap-2">
            <Plus className="text-[#347c46]" />
            <h2 className="font-semibold">Create a classroom</h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_.6fr_auto]">
            <input
              className={field}
              value={classNameValue}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="Class name"
            />
            <input
              className={field}
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="Grade / section"
            />
            <button
              className={primary}
              disabled={busy !== null || classNameValue.trim().length < 2}
              onClick={() =>
                void action(
                  "classroom",
                  async () => {
                    const result = await hub.createClassroom(
                      school.id,
                      classNameValue,
                      grade,
                    );
                    setClassName("");
                    setGrade("");
                    await copyCode(result.join_code);
                  },
                  "Classroom created",
                )
              }
            >
              Create
            </button>
          </div>
        </section>
      )}
      <section className="rounded-2xl border border-[#dde6da] bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Classrooms</h2>
          <span className="text-xs font-bold text-[#4b8754]">
            {classrooms.length} visible
          </span>
        </div>
        {classrooms.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {classrooms.map((room: Classroom) => (
              <button
                key={room.id}
                onClick={() => selectClassroom(room.id)}
                className={`rounded-xl border p-4 text-left ${selectedClassroom?.id === room.id ? "border-[#4b9656] bg-[#f0f8ec]" : "border-[#e1e7de]"}`}
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e4f1df] text-[#347c46]">
                    <GraduationCap size={18} />
                  </span>
                  <div>
                    <h3 className="font-semibold">{room.name}</h3>
                    <p className="text-xs text-[#748177]">
                      {room.grade_label || "Classroom"} · {room.role}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-4 text-xs font-semibold text-[#5f6e63]">
                  <span>{room.student_count} students</span>
                  <span>{room.total_xp} XP</span>
                </div>
                {room.join_code && (
                  <span
                    onClick={(event) => {
                      event.stopPropagation();
                      void copyCode(room.join_code);
                    }}
                    className="mt-3 inline-flex items-center gap-1 font-mono text-xs font-bold text-[#317a45]"
                  >
                    <ClipboardCopy size={13} />
                    {room.join_code}
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <Empty
            icon={<GraduationCap />}
            title="No classrooms yet"
            body={
              canManageCommunity
                ? "Create the first classroom for this school."
                : "Join a classroom with its code."
            }
          />
        )}
        {selectedClassroom && canManageClassroom && (
          <button
            className={`${secondary} mt-4`}
            disabled={busy !== null}
            onClick={() => void action("teacher-code", async () => {
              const code = await hub.rotateCode("classroom", selectedClassroom.id, "teacher");
              await copyCode(code);
            }, "Private teacher invitation created")}
          >
            <ClipboardCopy size={15} /> Create teacher invitation
          </button>
        )}
      </section>
      {selectedClassroom && <SpaceActions scope="classroom" space={selectedClassroom} canDelete={Boolean(selectedClassroom.can_delete)} canLeave={!selectedClassroom.can_delete} hub={hub} action={action} busy={busy} />}
      {selectedClassroom && <ClassroomAnnouncements key={selectedClassroom.id} classroom={selectedClassroom} hub={hub} busy={busy} action={action} canManage={canManageClassroom} />}
      <section className="rounded-2xl border border-[#dde6da] bg-white p-5">
        <div className="flex items-center gap-2">
          <Trophy className="text-[#b17813]" />
          <h2 className="font-semibold">Class standings</h2>
        </div>
        <p className="mt-1 text-sm text-[#718076]">
          Only class totals are ranked - student identities stay inside their
          classroom.
        </p>
        {standings.length ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-[#e2e8df]">
            {standings.map((item: SchoolStanding, index: number) => (
              <div
                key={item.id}
                className="grid grid-cols-[42px_1fr_auto] items-center gap-3 border-b border-[#edf0eb] p-4 last:border-0"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#eef5ea] text-sm font-bold text-[#357b45]">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-semibold">{item.name}</h3>
                  <p className="text-xs text-[#748177]">
                    {item.student_count} students · {item.total_scans} scans ·{" "}
                    {item.lesson_completions} lessons
                  </p>
                </div>
                <strong className="text-[#2e7540]">
                  {item.total_xp.toLocaleString()} XP
                </strong>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            icon={<Trophy />}
            title="Standings begin with activity"
            body="Classes appear after teachers create them; totals grow from real student progress."
          />
        )}
      </section>
      {selectedClassroom && (
        <section className="rounded-2xl border border-[#dde6da] bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#4a8b53]">
                {selectedClassroom.role === "teacher"
                  ? "TEACHER DASHBOARD"
                  : "CLASS DASHBOARD"}
              </p>
              <h2 className="mt-1 text-xl font-semibold">
                {selectedClassroom.name}
              </h2>
            </div>
            <BookOpen className="text-[#3a844a]" />
          </div>
          {canManageClassroom && dashboard ? (
            <>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <TinyMetric
                  value={dashboard.students.length}
                  label="Students"
                />
                <TinyMetric
                  value={dashboard.students.reduce((sum, item) => sum + item.xp, 0)}
                  label="Class XP"
                />
                <TinyMetric
                  value={dashboard.students.reduce((sum, item) => sum + item.lessons, 0)}
                  label="Lessons"
                />
              </div>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[540px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wider text-[#748177]">
                    <tr>
                      <th className="pb-3">Student alias</th>
                      <th>Level</th>
                      <th>XP</th>
                      <th>Scans</th>
                      <th>Lessons</th>
                      <th>Streak</th>
                      <th>Membership</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.students.map((student) => (
                      <tr
                        key={student.user_id}
                        className="border-t border-[#edf0eb]"
                      >
                        <td className="py-3 font-semibold">{student.alias}</td>
                        <td>{student.level}</td>
                        <td>{student.xp}</td>
                        <td>{student.scans}</td>
                        <td>{student.lessons}</td>
                        <td>{student.streak}d</td>
                        <td><button className="text-xs underline" disabled={busy !== null} onClick={() => { if (window.confirm(`Remove ${student.alias} from this classroom? Their learning progress is kept.`)) void action("remove-member", () => hub.removeMember(selectedClassroom.id, student.user_id), "Member removed"); }}>Remove member</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-5 border-t border-[#e5ebe2] pt-5">
                <h3 className="font-semibold">Assigned lessons</h3>
                {dashboard.assignments.length === 0 && <p className="my-3 text-sm">No assignments yet.</p>}
                {dashboard.assignments.map((assignment) => <article className="my-3 rounded-xl border p-3" key={assignment.id}><h4 className="font-semibold">{assignment.title}</h4><p className="text-sm">{assignment.completed_count} / {assignment.student_count} students completed{assignment.due_at ? ` · Due ${new Date(assignment.due_at).toLocaleString()}` : ""}</p><DeleteContent kind="assignment" id={assignment.id} hub={hub} busy={busy} action={action} /></article>)}
                <h3 className="font-semibold">Assign a lesson</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <select
                    aria-label="Assignment lesson"
                    className={field}
                    value={assignmentLesson}
                    onChange={(e) => {
                      setAssignmentLesson(e.target.value);
                      const lesson = lessons.find(
                        (item: LessonOption) => item.id === e.target.value,
                      );
                      if (lesson) setAssignmentTitle(lesson.title);
                    }}
                  >
                    {lessons.map((lesson: LessonOption) => (
                      <option key={lesson.id} value={lesson.id}>
                        {lesson.title}
                      </option>
                    ))}
                  </select>
                  <input
                    className={field}
                    value={assignmentTitle}
                    onChange={(e) => setAssignmentTitle(e.target.value)}
                    placeholder="Assignment title"
                  />
                  <input
                    type="datetime-local"
                    aria-label="Assignment due date"
                    className={field}
                    value={assignmentDue}
                    onChange={(e) => setAssignmentDue(e.target.value)}
                  />
                  <button
                    className={primary}
                    disabled={
                      busy !== null ||
                      !assignmentLesson ||
                      !assignmentTitle.trim()
                    }
                    onClick={() =>
                      void action(
                        "assignment",
                        async () => {
                          await hub.createAssignment(
                            selectedClassroom.id,
                            assignmentLesson,
                            assignmentTitle,
                            assignmentDue
                              ? new Date(assignmentDue).toISOString()
                              : null,
                          );
                          setAssignmentTitle("");
                          setAssignmentDue("");
                        },
                        "Lesson assigned",
                      )
                    }
                  >
                    Assign lesson
                  </button>
                </div>
              </div>
            </>
          ) : (
            <StudentAssignments
              classroom={selectedClassroom}
              assignments={hub.data.assignments}
            />
          )}
        </section>
      )}
    </>
  );
}

function StudentAssignments({ classroom, assignments }: { classroom: Classroom; assignments: Assignment[] }) {
  const mine = assignments.filter(
    (item: Assignment) => item.classroom_id === classroom.id,
  );
  return mine.length ? (
    <div className="mt-4 space-y-3">
      {mine.map((item: Assignment) => (
        <article
          key={item.id}
          className={`rounded-xl border p-4 ${item.completed ? "border-[#b8d9af] bg-[#f2f9ee]" : "border-[#e0e7dc]"}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm text-[#718076]">
                {item.lesson_title}
                {item.due_at
                  ? ` · Due ${new Date(item.due_at).toLocaleString()}`
                  : ""}
              </p>
              <a className="mt-3 inline-block font-semibold text-[#287440] underline" href={`/learn?lesson=${encodeURIComponent(item.lesson_id)}`}>{item.completed ? "Review lesson" : "Open assigned lesson"}</a>
            </div>
            {item.completed ? (
              <span className="rounded-full bg-[#dff0d8] px-2 py-1 text-xs font-bold text-[#2e7540]">
                Complete
              </span>
            ) : (
              <span className="rounded-full bg-[#fff1d6] px-2 py-1 text-xs font-bold text-[#8b620f]">
                Assigned
              </span>
            )}
          </div>
        </article>
      ))}
    </div>
  ) : (
    <Empty
      icon={<BookOpen />}
      title="No assignments yet"
      body="Teacher-assigned lessons will appear here."
    />
  );
}

type CreateCommunityCardProps = {
  mode: "community" | "school" | "organization"; name: string; setName: Setter; description: string;
  setDescription: Setter; kind: Community["kind"];
  setKind: Dispatch<SetStateAction<Community["kind"]>>; busy: string | null; create: () => Promise<void>;
};
function CreateCommunityCard({
  mode,
  name,
  setName,
  description,
  setDescription,
  kind,
  setKind,
  busy,
  create,
}: CreateCommunityCardProps) {
  return (
    <section className="rounded-2xl border border-[#bcd7b6] bg-[#eff8eb] p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="text-[#347c46]" />
        <h2 className="font-semibold">
          {mode === "school" ? "Create a school" : "Create a community"}
        </h2>
      </div>
      <p className="mt-2 text-sm leading-6 text-[#637269]">
        {mode === "school"
          ? "Create the school first, then add its classrooms."
          : "Teachers and community leaders can create managed spaces."}
      </p>
      <input
        className={`${field} mt-4`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={mode === "school" ? "School name" : "Community name"}
      />
      {mode === "community" && (
        <select
          className={`${field} mt-2`}
          value={kind}
          onChange={(e) => setKind(e.target.value as Community["kind"])}
        >
          {communityKinds.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
        </select>
      )}
      <textarea
        className={`${field} mt-2 min-h-20`}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Purpose and location"
      />
      <button
        className={`${primary} mt-3 w-full`}
        disabled={busy !== null || name.trim().length < 2}
        onClick={() => void create()}
      >
        {busy === "community" ? (
          <LoaderCircle className="animate-spin" size={16} />
        ) : (
          <Plus size={16} />
        )}
        Create
      </button>
    </section>
  );
}
function RolePill({ role }: { role: string }) {
  return (
    <span className="inline-flex items-center gap-2 self-start rounded-full border border-[#cfe0ca] bg-white px-4 py-2 text-sm font-bold capitalize text-[#2e7540]">
      <Sparkles size={16} />
      {role} access
    </span>
  );
}
function TinyMetric({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg bg-[#f5f8f3] px-2 py-2">
      <strong className="block text-[#265d35]">
        {Number(value).toLocaleString()}
      </strong>
      <span className="text-[10px] text-[#78847b]">{label}</span>
    </div>
  );
}
function Empty({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="mt-5 grid place-items-center rounded-xl border border-dashed border-[#d9e3d6] p-7 text-center text-[#718076]">
      <span className="text-[#78a47d]">{icon}</span>
      <h3 className="mt-3 font-semibold text-[#294233]">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-6">{body}</p>
    </div>
  );
}
function SignedOut({ mode }: { mode: string }) {
  return (
    <section className="grid min-h-[55vh] place-items-center rounded-[2rem] border border-[#e4e9df] bg-white p-8 text-center">
      <div className="max-w-lg">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e7f3df] text-[#237342]">
          {mode === "school" ? <GraduationCap /> : <Users />}
        </span>
        <h1 className="mt-5 text-3xl font-semibold tracking-[-.05em]">
          Sign in to join your people.
        </h1>
        <p className="mt-3 leading-7 text-[#69766d]">
          Memberships, classroom assignments, join codes, and community progress
          are private to signed-in members.
        </p>
        <button
          className={`${primary} mt-6`}
          onClick={() => window.dispatchEvent(new Event("ecolearn-open-auth"))}
        >
          Sign in or create an account
        </button>
      </div>
    </section>
  );
}

function SpaceActions({ scope, space, canDelete, canLeave, hub, action, busy }: { scope: "community" | "classroom"; space: { id: string; name: string }; canDelete: boolean; canLeave: boolean; hub: HubController; action: Action; busy: string | null }) {
  const [operation, setOperation] = useState<"delete" | "leave" | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (operation) dialog.current?.showModal(); else dialog.current?.close(); }, [operation]);
  useEffect(() => { setOperation(null); setConfirmation(""); }, [space.id]);
  if (!canDelete && !canLeave) return null;
  return <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#dce5d9] bg-white p-4">
    <span className="mr-auto text-sm font-semibold">Manage {space.name}</span>
    {canDelete && <button disabled={busy !== null} className={`${secondary} text-red-700`} onClick={() => { setConfirmation(""); setOperation("delete"); }}>Delete {scope}</button>}
    {canLeave && <button disabled={busy !== null} className={secondary} onClick={() => setOperation("leave")}>Leave {scope}</button>}
    <dialog ref={dialog} aria-labelledby={`space-confirm-${space.id}`} onCancel={() => setOperation(null)} className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-[#dce5d9] p-6 shadow-2xl backdrop:bg-black/40">
      <form onSubmit={(event) => { event.preventDefault(); if (!operation || (operation === "delete" && confirmation !== space.name)) return; const remove = operation === "delete"; setOperation(null); void action("space-action", () => remove ? hub.deleteSpace(scope, space.id) : hub.leaveSpace(scope, space.id), remove ? "Space deleted" : "You left the space"); }}>
        <h2 id={`space-confirm-${space.id}`} className="text-xl font-semibold">{operation === "delete" ? "Delete" : "Leave"} {space.name}?</h2>
        <p className="my-4 text-sm leading-6">{operation === "delete" ? `This permanently removes this ${scope}, its members and content${scope === "community" ? ", including its classrooms" : ""}. Individual learning progress is kept.` : "You will need an invitation code to rejoin."}</p>
        {operation === "delete" && <label className="block text-sm">Type the name to confirm<input autoFocus className={`${field} mt-2`} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /></label>}
        <div className="mt-5 flex justify-end gap-3"><button type="button" className={secondary} onClick={() => setOperation(null)}>Cancel</button><button className={`${primary} ${operation === "delete" ? "bg-red-700" : ""}`} disabled={operation === "delete" && confirmation !== space.name}>{operation === "delete" ? "Permanently delete" : "Leave space"}</button></div>
      </form>
    </dialog>
  </div>;
}

function DeleteContent({ kind, id, hub, busy, action }: { kind: "announcement" | "assignment" | "event"; id: string; hub: HubController; busy: string | null; action: Action }) {
  return <button className={`${secondary} mt-3`} disabled={busy !== null} onClick={() => { if (window.confirm(`Delete this ${kind}? This cannot be undone.`)) void action(`delete-${id}`, () => hub.deleteContent(kind, id), `${kind} deleted`); }}>Delete {kind}</button>;
}

function ClassroomAnnouncements({ classroom, hub, busy, action, canManage }: { classroom: Classroom; hub: HubController; busy: string | null; action: Action; canManage: boolean }) {
  const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  const announcements = hub.data.announcements.filter((item) => item.scope === "classroom" && item.scope_id === classroom.id);
  return <section className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Classroom announcements</h2>
    {!announcements.length && <p className="my-3 text-sm">No classroom announcements yet.</p>}
    {announcements.map((item) => <article className="my-3 rounded-xl border p-3" key={item.id}><h3 className="font-semibold">{item.title}</h3><p className="my-2 text-sm">{item.body}</p><SafetyActions targetType="announcement" targetId={item.id} createdBy={item.created_by} creatorAlias={item.creator_alias} hub={hub} busy={busy} action={action} />{canManage && <DeleteContent kind="announcement" id={item.id} hub={hub} busy={busy} action={action} />}</article>)}
    {canManage && <div className="mt-4 space-y-3"><input className={field} aria-label="Classroom announcement title" placeholder="Classroom announcement title" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} /><textarea className={field} aria-label="Classroom announcement message" placeholder="Classroom announcement message" maxLength={1200} value={body} onChange={(e) => setBody(e.target.value)} /><button className={primary} disabled={busy !== null || title.trim().length < 2 || body.trim().length < 2} onClick={() => void action("classroom-announcement", async () => { await hub.createAnnouncement("classroom", classroom.id, title, body); setTitle(""); setBody(""); }, "Classroom announcement published")}>Publish classroom announcement</button></div>}
  </section>;
}
