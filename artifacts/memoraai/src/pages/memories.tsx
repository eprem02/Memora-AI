import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListMemories, 
  useCreateMemory, 
  useUpdateMemory, 
  useDeleteMemory,
  getListMemoriesQueryKey 
} from "@workspace/api-client-react";
import { Plus, Search, Trash2, Edit2, Hash, BrainCircuit } from "lucide-react";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

const memorySchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  tags: z.string().transform(str => str.split(",").map(t => t.trim()).filter(Boolean)),
});

export default function Memories() {
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: memories, isLoading } = useListMemories({ search: search || undefined });
  const createMemory = useCreateMemory();
  const updateMemory = useUpdateMemory();
  const deleteMemory = useDeleteMemory();

  const form = useForm<z.infer<typeof memorySchema>>({
    resolver: zodResolver(memorySchema),
    defaultValues: { title: "", content: "", tags: [] as any },
  });

  const onSubmit = (values: z.infer<typeof memorySchema>) => {
    if (editingId) {
      updateMemory.mutate(
        { id: editingId, data: values as any },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListMemoriesQueryKey() });
            setEditingId(null);
            setIsCreateOpen(false);
            form.reset();
            toast({ title: "Memory updated" });
          },
        }
      );
    } else {
      createMemory.mutate(
        { data: values as any },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListMemoriesQueryKey() });
            setIsCreateOpen(false);
            form.reset();
            toast({ title: "Memory created" });
          },
        }
      );
    }
  };

  const handleEdit = (memory: any) => {
    setEditingId(memory.id);
    form.reset({
      title: memory.title,
      content: memory.content,
      tags: memory.tags?.join(", ") as any,
    });
    setIsCreateOpen(true);
  };

  const handleDelete = (id: number) => {
    deleteMemory.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMemoriesQueryKey() });
          toast({ title: "Memory deleted" });
        },
      }
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans tracking-tight">Memory Core</h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">Long-term storage and retrieval.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            setEditingId(null);
            form.reset({ title: "", content: "", tags: [] as any });
          }
        }}>
          <DialogTrigger asChild>
            <Button className="font-bold tracking-wide shadow-[0_0_15px_rgba(var(--primary),0.2)]">
              <Plus className="mr-2 h-4 w-4" /> Store Memory
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] border-border bg-card">
            <DialogHeader>
              <DialogTitle>{editingId ? "Reconstruct Memory" : "Store Memory"}</DialogTitle>
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
                        <Input placeholder="Memory title..." className="bg-background/50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Content</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Detail the memory..." className="min-h-[150px] bg-background/50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Tags (comma separated)</FormLabel>
                      <FormControl>
                        <Input placeholder="project, idea, research..." className="bg-background/50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createMemory.isPending || updateMemory.isPending}>
                    {editingId ? "Update" : "Store"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search memories..." 
          className="pl-10 bg-card/50 border-border/50"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-64 bg-card rounded-xl" />)}
        </div>
      ) : memories?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-border/50 bg-card/30 rounded-xl border-dashed">
          <BrainCircuit className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
          <h3 className="font-semibold text-lg">Memory Core Empty</h3>
          <p className="text-muted-foreground mt-1 text-sm max-w-sm">
            {search ? "No memories match your query." : "Store your first memory to build your knowledge base."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {memories?.map((memory) => (
            <div key={memory.id} className="group flex flex-col p-6 rounded-xl border border-border/50 bg-card/80 backdrop-blur hover:border-primary/40 transition-all duration-500 hover:shadow-[0_0_30px_rgba(var(--primary),0.1)] relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground bg-background/50 backdrop-blur-sm" onClick={() => handleEdit(memory)}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 bg-background/50 backdrop-blur-sm" onClick={() => handleDelete(memory.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              <h3 className="font-bold text-xl mb-3 pr-16 group-hover:text-primary transition-colors">{memory.title}</h3>
              <p className="text-muted-foreground text-sm flex-1 whitespace-pre-wrap leading-relaxed">{memory.content}</p>
              
              <div className="mt-6 flex flex-wrap gap-2 items-center">
                {memory.tags?.map((tag: string, i: number) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-secondary/50 border border-border/50 text-[11px] font-mono text-muted-foreground">
                    <Hash className="h-3 w-3 opacity-50" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
