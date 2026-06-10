import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthGuard } from "@/components/auth-guard";
import { Layout } from "@/components/layout";

// Pages
import { useTaskAlarm } from "@/hooks/use-task-alarm";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Notes from "@/pages/notes";
import Tasks from "@/pages/tasks";
import Memories from "@/pages/memories";
import Profile from "@/pages/profile";
import AiCompanion from "@/pages/ai";
import Photos from "@/pages/photos";
import Medications from "@/pages/medications";
import SOS from "@/pages/sos";

const queryClient = new QueryClient();

function AlarmWatcher() {
  useTaskAlarm();
  return null;
}

function ProtectedRoutes() {
  return (
    <AuthGuard>
      <AlarmWatcher />
      <Layout>
        <Switch>
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/notes" component={Notes} />
          <Route path="/tasks" component={Tasks} />
          <Route path="/memories" component={Memories} />
          <Route path="/ai" component={AiCompanion} />
          <Route path="/photos" component={Photos} />
          <Route path="/medications" component={Medications} />
          <Route path="/sos" component={SOS} />
          <Route path="/profile" component={Profile} />
          <Route path="/" component={Dashboard} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </AuthGuard>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route component={ProtectedRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
