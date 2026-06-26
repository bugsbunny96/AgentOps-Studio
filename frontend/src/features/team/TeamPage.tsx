/** TODO (T2.3): Team management — member list, invite modal, role management */
export default function TeamPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team</h1>
          <p className="mt-1 text-slate-500">Manage team members and their access</p>
        </div>
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          + Invite Member
        </button>
      </div>
      <div className="rounded-lg border border-dashed border-slate-300 p-12 text-center text-sm text-slate-400">
        Team management — coming in T2.3 (Team & Invites)
      </div>
    </div>
  );
}
