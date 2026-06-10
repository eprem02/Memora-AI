import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import {
  useListAiConversations,
  getListAiConversationsQueryKey,
  useCreateAiConversation,
  useDeleteAiConversation,
  useGetAiConversation,
  getGetAiConversationQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  Plus,
  Trash2,
  Bot,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Loader2,
  MessageSquare,
  Brain,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// ─── Speech Recognition types ────────────────────────────────────────────────
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

const SpeechRec =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

// ─── TTS helper ───────────────────────────────────────────────────────────────
function speakText(text: string): SpeechSynthesisUtterance {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => /natural|enhanced|google/i.test(v.name)) ?? voices[0];
  if (preferred) utterance.voice = preferred;
  window.speechSynthesis.speak(utterance);
  return utterance;
}

// ─── AI Memories API (raw fetch — no codegen) ─────────────────────────────────
type AiMemory = { id: number; content: string; createdAt: string };

function authHeaders() {
  const token = localStorage.getItem("memora_token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function fetchMemories(): Promise<AiMemory[]> {
  const res = await fetch("/api/ai/memories", { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to load memories");
  return res.json();
}

async function deleteMemory(id: number): Promise<void> {
  const res = await fetch(`/api/ai/memories/${id}`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok && res.status !== 204) throw new Error("Failed to delete memory");
}

const MEM_KEY = ["ai", "memories"];

export default function AiCompanion() {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [assistantDraft, setAssistantDraft] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [playingMsgId, setPlayingMsgId] = useState<number | null>(null);
  const [showMemories, setShowMemories] = useState(false);

  const { data: conversations } = useListAiConversations();
  const createConv = useCreateAiConversation();
  const deleteConv = useDeleteAiConversation();
  const { data: activeConv } = useGetAiConversation(activeId!, {
    query: { enabled: !!activeId },
  });
  const { data: memories, isLoading: memoriesLoading } = useQuery({
    queryKey: MEM_KEY,
    queryFn: fetchMemories,
    staleTime: 30_000,
  });
  const deleteMem = useMutation({
    mutationFn: deleteMemory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MEM_KEY }),
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<InstanceType<typeof SpeechRecognition> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeConv?.messages, assistantDraft]);

  // Auto-speak when streaming finishes
  const prevDraftRef = useRef("");
  useEffect(() => {
    if (!autoSpeak) return;
    if (!isStreaming && prevDraftRef.current) {
      const text = prevDraftRef.current;
      prevDraftRef.current = "";
      speakText(text);
    }
    if (assistantDraft) prevDraftRef.current = assistantDraft;
  }, [isStreaming, assistantDraft, autoSpeak]);

  const handleCreate = () => {
    createConv.mutate({ data: {} }, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListAiConversationsQueryKey() });
        setActiveId(data.id);
      },
    });
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteConv.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAiConversationsQueryKey() });
        if (activeId === id) setActiveId(null);
      },
    });
  };

  const handleSend = async () => {
    if (!input.trim() || !activeId) return;
    const messageContent = input.trim();
    setInput("");
    setIsStreaming(true);
    setAssistantDraft("");

    queryClient.setQueryData(getGetAiConversationQueryKey(activeId), (old: any) => {
      if (!old) return old;
      return {
        ...old,
        messages: [
          ...old.messages,
          { id: Date.now(), role: "user", content: messageContent, createdAt: new Date().toISOString() },
        ],
      };
    });

    try {
      const response = await fetch(`/api/ai/conversations/${activeId}/messages`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ content: messageContent }),
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.content) setAssistantDraft((prev) => prev + event.content);
            } catch {}
          }
        }
      }
    } finally {
      setIsStreaming(false);
      setAssistantDraft("");
      queryClient.invalidateQueries({ queryKey: getGetAiConversationQueryKey(activeId) });
      queryClient.invalidateQueries({ queryKey: getListAiConversationsQueryKey() });
      // Refresh memories after a short delay (extraction is async on server)
      setTimeout(() => queryClient.invalidateQueries({ queryKey: MEM_KEY }), 3000);
    }
  };

  const toggleMic = useCallback(() => {
    if (!SpeechRec) return;
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const rec = new SpeechRec();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join("");
      setInput(transcript);
    };
    rec.onend = () => { setIsListening(false); recognitionRef.current = null; inputRef.current?.focus(); };
    rec.onerror = () => { setIsListening(false); recognitionRef.current = null; };
    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  }, [isListening]);

  const handleSpeak = (msgId: number, text: string) => {
    if (playingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setPlayingMsgId(null);
      return;
    }
    window.speechSynthesis.cancel();
    setPlayingMsgId(msgId);
    const utterance = speakText(text);
    utterance.onend = () => setPlayingMsgId(null);
    utterance.onerror = () => setPlayingMsgId(null);
  };

  const hasSpeechSupport = !!SpeechRec;

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">AI Companion</h1>
            <p className="text-xs text-muted-foreground font-mono">Powered by Gemini 2.5 Flash</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMemories(v => !v)}
            title="View stored memories"
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono border transition-colors",
              showMemories
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-secondary border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <Brain className="h-3.5 w-3.5" />
            Memory {memories && memories.length > 0 ? `(${memories.length})` : ""}
          </button>
          <button
            onClick={() => setAutoSpeak(v => !v)}
            title={autoSpeak ? "Auto-speak on" : "Auto-speak off"}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono border transition-colors",
              autoSpeak
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-secondary border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {autoSpeak ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            {autoSpeak ? "Auto-speak on" : "Auto-speak off"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 border border-border rounded-xl overflow-hidden bg-card min-h-0 gap-0">
        {/* Conversations sidebar */}
        <div className="w-52 border-r border-border flex flex-col bg-background/50 shrink-0">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">Chats</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10 hover:text-primary" onClick={handleCreate}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
              {conversations?.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setActiveId(conv.id)}
                  className={cn(
                    "flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer group transition-all text-sm",
                    activeId === conv.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span className="truncate text-xs font-mono">{conv.title || "New chat"}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:text-destructive shrink-0" onClick={(e) => handleDelete(conv.id, e)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {(!conversations || conversations.length === 0) && (
                <div className="text-center py-6 text-muted-foreground text-xs font-mono">No conversations yet</div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Chat panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {!activeId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center">
                <Bot className="h-8 w-8 text-primary/30" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">Start a conversation</p>
                <p className="text-sm mt-1 font-mono">Your personal AI second-brain</p>
              </div>
              <Button onClick={handleCreate}><Plus className="h-4 w-4 mr-2" />New conversation</Button>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 px-4 py-4" ref={scrollRef as any}>
                <div className="space-y-4 max-w-3xl mx-auto pb-2">
                  {activeConv?.messages?.length === 0 && !isStreaming && (
                    <div className="flex items-center justify-center py-12 text-muted-foreground text-sm font-mono">
                      Send a message to begin
                    </div>
                  )}
                  {activeConv?.messages?.map((msg) => (
                    <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                      {msg.role === "assistant" && (
                        <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="h-3.5 w-3.5 text-primary" />
                        </div>
                      )}
                      <div className={cn(
                        "group relative max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-secondary text-secondary-foreground border border-border/60 rounded-bl-sm"
                      )}>
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        <div className="flex items-center justify-between gap-3 mt-1">
                          <span className="text-[10px] opacity-40 font-mono">{format(new Date(msg.createdAt), "h:mm a")}</span>
                          {msg.role === "assistant" && (
                            <button
                              onClick={() => handleSpeak(msg.id, msg.content)}
                              className={cn("opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded", playingMsgId === msg.id ? "opacity-100 text-primary" : "text-muted-foreground hover:text-foreground")}
                            >
                              <Volume2 className={cn("h-3.5 w-3.5", playingMsgId === msg.id && "animate-pulse")} />
                            </button>
                          )}
                        </div>
                      </div>
                      {msg.role === "user" && (
                        <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 mt-0.5 text-xs font-mono text-muted-foreground">U</div>
                      )}
                    </div>
                  ))}
                  {assistantDraft && (
                    <div className="flex gap-3 justify-start">
                      <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="max-w-[75%] rounded-2xl rounded-bl-sm px-4 py-2.5 bg-secondary text-secondary-foreground border border-border/60 text-sm">
                        <p className="whitespace-pre-wrap leading-relaxed">{assistantDraft}</p>
                        <span className="inline-flex items-center gap-1 text-[10px] text-primary/60 font-mono mt-1">
                          <span className="w-1 h-1 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
                          <span className="w-1 h-1 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
                          <span className="w-1 h-1 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
                        </span>
                      </div>
                    </div>
                  )}
                  {isStreaming && !assistantDraft && (
                    <div className="flex gap-3 justify-start">
                      <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="rounded-2xl rounded-bl-sm px-4 py-3 bg-secondary border border-border/60 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="p-4 border-t border-border bg-background/50">
                {isListening && (
                  <div className="flex items-center gap-2 px-3 py-1.5 mb-2 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-mono">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    Listening... speak now
                  </div>
                )}
                <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2">
                  {hasSpeechSupport && (
                    <Button type="button" variant="ghost" size="icon" onClick={toggleMic}
                      className={cn("shrink-0 transition-colors", isListening ? "text-primary bg-primary/10 hover:bg-primary/20" : "text-muted-foreground hover:text-foreground")}>
                      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                  )}
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isListening ? "Listening..." : "Message Memora..."}
                    className="flex-1 font-mono text-sm bg-card border-border focus-visible:ring-primary"
                    disabled={isStreaming}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  />
                  <Button type="submit" size="icon" disabled={isStreaming || !input.trim()} className="shrink-0">
                    {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>
                <p className="text-[10px] text-muted-foreground/40 font-mono text-center mt-2">
                  Memora remembers facts from your conversations automatically
                </p>
              </div>
            </>
          )}
        </div>

        {/* Memory panel */}
        {showMemories && (
          <div className="w-64 border-l border-border flex flex-col bg-background/50 shrink-0">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">Memory Bank</span>
              </div>
              <button onClick={() => setShowMemories(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {memoriesLoading ? (
                  <p className="text-xs text-muted-foreground font-mono text-center py-4">Loading...</p>
                ) : !memories || memories.length === 0 ? (
                  <div className="text-center py-6">
                    <Brain className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground font-mono">No memories yet.</p>
                    <p className="text-xs text-muted-foreground/60 font-mono mt-1">Memora learns from your conversations automatically.</p>
                  </div>
                ) : (
                  memories.map((mem) => (
                    <div key={mem.id} className="group flex items-start gap-2 p-2 rounded-lg bg-secondary/50 border border-border/40 hover:border-primary/20 transition-colors">
                      <p className="flex-1 text-xs text-foreground leading-relaxed">{mem.content}</p>
                      <button
                        onClick={() => deleteMem.mutate(mem.id)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0 mt-0.5"
                        title="Forget this"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            <div className="p-3 border-t border-border">
              <p className="text-[10px] text-muted-foreground/50 font-mono text-center">
                Facts are extracted automatically · click × to forget
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
