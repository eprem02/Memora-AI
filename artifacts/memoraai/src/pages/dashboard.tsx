import { useGetDashboardSummary } from "@workspace/api-client-react";
import { BookOpen, CheckSquare, BrainCircuit, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary();

  if (isLoading || !summary) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64 bg-card" />
          <Skeleton className="h-5 w-96 bg-card" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 bg-card rounded-xl" />)}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Notes",
      value: summary.totalNotes,
      icon: BookOpen,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
      border: "hover:border-blue-400/50 hover:ring-blue-400/20",
      href: "/notes"
    },
    {
      title: "Tasks",
      value: `${summary.completedTasks}/${summary.totalTasks}`,
      icon: CheckSquare,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
      border: "hover:border-emerald-400/50 hover:ring-emerald-400/20",
      href: "/tasks"
    },
    {
      title: "Memories",
      value: summary.totalMemories,
      icon: BrainCircuit,
      color: "text-primary",
      bg: "bg-primary/10",
      border: "hover:border-primary/50 hover:ring-primary/20",
      href: "/memories"
    }
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl font-bold font-sans tracking-tight text-foreground">System Overview</h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm">STATUS: SYNCHRONIZED</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((stat, i) => (
          <Link href={stat.href} key={i}>
            <div className="block cursor-pointer group">
              <Card className={`bg-card/50 backdrop-blur border-border/50 transition-all duration-300 ${stat.border} hover:ring-1 hover:-translate-y-1 hover:shadow-xl`}>
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-2">{stat.title}</p>
                    <p className="text-4xl font-bold font-sans">{stat.value}</p>
                  </div>
                  <div className={`w-14 h-14 rounded-xl ${stat.bg} flex items-center justify-center transition-transform group-hover:scale-110`}>
                    <stat.icon className={`h-7 w-7 ${stat.color}`} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              Recent Logs
            </h2>
            <Link href="/notes">
              <span className="text-xs font-mono text-primary hover:underline cursor-pointer flex items-center gap-1">
                VIEW_ALL <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          </div>
          {summary.recentNotes.length === 0 ? (
            <div className="text-muted-foreground font-mono text-sm p-8 border border-border/50 bg-card/30 rounded-xl text-center">No logs found.</div>
          ) : (
            <div className="space-y-3">
              {summary.recentNotes.map((note) => (
                <Link href={`/notes`} key={note.id}>
                  <div className="p-4 rounded-xl border border-border/50 bg-card hover:bg-secondary/40 transition-colors cursor-pointer block group">
                    <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">{note.title}</h3>
                    <p className="text-muted-foreground text-sm mt-1 line-clamp-1">{note.content}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-muted-foreground" />
              Pending Directives
            </h2>
            <Link href="/tasks">
              <span className="text-xs font-mono text-primary hover:underline cursor-pointer flex items-center gap-1">
                VIEW_ALL <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          </div>
          {summary.recentTasks.length === 0 ? (
            <div className="text-muted-foreground font-mono text-sm p-8 border border-border/50 bg-card/30 rounded-xl text-center">No directives found.</div>
          ) : (
            <div className="space-y-3">
              {summary.recentTasks.map((task) => (
                <Link href={`/tasks`} key={task.id}>
                  <div className="p-4 rounded-xl border border-border/50 bg-card hover:bg-secondary/40 transition-colors cursor-pointer block flex items-center gap-4 group">
                    <div className={`w-4 h-4 rounded-sm flex-shrink-0 ${task.completed ? 'bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]' : 'border border-muted-foreground/50 group-hover:border-primary/50 transition-colors'}`} />
                    <div className="flex-1">
                      <h3 className={`font-medium text-[15px] ${task.completed ? 'line-through text-muted-foreground' : 'group-hover:text-primary transition-colors'}`}>{task.title}</h3>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
