import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListTasks, 
  useCreateTask, 
  useUpdateTask, 
  useDeleteTask,
  getListTasksQueryKey 
} from "@workspace/api-client-react";
import { Plus, Trash2, Edit2, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
});

export default function Tasks() {
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useListTasks({ status: filter });
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const form = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: "", description: "", priority: "medium" },
  });

  const onSubmit = (values: z.infer<typeof taskSchema>) => {
    if (editingId) {
      updateTask.mutate(
        { id: editingId, data: values },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
            setEditingId(null);
            setIsCreateOpen(false);
            form.reset();
            toast({ title: "Task updated" });
          },
        }
      );
    } else {
      createTask.mutate(
        { data: values },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
            setIsCreateOpen(false);
            form.reset();
            toast({ title: "Task created" });
          },
        }
      );
    }
  };

  const handleEdit = (task: any) => {
    setEditingId(task.id);
    form.reset({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
    });
    setIsCreateOpen(true);
  };

  const handleDelete = (id: number) => {
    deleteTask.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          toast({ title: "Task deleted" });
        },
      }
    );
  };

  const toggleStatus = (task: any) => {
    updateTask.mutate(
      { id: task.id, data: { completed: !task.completed } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        },
      }
    );
  };

  const priorityColors = {
    high: "border-destructive text-destructive bg-destructive/10",
    medium: "border-yellow-500 text-yellow-500 bg-yellow-500/10",
    low: "border-blue-500 text-blue-500 bg-blue-500/10",
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans tracking-tight">Directives</h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">Action items and pending operations.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-card/50 border border-border/50 rounded-lg p-1">
            {(["all", "pending", "completed"] as const).map((f) => (
              <button
                key={f}
                className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-md transition-colors ${
                  filter === f 
                    ? "bg-primary text-primary-foreground font-bold shadow-[0_0_10px_rgba(var(--primary),0.3)]" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>

          <Dialog open={isCreateOpen} onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) {
              setEditingId(null);
              form.reset({ title: "", description: "", priority: "medium" });
            }
          }}>
            <DialogTrigger asChild>
              <Button size="icon" className="shadow-[0_0_15px_rgba(var(--primary),0.2)]">
                <Plus className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] border-border bg-card">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Directive" : "New Directive"}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Title</FormLabel>
                        <FormControl>
                          <Input placeholder="What needs to be done?" className="bg-background/50" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Additional details..." className="bg-background/50" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-background/50">
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createTask.isPending || updateTask.isPending}>
                      {editingId ? "Update" : "Save"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 bg-card rounded-xl" />)}
        </div>
      ) : tasks?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-border/50 bg-card/30 rounded-xl border-dashed">
          <CheckCircle2 className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
          <h3 className="font-semibold text-lg">No directives found</h3>
          <p className="text-muted-foreground mt-1 text-sm max-w-sm">
            You have no tasks in this view.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks?.map((task) => (
            <div 
              key={task.id} 
              className={`group flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${
                task.completed 
                  ? 'border-border/30 bg-card/30 opacity-70' 
                  : 'border-border/50 bg-card hover:border-primary/30 hover:shadow-[0_0_15px_rgba(var(--primary),0.05)] hover:-translate-x-1'
              }`}
            >
              <button 
                onClick={() => toggleStatus(task)}
                className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors focus:outline-none"
              >
                {task.completed ? (
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                ) : (
                  <Circle className="h-6 w-6" />
                )}
              </button>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h3 className={`font-semibold text-base truncate transition-colors ${task.completed ? 'line-through text-muted-foreground' : 'group-hover:text-primary'}`}>
                    {task.title}
                  </h3>
                  <Badge variant="outline" className={`font-mono text-[10px] uppercase ${priorityColors[task.priority as keyof typeof priorityColors]}`}>
                    {task.priority}
                  </Badge>
                </div>
                {task.description && (
                  <p className={`text-sm mt-1 truncate ${task.completed ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                    {task.description}
                  </p>
                )}
              </div>

              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleEdit(task)}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(task.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
