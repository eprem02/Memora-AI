import { useQuery } from "@tanstack/react-query";
import {
  Sun,
  CheckCircle2,
  Circle,
  Pill,
  BookOpen,
  BrainCircuit,
  AlertTriangle,
  Clock,
  RefreshCw,
  Loader2,
  Sparkles,
  CalendarDays,
} from "lucide-react";
import { format, parseISO, isToday } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function authHeaders() {
  const token = localStorage.getItem("memora_token");
  return { Authorization: `Bearer ${token}` };
}

type BriefingData = {
  date: string;
  profile: { name: string | null; email: string } | null;
  summary: string | null;
  tasks: {
    dueToday: Array<{ id: number; title: string; priority: string; dueDate: string | null }>;
    overdue: Array<{ id: number; title: string; priority: string; dueDate: string | null }>;
    pending: Array<{ id: number; title: string; priority: string }>;
    completedToday: Array<{ id: number; title: string }>;
  };
  medications: Array<{
    id: number; name: string; dosage: string; frequency: string;
    instructions: string | null; color: string;
  }>;
  notes: Array<{
    id: number; title: string; content: string;
    isPinned: boolean; updatedAt: string;
  }>;
  memories: Array<{
    id: number; title: string; content: string;
    tags: string[]; updatedAt: string;
  }>;
};

