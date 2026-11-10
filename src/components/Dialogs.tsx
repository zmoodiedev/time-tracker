import { useEffect, useState } from "react";
import { AlertTriangle, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { PROJECT_COLORS, projectById, running, useStore } from "@/lib/store";
import type { Project } from "@/lib/types";
import { DAY, HOUR, MIN, dayKey, fmtDuration, fmtHM, fmtTime, fromInputs, toDateTimeInput, toTimeInput } from "@/lib/time";
import { overlapsOther } from "@/lib/stats";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, ProjectPicker } from "./common";

// ---------- Add / edit a time entry ----------

export interface EntryDraft {
  id?: string;
  projectId: string | null;
  start: number;
  end: number | null;
  note?: string;
}

export function EntryDialog({ draft, onClose }: { draft: EntryDraft | null; onClose: () => void }) {
  const { entries, projects, settings, addEntry, updateEntry, deleteEntry, toast } = useStore();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [day, setDay] = useState("");
  const [startHM, setStartHM] = useState("");
  const [endHM, setEndHM] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!draft) return;
    setProjectId(draft.projectId);
    setDay(dayKey(draft.start));
    setStartHM(toTimeInput(draft.start));
    setEndHM(draft.end ? toTimeInput(draft.end) : "");
    setNote(draft.note ?? "");
  }, [draft]);

  const isRunning = !!draft && draft.id !== undefined && draft.end === null;
  const start = day && startHM ? fromInputs(day, startHM) : NaN;
  let end = isRunning ? Date.now() : day && endHM ? fromInputs(day, endHM) : NaN;
  const nextDay = !isRunning && end <= start;
  if (nextDay) end += DAY;
  const minutes = (end - start) / MIN;
  const valid = !!projectId && Number.isFinite(minutes) && minutes >= 1 && minutes <= 24 * 60 && (!isRunning || start <= Date.now());
  const overlap = valid && overlapsOther(entries, draft?.id ?? null, start, end, Date.now());
  // Show archived projects only when this entry already uses one.
  const choices = projects.filter((p) => !p.archived || p.id === projectId);

  const save = () => {
    if (!valid || !draft) return;
    const patch = { projectId: projectId!, start, end: isRunning ? null : end, note: note.trim() || undefined };
    if (draft.id) updateEntry(draft.id, patch);
    else addEntry(patch);
    toast(draft.id ? "Saved" : `Added ${fmtHM(minutes)}`, "win");
    onClose();
  };

  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{draft?.id ? "Edit time" : "Add time"}</DialogTitle>
          <DialogDescription>{isRunning ? "This timer is still running." : "Forgot to track something? Add it here."}</DialogDescription>
        </DialogHeader>

        <ProjectPicker projects={choices} value={projectId} onChange={setProjectId} />

        <Field label="Date">
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="h-11" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Start">
            <Input type="time" value={startHM} onChange={(e) => setStartHM(e.target.value)} className="h-11" />
          </Field>
          <Field label={nextDay ? "End (next day)" : "End"}>
            {isRunning ? (
              <div className="grid h-11 place-items-center rounded-md border border-input text-sm text-primary">Running</div>
            ) : (
              <Input type="time" value={endHM} onChange={(e) => setEndHM(e.target.value)} className="h-11" />
            )}
          </Field>
        </div>
        <div className="-mt-1 text-sm text-muted-foreground">
          Length: <b className="text-foreground tabular-nums">{Number.isFinite(minutes) && minutes > 0 ? fmtDuration(minutes, settings.hourFormat) : "–"}</b>
        </div>

        <Field label="Note (optional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ticket #, what you worked on…" className="h-11" />
        </Field>

        {overlap && (
          <p className="flex items-center gap-2 rounded-lg bg-energy-medium/10 px-3 py-2 text-xs text-energy-medium">
            <AlertTriangle className="size-4 shrink-0" /> This overlaps another entry. That's allowed, but the time will be counted twice.
          </p>
        )}
        {!projectId && <p className="text-xs text-muted-foreground">Pick a project above.</p>}

        <DialogFooter>
          {draft?.id && (
            <Button
              variant="ghost"
              className="h-11 text-destructive"
              onClick={() => {
                deleteEntry(draft.id!);
                onClose();
              }}
            >
              <Trash2 /> Delete
            </Button>
          )}
          <Button className="h-12 text-base" disabled={!valid} onClick={save}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Add / edit a project ----------

