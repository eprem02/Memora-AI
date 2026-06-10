import { Link, useLocation } from "wouter";
import { useLogout, useGetMe } from "@workspace/api-client-react";
import {
  LayoutDashboard,
  BookOpen,
  CheckSquare,
  BrainCircuit,
  UserCircle,
  LogOut,
  Menu,
  Bot,
  Image as ImageIcon,
  Pill,
  AlertOctagon,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/briefing", label: "Daily Briefing", icon: Sun },
  { href: "/ai", label: "AI Companion", icon: Bot },
  { href: "/notes", label: "Notes", icon: BookOpen },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/memories", label: "Memories", icon: BrainCircuit },
  { href: "/photos", label: "Photos", icon: ImageIcon },
  { href: "/medications", label: "Medications", icon: Pill },
  { href: "/sos", label: "Emergency SOS", icon: AlertOctagon },
  { href: "/profile", label: "Profile", icon: UserCircle },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user } = useGetMe();
  const logout = useLogout();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        localStorage.removeItem("memora_token");
        setLocation("/login");
      },
    });
  };

  const NavContent = () => (
    <div className="flex flex-col h-full bg-card border-r border-border">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center ring-1 ring-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.3)]">
          <BrainCircuit className="text-primary-foreground h-5 w-5" />
        </div>
        <span className="font-sans font-bold text-xl tracking-tight text-foreground">
          Memora<span className="text-primary">AI</span>
        </span>
      </div>

      <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium ring-1 ring-primary/20"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
                onClick={() => setIsMobileOpen(false)}
              >
                <item.icon className={`h-5 w-5 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border mt-auto">
        <div className="flex items-center justify-between px-3 py-2 mb-2 bg-secondary/30 rounded-md">
          <span className="text-sm font-medium font-mono text-muted-foreground truncate">
            {user?.name || user?.email}
          </span>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex text-foreground">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-64 fixed inset-y-0 left-0 z-50">
        <NavContent />
      </div>

      {/* Mobile Topbar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 border-b border-border bg-card/80 backdrop-blur-md z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <BrainCircuit className="text-primary h-6 w-6" />
          <span className="font-bold text-lg">MemoraAI</span>
        </div>
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 border-r-border">
            <NavContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content */}
      <div className="flex-1 md:ml-64 pt-16 md:pt-0 bg-background">
        <main className="max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
          {children}
        </main>
      </div>
    </div>
  );
}
