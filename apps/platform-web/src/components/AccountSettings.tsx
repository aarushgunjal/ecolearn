import { appDialog } from "@/lib/app-dialog";
import { useCallback, useEffect, useState } from "react";
import { useCommunityHub } from "@/hooks/useCommunityHub";
import { supabase } from "@/integrations/supabase/client";
import { AdminSecurity } from "./AdminSecurity";

type Request = {
  user_id: string;
  organization: string;
  reason: string;
  status: string;
};
export function AccountSettings() {
  const hub = useCommunityHub();
  const [alias, setAlias] = useState("");
  const [organization, setOrganization] = useState("");
  const [reason, setReason] = useState("");
  const [requests, setRequests] = useState<Request[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const [confirmStudent, setConfirmStudent] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  useEffect(() => setAlias(hub.data.profile.alias), [hub.data.profile.alias]);
  const refreshRequests = useCallback(async () => {
    const result = await supabase
      .from("ecolearn_teacher_requests")
      .select("user_id,organization,reason,status")
      .order("created_at");
    if (result.error)
      throw new Error("Could not load teacher requests. Please retry.");
    setRequests((result.data ?? []) as Request[]);
  }, []);
  useEffect(() => {
    void refreshRequests().catch((e) => setFailure(e.message));
  }, [refreshRequests, hub.data.profile.role]);
  const run = async (work: () => Promise<void>, success: string) => {
    if (busy) return;
    setBusy(true);
    setFailure("");
    setMessage("");
    try {
      await work();
      await hub.refresh();
      await refreshRequests();
      setMessage(success);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Please retry.");
    } finally {
      setBusy(false);
    }
  };
  const teacher = hub.data.profile.role !== "student";
  const own = requests.find((r) => r.user_id === hub.user?.id);
  const activeManaged =
    hub.data.communities.filter(
      (c) => c.role === "owner" || c.role === "manager",
    ).length + hub.data.classrooms.filter((c) => c.role === "teacher").length;
  const field = "mt-2 w-full rounded-xl border border-[#dce5d9] bg-white p-3";
  const button =
    "min-h-11 rounded-xl bg-[#173d2a] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50";
  return (
    <section
      className="mt-7 rounded-2xl border border-[#dce5d9] bg-white p-6"
      aria-label="Account settings"
    >
      <h2 className="text-xl font-semibold">Account settings</h2>
      {hub.error && (
        <p role="alert">
          {hub.error} <button onClick={() => void hub.refresh()}>Retry</button>
        </p>
      )}
      <p className="mt-2 text-sm text-[#58675d]">
        {teacher ? "Educator account" : "Student account"}
      </p>
      <label className="mt-4 block text-sm font-semibold">
        Community display name
        <input
          aria-label="Community display name"
          className={field}
          value={alias}
          maxLength={40}
          onChange={(e) => setAlias(e.target.value)}
        />
      </label>
      <button
        className={`${button} mt-3`}
        disabled={
          busy || hub.loading || Boolean(hub.error) || alias.trim().length < 2
        }
        onClick={() =>
          void run(async () => {
            await hub.setProfile(alias, teacher ? "teacher" : "student");
          }, "Display name saved")
        }
      >
        Save community name
      </button>
      {failure && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {failure}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-[#24633a]">
          {message}
        </p>
      )}
      <details className="mt-5 border-t pt-4">
        <summary className="cursor-pointer font-semibold">
          Teacher access
        </summary>
        {teacher ? (
          <div className="mt-3 space-y-3 text-sm">
            <p>
              Use Student preview in Community to see your class from a
              learner's perspective without changing your account.
            </p>
            {hub.data.profile.role !== "admin" && (
              <>
                <p>
                  {activeManaged
                    ? "You manage active learning spaces. Leave or delete them before changing your account. Deleted spaces do not block this change."
                    : "You can change to a student account. Restoring deleted spaces will require approved teacher access again."}
                </p>
                {!confirmStudent ? (
                  <button
                    className="min-h-11 underline"
                    disabled={
                      busy ||
                      activeManaged > 0 ||
                      hub.loading ||
                      Boolean(hub.error)
                    }
                    onClick={() => setConfirmStudent(true)}
                  >
                    Change to a student account
                  </button>
                ) : (
                  <div className="rounded-xl border p-4">
                    <p className="mb-3">
                      Confirm that you want to give up teacher access.
                    </p>
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await hub.setProfile(alias, "student");
                          setConfirmStudent(false);
                        }, "Account changed to student")
                      }
                    >
                      Confirm student account
                    </button>
                    <button
                      className="ml-4 min-h-11 underline"
                      disabled={busy}
                      onClick={() => setConfirmStudent(false)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-3 text-sm">
            <p>
              Ask your school owner for a private teacher invitation, or request
              approval from an EcoLearn administrator.
            </p>
            {own?.status === "pending" ? (
              <p role="status">
                Your teacher access request is awaiting review.
              </p>
            ) : (
              <>
                {own?.status === "declined" && (
                  <p>
                    Your previous request was not approved. Update your details
                    before requesting again.
                  </p>
                )}
                <label className="block">
                  School or organization
                  <input
                    className={field}
                    value={organization}
                    maxLength={120}
                    onChange={(e) => setOrganization(e.target.value)}
                  />
                </label>
                <label className="block">
                  Your teaching role
                  <textarea
                    className={field}
                    value={reason}
                    maxLength={1000}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Describe who you teach and how you plan to use EcoLearn."
                  />
                </label>
                <button
                  className={button}
                  disabled={
                    busy ||
                    organization.trim().length < 2 ||
                    reason.trim().length < 10
                  }
                  onClick={() =>
                    void run(async () => {
                      const r = await supabase.rpc(
                        "ecolearn_request_teacher_access",
                        { p_organization: organization, p_reason: reason },
                      );
                      if (r.error) throw new Error(r.error.message);
                    }, "Teacher access requested")
                  }
                >
                  Request teacher access
                </button>
              </>
            )}
          </div>
        )}
        {hub.data.profile.role === "admin" && (
          <div className="mt-5 space-y-3">
            <h3 className="font-semibold">Pending teacher requests</h3>
            {requests.filter((r) => r.status === "pending").length === 0 && (
              <p className="text-sm">No pending requests.</p>
            )}
            {requests
              .filter((r) => r.status === "pending")
              .map((request) => (
                <article
                  key={request.user_id}
                  className="rounded-xl border p-4"
                >
                  <h4 className="font-semibold">{request.organization}</h4>
                  <p className="my-3 whitespace-pre-wrap text-sm">
                    {request.reason}
                  </p>
                  {[true, false].map((approve) => (
                    <button
                      key={String(approve)}
                      disabled={busy}
                      className="mr-4 min-h-11 underline"
                      onClick={async () => {
                        if (
                          await appDialog.confirm(
                            `${approve ? "Approve" : "Decline"} this teacher request for ${request.organization}?`,
                          )
                        )
                          void run(async () => {
                            const r = await supabase.rpc(
                              "ecolearn_review_teacher_access",
                              {
                                p_user_id: request.user_id,
                                p_approve: approve,
                              },
                            );
                            if (r.error) throw new Error(r.error.message);
                          }, "Request reviewed");
                      }}
                    >
                      {approve ? "Approve request" : "Decline request"}
                    </button>
                  ))}
                </article>
              ))}
          </div>
        )}
      </details>
      <div className="mt-5 border-t pt-4">
        <button
          className="min-h-11 font-semibold"
          aria-expanded={securityOpen}
          onClick={() => setSecurityOpen(!securityOpen)}
        >
          Security settings
        </button>
        {securityOpen && (
          <div>
            <p className="text-sm text-[#58675d]">
              Administrator verification protects access to platform management.
              Student and teacher learning does not require an authenticator.
            </p>
            <AdminSecurity />
          </div>
        )}
      </div>
    </section>
  );
}
