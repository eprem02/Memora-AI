import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListNotes, 
  useCreateNote, 
  useUpdateNote, 
  useDeleteNote,
  getListNotesQueryKey 
} from "@workspace/api-client-react";
import { Plus, Search, Trash2, Edit2, Pin, BookOpen } from "lucide-react";
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

const noteSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  isPinned: z.boolean().default(false),
});

export default function Notes() {
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: notes, isLoading } = useListNotes({ search: search || undefined });
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const form = useForm<z.infer<typeof noteSchema>>({
    resolver: zodResolver(noteSchema),
    defaultValues: { title: "", content: "", isPinned: false },
  });

  const onSubmit = (values: z.infer<typeof noteSchema>) => {
    if (editingId) {
      updateNote.mutate(
        { id: editingId, data: values },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
            setEditingId(null);
            setIsCreateOpen(false);
            form.reset();
            toast({ title: "Note updated" });
          },
        }
      );
    } else {
      createNote.mutate(
        { data: values },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
            setIsCreateOpen(false);
            form.reset();
            toast({ title: "Note created" });
          },
        }
      );
    }
  };

  const handleEdit = (note: any) => {
    setEditingId(note.id);
    form.reset({
      title: note.title,
      content: note.content,
      isPinned: note.isPinned,
    });
    setIsCreateOpen(true);
  };

  const handleDelete = (id: number) => {
    deleteNote.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
          toast({ title: "Note deleted" });
        },
      }
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans tracking-tight">Logs</h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">Capture and organize your thoughts.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            setEditingId(null);
            form.reset({ title: "", content: "", isPinned: false });
          }
        }}>
          <DialogTrigger asChild>
            <Button className="font-bold tracking-wide shadow-[0_0_15px_rgba(var(--primary),0.2)]">
              <Plus className="mr-2 h-4 w-4" /> New Log
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] border-border bg-card">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Log" : "New Log"}</DialogTitle>
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
                        <Input placeholder="Log title..." className="bg-background/50 focus-visible:ring-primary/50" {...field} />
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
                        <Textarea placeholder="Write your thoughts..." className="min-h-[200px] bg-background/50 focus-visible:ring-primary/50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createNote.isPending || updateNote.isPending}>
                    {editingId ? "Update" : "Save"}
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
          placeholder="Search logs..." 
          className="pl-10 bg-card/50 border-border/50 focus-visible:ring-primary/50"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-48 bg-card rounded-xl" />)}
        </div>
      ) : notes?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-border/50 bg-card/30 rounded-xl border-dashed">
          <BookOpen className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
          <h3 className="font-semibold text-lg">No logs found</h3>
          <p className="text-muted-foreground mt-1 text-sm max-w-sm">
            {search ? "No logs match your search criteria." : "Create your first log to start capturing your thoughts."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notes?.map((note) => (
            <div key={note.id} className="group flex flex-col p-5 rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-all duration-300 hover:shadow-[0_0_20px_rgba(var(--primary),0.05)] hover:-translate-y-1">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors flex items-center gap-2">
                  {note.isPinned && <Pin className="h-3 w-3 text-primary" />}
                  {note.title}
                </h3>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleEdit(note)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(note.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-muted-foreground text-sm flex-1 whitespace-pre-wrap line-clamp-4">{note.content}</p>
              <div className="mt-4 pt-4 border-t border-border/50 font-mono text-[10px] text-muted-foreground/60 flex justify-between">
                <span>{new Date(note.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