export function ProjectDialog({ project, open, onClose, onCreated }: { project: Project | null; open: boolean; onClose: () => void; onCreated?: (id: string) => void }) {
  const { projects, entries, addProject, updateProject, deleteProject, toast } = useStore();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);

  useEffect(() => {
    if (!open) return;
    setName(project?.name ?? "");
    setCode(project?.code ?? "");
    // New projects get the first color nobody's using yet.
    setColor(project?.color ?? PROJECT_COLORS.find((c) => !projects.some((p) => p.color === c)) ?? PROJECT_COLORS[projects.length % PROJECT_COLORS.length]);
  }, [open, project, projects]);

  const used = project ? entries.some((e) => e.projectId === project.id) : false;

  const save = () => {
    if (!name.trim()) return;
    const data = { name: name.trim(), code: code.trim() || undefined, color };
    if (project) updateProject(project.id, data);
    else {
      const id = addProject(data);
      onCreated?.(id);
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>Anything you want to see separately on your timesheet.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Field label="Name">
            <Input autoFocus={!project} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Client X, Support tickets" className="h-11" />
          </Field>
          <Field label="Timesheet code (optional)" hint="Shown next to the name and included in exports.">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. PRJ-1042" className="h-11" />
          </Field>
          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Color</span>
            <div className="grid grid-cols-6 gap-2">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => setColor(c)}
                  className={cn("aspect-square rounded-full border-4 transition-transform", color === c ? "scale-110 border-foreground" : "border-transparent")}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            {project && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11 flex-1"
                  onClick={() => {
                    updateProject(project.id, { archived: !project.archived });
                    toast(project.archived ? "Project restored" : "Project archived. Its time is kept in your reports.", "info");
                    onClose();
                  }}
                >
                  {project.archived ? <ArchiveRestore /> : <Archive />} {project.archived ? "Unarchive" : "Archive"}
                </Button>
                {!used && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 flex-1 text-destructive"
                    onClick={() => {
                      deleteProject(project.id);
                      onClose();
                    }}
                  >
                    <Trash2 /> Delete
                  </Button>
                )}
              </div>
            )}
            <Button type="submit" className="h-12 text-base" disabled={!name.trim()}>
              {project ? "Save" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- "Still working on this?" ----------

/** Asks about timers that have run a long time (or past midnight), so a forgotten timer doesn't ruin a timesheet. */
export function LongRunCheck({ now }: { now: number }) {
  const s = useStore();
  const cur = running(s);
  const [stopAt, setStopAt] = useState("");
  const limit = s.settings.longRunHours * HOUR;
  const since = cur ? Math.max(cur.start, s.longRunAck ?? 0) : now;
  const crossedMidnight = !!cur && dayKey(since) !== dayKey(now);
  const open = !!cur && (now - since >= limit || crossedMidnight);

  useEffect(() => {
    // Best guess for when they actually stopped: the last time they confirmed, or when this check kicked in.
    if (open && cur) setStopAt(toDateTimeInput(Math.min(now, since + limit)));
  }, [open]);

  if (!cur) return null;
  const project = projectById(s, cur.projectId);
  const stopTs = new Date(stopAt).getTime();
  const validStop = Number.isFinite(stopTs) && stopTs > cur.start && stopTs <= now;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && s.ackLongRun()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Still on {project?.name ?? "this"}? 👀</DialogTitle>
          <DialogDescription>
            This timer has been running since {fmtTime(cur.start)}
            {dayKey(cur.start) !== dayKey(now) ? " yesterday or earlier" : ""} ({fmtHM((now - cur.start) / MIN)}). No judgment, it happens.
          </DialogDescription>
        </DialogHeader>
        <Button className="h-12 text-base" onClick={() => s.ackLongRun()}>
          Yes, still going
        </Button>
        <div className="grid gap-2 rounded-xl border p-3">
          <Field label="No, I stopped at:">
            <Input type="datetime-local" value={stopAt} onChange={(e) => setStopAt(e.target.value)} className="h-11" />
          </Field>
          <Button variant="secondary" className="h-11" disabled={!validStop} onClick={() => s.stop(stopTs)}>
            Stop it then
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
