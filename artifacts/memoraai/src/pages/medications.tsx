import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListMedications, 
  getListMedicationsQueryKey,
  useCreateMedication, 
  useUpdateMedication,
  useDeleteMedication 
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, Pill } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const COLORS = [
  { value: "cyan", hex: "#06b6d4", bg: "bg-cyan-500" },
  { value: "violet", hex: "#8b5cf6", bg: "bg-violet-500" },
  { value: "emerald", hex: "#10b981", bg: "bg-emerald-500" },
  { value: "amber", hex: "#f59e0b", bg: "bg-amber-500" },
  { value: "rose", hex: "#f43f5e", bg: "bg-rose-500" },
];

export default function Medications() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [filter, setFilter] = useState("active");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<any>(null);

  const { data: medications, isLoading } = useListMedications();
  const createMed = useCreateMedication();
  const updateMed = useUpdateMedication();
  const deleteMed = useDeleteMedication();

  const filteredMeds = medications?.filter(m => filter === "all" || m.isActive) || [];

  const handleToggleActive = (id: number, currentStatus: boolean) => {
    updateMed.mutate({ id, data: { isActive: !currentStatus } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMedicationsQueryKey() });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this medication?")) {
      deleteMed.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMedicationsQueryKey() });
          toast({ title: "Medication deleted" });
        }
      });
    }
  };

  const MedForm = ({ initialData, onSubmit, onCancel }: any) => {
    const [color, setColor] = useState(initialData?.color || "cyan");
    const [isActive, setIsActive] = useState(initialData ? initialData.isActive : true);

    return (
      <form 
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          onSubmit({
            name: formData.get("name") as string,
            dosage: formData.get("dosage") as string,
            frequency: formData.get("frequency") as string,
            instructions: formData.get("instructions") as string,
            startDate: formData.get("startDate") ? new Date(formData.get("startDate") as string).toISOString() : undefined,
            endDate: formData.get("endDate") ? new Date(formData.get("endDate") as string).toISOString() : undefined,
            color,
            isActive
          });
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="font-mono text-muted-foreground">Name</Label>
            <Input name="name" required defaultValue={initialData?.name || ""} className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-muted-foreground">Dosage</Label>
            <Input name="dosage" required defaultValue={initialData?.dosage || ""} className="bg-background" placeholder="e.g. 50mg" />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label className="font-mono text-muted-foreground">Frequency</Label>
          <Input name="frequency" required defaultValue={initialData?.frequency || ""} className="bg-background" placeholder="e.g. Twice daily" />
        </div>

        <div className="space-y-2">
          <Label className="font-mono text-muted-foreground">Instructions (Optional)</Label>
          <Textarea name="instructions" defaultValue={initialData?.instructions || ""} className="bg-background min-h-[80px]" placeholder="e.g. Take with food" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="font-mono text-muted-foreground">Start Date</Label>
            <Input type="date" name="startDate" defaultValue={initialData?.startDate?.split('T')[0] || ""} className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-muted-foreground">End Date</Label>
            <Input type="date" name="endDate" defaultValue={initialData?.endDate?.split('T')[0] || ""} className="bg-background" />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="font-mono text-muted-foreground">Color Label</Label>
          <div className="flex gap-2">
            {COLORS.map(c => (
              <button
                key={c.value}
                type="button"
                className={`w-8 h-8 rounded-full ${c.bg} ${color === c.value ? "ring-2 ring-white ring-offset-2 ring-offset-background" : "opacity-70 hover:opacity-100"}`}
                onClick={() => setColor(c.value)}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="med-active" />
            <Label htmlFor="med-active" className="font-mono">Currently Taking</Label>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit">Save Medication</Button>
        </div>
      </form>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-mono text-primary">Medications</h1>
          <p className="text-muted-foreground mt-1">Track your prescriptions and supplements.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Add Medication
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="font-mono text-primary">New Medication</DialogTitle>
            </DialogHeader>
            <MedForm 
              onCancel={() => setIsAddOpen(false)}
              onSubmit={(data: any) => {
                createMed.mutate({ data }, {
                  onSuccess: () => {
                    queryClient.invalidateQueries({ queryKey: getListMedicationsQueryKey() });
                    setIsAddOpen(false);
                    toast({ title: "Medication added" });
                  }
                });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={filter} onValueChange={setFilter} className="w-full">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="active" className="font-mono">Active</TabsTrigger>
          <TabsTrigger value="all" className="font-mono">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-card animate-pulse rounded-lg border border-border" />)}
        </div>
      ) : filteredMeds.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-card border border-border rounded-lg text-muted-foreground text-center">
          <Pill className="h-12 w-12 mb-4 opacity-20" />
          <p>No {filter === 'active' ? 'active ' : ''}medications found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMeds.map((med) => {
            const medColor = COLORS.find(c => c.value === med.color) || COLORS[0];
            return (
              <Card key={med.id} className={`p-4 bg-card border-border flex items-center gap-4 transition-colors hover:border-primary/30 ${!med.isActive ? 'opacity-60' : ''}`}>
                <div className={`w-3 h-16 rounded-full ${medColor.bg} flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold font-mono text-lg truncate text-foreground">{med.name}</h3>
                    {!med.isActive && (
                      <span className="text-[10px] uppercase font-bold tracking-wider bg-secondary text-muted-foreground px-2 py-0.5 rounded-full border border-border">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                    <span className="font-medium text-primary/80">{med.dosage}</span>
                    <span>{med.frequency}</span>
                    {med.instructions && <span className="opacity-70 italic">{med.instructions}</span>}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={med.isActive} 
                    onCheckedChange={() => handleToggleActive(med.id, med.isActive)}
                    title={med.isActive ? "Mark inactive" : "Mark active"}
                  />
                  <div className="w-px h-6 bg-border mx-1" />
                  <Button variant="ghost" size="icon" className="hover:text-primary" onClick={() => setEditingMed(med)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="hover:text-destructive" onClick={() => handleDelete(med.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editingMed} onOpenChange={(o) => !o && setEditingMed(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-mono text-primary">Edit Medication</DialogTitle>
          </DialogHeader>
          {editingMed && (
            <MedForm 
              initialData={editingMed}
              onCancel={() => setEditingMed(null)}
              onSubmit={(data: any) => {
                updateMed.mutate({ id: editingMed.id, data }, {
                  onSuccess: () => {
                    queryClient.invalidateQueries({ queryKey: getListMedicationsQueryKey() });
                    setEditingMed(null);
                    toast({ title: "Medication updated" });
                  }
                });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
