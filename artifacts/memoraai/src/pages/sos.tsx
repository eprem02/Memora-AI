import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListSosContacts, 
  getListSosContactsQueryKey,
  useCreateSosContact, 
  useUpdateSosContact,
  useDeleteSosContact 
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AlertOctagon, PhoneCall, Plus, Edit, Trash2, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SOS() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [isPulsing, setIsPulsing] = useState(false);

  const { data: contacts, isLoading } = useListSosContacts();
  const createContact = useCreateSosContact();
  const updateContact = useUpdateSosContact();
  const deleteContact = useDeleteSosContact();

  const handleSOSClick = () => {
    setIsPulsing(true);
    setTimeout(() => setIsPulsing(false), 2000);
    
    if (!contacts || contacts.length === 0) {
      toast({ 
        title: "No Emergency Contacts", 
        description: "Please add an emergency contact first.",
        variant: "destructive"
      });
      return;
    }
    
    if (confirm("EMERGENCY: This will attempt to call your first emergency contact. Proceed?")) {
      window.open(`tel:${contacts[0].phone}`);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this emergency contact?")) {
      deleteContact.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSosContactsQueryKey() });
          toast({ title: "Contact deleted" });
        }
      });
    }
  };

  const ContactForm = ({ initialData, onSubmit, onCancel }: any) => (
    <form 
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        onSubmit({
          name: formData.get("name") as string,
          phone: formData.get("phone") as string,
          relationship: formData.get("relationship") as string,
          notes: formData.get("notes") as string,
        });
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label className="font-mono text-muted-foreground">Full Name</Label>
        <Input name="name" required defaultValue={initialData?.name || ""} className="bg-background" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="font-mono text-muted-foreground">Phone Number</Label>
          <Input type="tel" name="phone" required defaultValue={initialData?.phone || ""} className="bg-background" />
        </div>
        <div className="space-y-2">
          <Label className="font-mono text-muted-foreground">Relationship</Label>
          <Input name="relationship" required defaultValue={initialData?.relationship || ""} className="bg-background" placeholder="e.g. Daughter, Doctor" />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="font-mono text-muted-foreground">Medical Notes (Optional)</Label>
        <Textarea name="notes" defaultValue={initialData?.notes || ""} className="bg-background" placeholder="e.g. Allergies, specific conditions" />
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save Contact</Button>
      </div>
    </form>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      {/* SOS Panel */}
      <section className="flex flex-col items-center justify-center p-12 bg-card border border-destructive/30 rounded-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-destructive/5 pointer-events-none" />
        
        <h1 className="text-3xl font-bold font-mono text-destructive mb-2 relative z-10 flex items-center gap-2">
          <ShieldAlert className="h-8 w-8" />
          Emergency SOS
        </h1>
        <p className="text-muted-foreground text-center mb-10 max-w-md relative z-10">
          Pressing the button below will immediately prompt to call your primary emergency contact.
        </p>

        <button
          onClick={handleSOSClick}
          className={`relative z-10 group flex items-center justify-center w-48 h-48 rounded-full bg-destructive text-destructive-foreground shadow-[0_0_50px_rgba(220,38,38,0.4)] transition-all duration-300 hover:scale-105 active:scale-95 ${
            isPulsing ? "animate-pulse" : ""
          }`}
        >
          <div className="absolute inset-0 rounded-full bg-destructive animate-ping opacity-20" />
          <div className="text-center font-bold tracking-widest text-4xl">SOS</div>
        </button>

        <p className="mt-8 text-sm font-mono text-destructive/80 font-bold uppercase tracking-widest text-center relative z-10">
          Your emergency contacts will be notified
        </p>
      </section>

      {/* Contacts List */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold font-mono text-primary">Emergency Contacts</h2>
            <p className="text-muted-foreground mt-1 text-sm">People to reach out to in case of an emergency.</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary/10 gap-2">
                <Plus className="h-4 w-4" /> Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border sm:max-w-[450px]">
              <DialogHeader>
                <DialogTitle className="font-mono text-primary flex items-center gap-2">
                  <AlertOctagon className="h-5 w-5" /> New Emergency Contact
                </DialogTitle>
              </DialogHeader>
              <ContactForm 
                onCancel={() => setIsAddOpen(false)}
                onSubmit={(data: any) => {
                  createContact.mutate({ data }, {
                    onSuccess: () => {
                      queryClient.invalidateQueries({ queryKey: getListSosContactsQueryKey() });
                      setIsAddOpen(false);
                      toast({ title: "Contact added" });
                    }
                  });
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2].map(i => <div key={i} className="h-32 bg-card animate-pulse rounded-lg border border-border" />)}
          </div>
        ) : contacts?.length === 0 ? (
          <div className="p-8 text-center bg-card border border-border rounded-lg text-muted-foreground">
            <p>You haven't added any emergency contacts yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contacts?.map((contact, index) => (
              <Card key={contact.id} className="bg-card border-border overflow-hidden group">
                {index === 0 && (
                  <div className="bg-primary/20 text-primary text-xs font-mono font-bold text-center py-1 uppercase tracking-wider border-b border-primary/20">
                    Primary Contact
                  </div>
                )}
                <CardContent className="p-5 flex flex-col h-full gap-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                        {contact.name}
                      </h3>
                      <p className="text-sm font-mono text-primary mt-1">{contact.relationship}</p>
                    </div>
                    <div className="flex gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" onClick={() => setEditingContact(contact)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => handleDelete(contact.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {contact.notes && (
                    <div className="text-sm text-muted-foreground bg-background p-2 rounded border border-border mt-auto">
                      <span className="font-bold text-xs uppercase opacity-70 block mb-1">Notes</span>
                      {contact.notes}
                    </div>
                  )}
                  
                  <Button 
                    className="w-full gap-2 font-bold font-mono mt-auto" 
                    variant={index === 0 ? "default" : "secondary"}
                    onClick={() => window.open(`tel:${contact.phone}`)}
                  >
                    <PhoneCall className="h-4 w-4" />
                    Call {contact.phone}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Dialog open={!!editingContact} onOpenChange={(o) => !o && setEditingContact(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="font-mono text-primary flex items-center gap-2">
              <Edit className="h-5 w-5" /> Edit Emergency Contact
            </DialogTitle>
          </DialogHeader>
          {editingContact && (
            <ContactForm 
              initialData={editingContact}
              onCancel={() => setEditingContact(null)}
              onSubmit={(data: any) => {
                updateContact.mutate({ id: editingContact.id, data }, {
                  onSuccess: () => {
                    queryClient.invalidateQueries({ queryKey: getListSosContactsQueryKey() });
                    setEditingContact(null);
                    toast({ title: "Contact updated" });
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