async function fetchBriefing(): Promise<BriefingData> {
  const res = await fetch("/api/briefing", { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load briefing");
  return res.json();
}

const priorityColor = {
  high: "border-destructive/50 text-destructive bg-destructive/10",
  medium: "border-yellow-500/50 text-yellow-500 bg-yellow-500/10",
  low: "border-blue-500/50 text-blue-500 bg-blue-500/10",
};

function SectionHeader({ icon: Icon, label, count }: { icon: any; label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-primary" />
      <h2 className="text-xs font-mono font-semibold uppercase tracking-widest text-muted-foreground">{label}</h2>
      {count !== undefined && (
        <span className="ml-auto text-xs font-mono text-muted-foreground/60">{count}</span>
      )}
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-card border border-border/50 rounded-xl p-5", className)}>
      {children}
    </div>
  );
}

function TaskRow({ title, priority, dueDate, overdue }: {
  title: string; priority?: string; dueDate?: string | null; overdue?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-start gap-3 py-2 border-b border-border/30 last:border-0",
      overdue && "opacity-90"
    )}>
      <div className="mt-0.5 shrink-0">
        {overdue
          ? <AlertTriangle className="h-4 w-4 text-destructive" />
          : <Circle className="h-4 w-4 text-muted-foreground/40" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium truncate", overdue && "text-destructive")}>{title}</p>
        {dueDate && (
          <p className="text-[11px] font-mono text-muted-foreground/60 mt-0.5 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(parseISO(dueDate), "MMM d, h:mm a")}
          </p>
        )}
      </div>
      {priority && (
        <Badge variant="outline" className={cn("text-[10px] font-mono uppercase shrink-0",
          priorityColor[priority as keyof typeof priorityColor])}>
          {priority}
        </Badge>
      )}
    </div>
  );
}

export default function DailyBriefing() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["briefing"],
    queryFn: fetchBriefing,
    staleTime: 5 * 60_000, // 5 min — don't hammer Gemini
    gcTime: 10 * 60_000,
  });

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const name = data?.profile?.name || "";
  const dateLabel = format(now, "EEEE, MMMM d");

  const totalTasksToday = (data?.tasks.dueToday.length ?? 0) + (data?.tasks.overdue.length ?? 0);
  const allPendingVisible = [...(data?.tasks.dueToday ?? []), ...(data?.tasks.overdue ?? []), ...(data?.tasks.pending ?? [])];

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Sun className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-bold font-sans tracking-tight">Daily Briefing</h1>
          </div>
          <p className="text-muted-foreground font-mono text-sm flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5" />
            {dateLabel}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="font-mono text-xs gap-2 shrink-0"
        >
          {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-36 w-full rounded-xl bg-card" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-48 rounded-xl bg-card" />
            <Skeleton className="h-48 rounded-xl bg-card" />
            <Skeleton className="h-40 rounded-xl bg-card" />
            <Skeleton className="h-40 rounded-xl bg-card" />
          </div>
        </div>
      ) : error ? (
        <Card className="border-destructive/30 bg-destructive/5 text-center py-10">
          <p className="text-destructive font-mono text-sm">Failed to load briefing. Try refreshing.</p>
        </Card>
      ) : data ? (
        <div className="space-y-4">
          {/* AI Summary */}
          <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-mono font-semibold uppercase tracking-widest text-primary">AI Summary</span>
            </div>
            {data.summary ? (
              <div className="space-y-2">
                <p className="text-base font-semibold text-foreground">
                  {greeting}{name ? `, ${name}` : ""}.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{data.summary}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                {greeting}{name ? `, ${name}` : ""}. Your briefing is ready — AI summary unavailable (rate limited, try refreshing in a minute).
              </p>
            )}
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tasks */}
            <Card>
              <SectionHeader icon={CheckCircle2} label="Tasks" count={allPendingVisible.length} />

              {data.tasks.overdue.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-destructive mb-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Overdue
                  </p>
                  {data.tasks.overdue.map(t => (
                    <TaskRow key={t.id} title={t.title} priority={t.priority} dueDate={t.dueDate} overdue />
                  ))}
                </div>
              )}

              {data.tasks.dueToday.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-primary mb-1">Due Today</p>
                  {data.tasks.dueToday.map(t => (
                    <TaskRow key={t.id} title={t.title} priority={t.priority} dueDate={t.dueDate} />
                  ))}
                </div>
              )}

              {data.tasks.pending.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 mb-1">Pending</p>
                  {data.tasks.pending.map(t => (
                    <TaskRow key={t.id} title={t.title} priority={t.priority} />
                  ))}
                </div>
              )}

              {data.tasks.completedToday.length > 0 && (
                <div className="pt-1 border-t border-border/30 mt-2">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 mb-1">Completed today</p>
                  {data.tasks.completedToday.map(t => (
                    <div key={t.id} className="flex items-center gap-2 py-1.5">
                      <CheckCircle2 className="h-4 w-4 text-primary/60 shrink-0" />
                      <span className="text-sm text-muted-foreground line-through truncate">{t.title}</span>
                    </div>
                  ))}
                </div>
              )}

              {allPendingVisible.length === 0 && data.tasks.completedToday.length === 0 && (
                <p className="text-sm text-muted-foreground/60 font-mono py-4 text-center">All clear — no tasks.</p>
              )}
            </Card>

            {/* Medications */}
            <Card>
              <SectionHeader icon={Pill} label="Medications" count={data.medications.length} />
              {data.medications.length === 0 ? (
                <p className="text-sm text-muted-foreground/60 font-mono py-4 text-center">No active medications.</p>
              ) : (
                <div className="space-y-3">
                  {data.medications.map(m => (
                    <div key={m.id} className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
                      <div
                        className="w-3 h-3 rounded-full mt-1 shrink-0 ring-2 ring-offset-2 ring-offset-card"
                        style={{ backgroundColor: m.color, ringColor: m.color + "40" }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                          {m.dosage} · {m.frequency}
                        </p>
                        {m.instructions && (
                          <p className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">{m.instructions}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Recent Notes */}
            <Card>
              <SectionHeader icon={BookOpen} label="Recent Notes" count={data.notes.length} />
              {data.notes.length === 0 ? (
                <p className="text-sm text-muted-foreground/60 font-mono py-4 text-center">No notes yet.</p>
              ) : (
                <div className="space-y-0">
                  {data.notes.map(n => (
                    <div key={n.id} className="py-2.5 border-b border-border/30 last:border-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold truncate flex-1">{n.title}</p>
                        {n.isPinned && (
                          <span className="text-[10px] font-mono text-primary/70 uppercase tracking-wider">pinned</span>
                        )}
                      </div>
                      {n.content && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{n.content}</p>
                      )}
                      <p className="text-[10px] font-mono text-muted-foreground/40 mt-1">
                        {format(parseISO(n.updatedAt), "MMM d, h:mm a")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Important Memories */}
            <Card>
              <SectionHeader icon={BrainCircuit} label="Important Memories" count={data.memories.length} />
              {data.memories.length === 0 ? (
                <p className="text-sm text-muted-foreground/60 font-mono py-4 text-center">No memories saved yet.</p>
              ) : (
                <div className="space-y-0">
                  {data.memories.map(m => (
                    <div key={m.id} className="py-2.5 border-b border-border/30 last:border-0">
                      <p className="text-sm font-semibold truncate mb-0.5">{m.title}</p>
                      {m.content && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{m.content}</p>
                      )}
                      {m.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {m.tags.slice(0, 4).map(tag => (
                            <span key={tag} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary/80 border border-primary/20">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-[10px] font-mono text-muted-foreground/40 mt-1">
                        {format(parseISO(m.updatedAt), "MMM d")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
