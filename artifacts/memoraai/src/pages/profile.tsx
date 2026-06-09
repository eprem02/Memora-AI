import { useGetProfile, useUpdateProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useEffect } from "react";

const profileSchema = z.object({
  name: z.string().optional(),
  bio: z.string().optional(),
  avatarInitials: z.string().max(2).optional(),
});

export default function Profile() {
  const { data: profile, isLoading } = useGetProfile();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "", bio: "", avatarInitials: "" },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        name: profile.name || "",
        bio: profile.bio || "",
        avatarInitials: profile.avatarInitials || "",
      });
    }
  }, [profile, form]);

  const onSubmit = (values: z.infer<typeof profileSchema>) => {
    updateProfile.mutate(
      { data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          toast({ title: "Identity parameters updated" });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <Skeleton className="h-10 w-48 bg-card" />
        <div className="flex items-center gap-6">
          <Skeleton className="h-24 w-24 rounded-full bg-card" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40 bg-card" />
            <Skeleton className="h-4 w-64 bg-card" />
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full bg-card" />
          <Skeleton className="h-32 w-full bg-card" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      <div>
        <h1 className="text-3xl font-bold font-sans tracking-tight">Identity Configuration</h1>
        <p className="text-muted-foreground mt-1 font-mono text-sm">Manage your system profile.</p>
      </div>

      <div className="bg-card border border-border/50 rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
        
        <div className="flex items-center gap-6 mb-10 relative">
          <div className="w-24 h-24 rounded-full bg-secondary border border-border flex items-center justify-center text-3xl font-bold font-mono text-primary shadow-[0_0_30px_rgba(var(--primary),0.15)] ring-1 ring-primary/20">
            {profile?.avatarInitials || profile?.email?.[0].toUpperCase() || <UserCircle className="h-12 w-12 opacity-50" />}
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-1">SYSTEM_ID</p>
            <h2 className="text-2xl font-bold">{profile?.name || profile?.email}</h2>
            <p className="text-muted-foreground">{profile?.email}</p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 relative">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Display Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your name" className="bg-background/50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="avatarInitials"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Avatar Initials (Max 2)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. JD" maxLength={2} className="bg-background/50 uppercase font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">System Bio</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Tell us about yourself..." className="min-h-[120px] bg-background/50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="pt-4 flex justify-end">
              <Button type="submit" className="font-bold tracking-wide shadow-[0_0_15px_rgba(var(--primary),0.2)]" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? "Updating..." : "Update Identity"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
