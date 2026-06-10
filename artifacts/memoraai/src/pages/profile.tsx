import { useState, useRef } from "react";
import { useGetProfile, useUpdateProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { UserCircle, Camera, Loader2, X } from "lucide-react";
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

function authHeaders() {
  const token = localStorage.getItem("memora_token");
  return { Authorization: `Bearer ${token}` };
}

export default function Profile() {
  const { data: profile, isLoading } = useGetProfile();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

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
      if (profile.avatarUrl) setAvatarPreview(null); // use saved URL, not preview
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

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image must be under 5MB", variant: "destructive" });
      return;
    }

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      // Step 1: get presigned upload URL
      const urlRes = await fetch("/api/profile/avatar-upload-url", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();

      // Step 2: PUT the file directly to GCS
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");

      // Step 3: serve URL via the objects proxy
      const serveUrl = `/api/storage/objects${objectPath.replace(/^\/objects/, "")}`;

      // Step 4: save avatarUrl to profile
      const patchRes = await fetch("/api/profile", {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: serveUrl }),
      });
      if (!patchRes.ok) throw new Error("Failed to save avatar");

      queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      toast({ title: "Profile photo updated" });
    } catch (err: any) {
      toast({ title: err.message ?? "Upload failed", variant: "destructive" });
      setAvatarPreview(null);
    } finally {
      setUploading(false);
      // reset input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarPreview(null);
    updateProfile.mutate(
      { data: { avatarUrl: "" } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          toast({ title: "Profile photo removed" });
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

  const displayAvatar = avatarPreview || (profile as any)?.avatarUrl;

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      <div>
        <h1 className="text-3xl font-bold font-sans tracking-tight">Identity Configuration</h1>
        <p className="text-muted-foreground mt-1 font-mono text-sm">Manage your system profile.</p>
      </div>

      <div className="bg-card border border-border/50 rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

        {/* Avatar + identity header */}
        <div className="flex items-center gap-6 mb-10 relative">
          <div className="relative group">
            {/* Avatar circle */}
            <div className="w-24 h-24 rounded-full bg-secondary border border-border flex items-center justify-center overflow-hidden shadow-[0_0_30px_rgba(var(--primary),0.15)] ring-1 ring-primary/20">
              {displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl font-bold font-mono text-primary select-none">
                  {profile?.avatarInitials || profile?.email?.[0]?.toUpperCase() || (
                    <UserCircle className="h-12 w-12 opacity-50" />
                  )}
                </span>
              )}
            </div>

            {/* Upload overlay */}
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={uploading}
              className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 cursor-pointer disabled:cursor-wait"
              title="Change photo"
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 text-white animate-spin" />
              ) : (
                <>
                  <Camera className="h-5 w-5 text-white" />
                  <span className="text-[10px] text-white font-mono uppercase">Change</span>
                </>
              )}
            </button>

            {/* Remove button — only shown if there's an existing photo */}
            {displayAvatar && !uploading && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                title="Remove photo"
              >
                <X className="h-3 w-3" />
              </button>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-1">SYSTEM_ID</p>
            <h2 className="text-2xl font-bold">{profile?.name || profile?.email}</h2>
            <p className="text-muted-foreground">{profile?.email}</p>
            <p className="text-xs text-muted-foreground/50 font-mono mt-1">
              {uploading ? "Uploading photo..." : "Hover avatar to change photo"}
            </p>
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
                    <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Avatar Initials (fallback)</FormLabel>
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
              <Button
                type="submit"
                className="font-bold tracking-wide shadow-[0_0_15px_rgba(var(--primary),0.2)]"
                disabled={updateProfile.isPending}
              >
                {updateProfile.isPending ? "Updating..." : "Update Identity"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
