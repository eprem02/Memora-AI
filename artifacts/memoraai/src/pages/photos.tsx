import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListPhotos, 
  getListPhotosQueryKey,
  useCreatePhoto, 
  useUpdatePhoto,
  useDeletePhoto 
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, X, Edit, Trash2, Maximize2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Photos() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<any>(null);
  const [viewingPhoto, setViewingPhoto] = useState<any>(null);

  const { data: photos, isLoading } = useListPhotos();
  const createPhoto = useCreatePhoto();
  const updatePhoto = useUpdatePhoto();
  const deletePhoto = useDeletePhoto();

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const token = localStorage.getItem("memora_token");
      const metaRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          name: file.name, 
          size: file.size, 
          contentType: file.type 
        }),
      });
      
      if (!metaRes.ok) throw new Error("Failed to get upload URL");
      
      const { uploadURL, objectPath } = await metaRes.json();
      
      await fetch(uploadURL, { 
        method: "PUT", 
        headers: { "Content-Type": file.type }, 
        body: file 
      });

      await createPhoto.mutateAsync({ 
        data: { 
          title: file.name, 
          caption: "", 
          objectPath 
        } 
      });

      queryClient.invalidateQueries({ queryKey: getListPhotosQueryKey() });
      toast({ title: "Photo uploaded successfully" });
    } catch (error) {
      toast({ 
        title: "Upload failed", 
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUpdate = (id: number, data: { title?: string; caption?: string }) => {
    updatePhoto.mutate({ id, data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPhotosQueryKey() });
        setEditingPhoto(null);
        toast({ title: "Photo updated" });
      }
    });
  };

  const handleDelete = (id: number) => {
    deletePhoto.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPhotosQueryKey() });
        toast({ title: "Photo deleted" });
        if (viewingPhoto?.id === id) setViewingPhoto(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-mono text-primary">Photos</h1>
          <p className="text-muted-foreground mt-1">Upload and organize your memories.</p>
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
          <Button onClick={handleUploadClick} disabled={isUploading}>
            {isUploading ? (
              <span className="flex items-center gap-2 animate-pulse">
                <Upload className="h-4 w-4" /> Uploading...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Upload className="h-4 w-4" /> Add Photo
              </span>
            )}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="aspect-square bg-card animate-pulse rounded-lg border border-border" />
          ))}
        </div>
      ) : photos?.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-card border border-border rounded-lg text-muted-foreground text-center">
          <Upload className="h-12 w-12 mb-4 opacity-20" />
          <p>No photos uploaded yet.</p>
          <Button variant="outline" className="mt-4" onClick={handleUploadClick}>
            Upload First Photo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos?.map((photo) => (
            <Card key={photo.id} className="overflow-hidden group flex flex-col bg-card border-border hover:border-primary/50 transition-colors">
              <div className="relative aspect-square bg-black">
                <img 
                  src={`/api/storage${photo.objectPath}`} 
                  alt={photo.title || "Photo"} 
                  className="object-cover w-full h-full opacity-90 group-hover:opacity-100 transition-opacity"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                  <div className="flex justify-end gap-2 mb-2">
                    <Button size="icon" variant="secondary" className="h-8 w-8 bg-black/50 hover:bg-primary text-white" onClick={() => setViewingPhoto(photo)}>
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="secondary" className="h-8 w-8 bg-black/50 hover:bg-primary text-white" onClick={() => setEditingPhoto(photo)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="secondary" className="h-8 w-8 bg-black/50 hover:bg-destructive text-white" onClick={() => handleDelete(photo.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="p-3">
                <p className="font-mono text-sm font-bold truncate text-primary">{photo.title}</p>
                <p className="text-xs text-muted-foreground truncate">{photo.caption || "No caption"}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingPhoto} onOpenChange={(o) => !o && setEditingPhoto(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-mono text-primary">Edit Photo</DialogTitle>
          </DialogHeader>
          {editingPhoto && (
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleUpdate(editingPhoto.id, {
                  title: formData.get("title") as string,
                  caption: formData.get("caption") as string,
                });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <label className="text-sm font-mono text-muted-foreground">Title</label>
                <Input name="title" defaultValue={editingPhoto.title || ""} className="bg-background border-border" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-mono text-muted-foreground">Caption</label>
                <Textarea name="caption" defaultValue={editingPhoto.caption || ""} className="bg-background border-border min-h-[100px]" />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setEditingPhoto(null)}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* View Modal */}
      <Dialog open={!!viewingPhoto} onOpenChange={(o) => !o && setViewingPhoto(null)}>
        <DialogContent className="bg-black border-border max-w-[90vw] max-h-[90vh] p-0 overflow-hidden flex flex-col">
          {viewingPhoto && (
            <>
              <div className="flex-1 overflow-auto bg-black/90 flex items-center justify-center p-4">
                <img 
                  src={`/api/storage${viewingPhoto.objectPath}`} 
                  alt={viewingPhoto.title} 
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="bg-card p-4 border-t border-border flex justify-between items-center">
                <div>
                  <h3 className="font-mono font-bold text-primary">{viewingPhoto.title}</h3>
                  <p className="text-sm text-muted-foreground">{viewingPhoto.caption}</p>
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {format(new Date(viewingPhoto.createdAt), "MMM d, yyyy")}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
