import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin } from "@workspace/api-client-react";
import { BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const login = useLogin();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    login.mutate(
      { data: values },
      {
        onSuccess: (res) => {
          localStorage.setItem("memora_token", res.token);
          setLocation("/dashboard");
        },
        onError: (err) => {
          toast({
            title: "Login failed",
            description: err.data?.error || "An error occurred",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md space-y-8 animate-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 ring-1 ring-primary/30 shadow-[0_0_30px_rgba(var(--primary),0.2)]">
            <BrainCircuit className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold font-sans tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground mt-2 font-mono text-sm">Enter your credentials to access your second brain.</p>
        </div>

        <div className="bg-card border border-border p-6 sm:p-8 rounded-xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Email</FormLabel>
                    <FormControl>
                      <Input placeholder="name@example.com" className="bg-background/50 focus-visible:ring-primary/50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" className="bg-background/50 focus-visible:ring-primary/50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full font-bold tracking-wide shadow-[0_0_15px_rgba(var(--primary),0.2)]" disabled={login.isPending}>
                {login.isPending ? "Authenticating..." : "Authenticate"}
              </Button>
            </form>
          </Form>

          <div className="mt-8 text-center text-sm">
            <span className="text-muted-foreground">Don't have an account? </span>
            <Link href="/register">
              <span className="text-primary hover:underline cursor-pointer font-medium">Initialize one</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
