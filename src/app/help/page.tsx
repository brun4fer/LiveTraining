import { Camera, Chrome, Download, Dumbbell, Radio, RotateCcw, ShieldCheck, UserRound, Users } from "lucide-react";
import { Panel } from "@/components/ui";

export default function HelpPage() {
  return <div className="mx-auto max-w-5xl space-y-5"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-leaf-400">Training guide</p><h1 className="mt-2 text-3xl font-bold text-white">Using Live Training</h1><p className="mt-2 text-sm text-slate-400">A compact workflow for collaborative live training analysis.</p></div><div className="grid gap-4 md:grid-cols-2">
    <Item icon={Chrome} title="Recommended browser">Use the latest Google Chrome on the camera computer and staff devices. Camera capture requires HTTPS in production.</Item>
    <Item icon={Camera} title="Camera computer">Use Standard capture normally. Rotate a vertical phone image before recording; the selected orientation is used in preview, replay and exported clips.</Item>
    <Item icon={Dumbbell} title="Exercises">Select Start exercise when work begins and End exercise when it stops. Exercises are numbered automatically and each one receives its own local recording file.</Item>
    <Item icon={Radio} title="Continuous analysis">Recording continues while any staff member rewinds or reviews a saved clip. Starting a new exercise resumes the same training timeline.</Item>
    <Item icon={RotateCcw} title="Replay and Go Live">Move the timeline backwards to review an incident. Go Live returns to the newest available image without changing anyone else’s position.</Item>
    <Item icon={Users} title="Staff collaboration">Invite each staff member from Settings. Everyone watches the same recording but controls playback and personal playlists independently.</Item>
    <Item icon={ShieldCheck} title="Collective moments">Click a moment on the left to save the previous 20 seconds. The clip timing can still be adjusted later.</Item>
    <Item icon={UserRound} title="Player actions">Click a player on the right to save the previous 15 seconds as an independent individual action.</Item>
    <Item icon={Download} title="Review">Use the review page for uploaded or completed video, Playlists for selected collective moments, and Reports for separate moment and player columns.</Item>
  </div></div>;
}

function Item({ icon: Icon, title, children }: { icon: typeof Chrome; title: string; children: React.ReactNode }) { return <Panel className="p-5"><Icon className="text-leaf-400" /><h2 className="mt-4 font-bold text-white">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{children}</p></Panel>; }
