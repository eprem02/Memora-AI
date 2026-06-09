import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListAiConversations, 
  getListAiConversationsQueryKey,
  useCreateAiConversation, 
  useDeleteAiConversation,
  useGetAiConversation,
  getGetAiConversationQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Plus, Trash2, Bot } from "lucide-react";
import { format } from "date-fns";

export default function AiCompanion() {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [assistantDraft, setAssistantDraft] = useState("");
  
  const { data: conversations } = useListAiConversations();
  const createConv = useCreateAiConversation();
  const deleteConv = useDeleteAiConversation();
  
  const { data: activeConv } = useGetAiConversation(activeId!, {
    query: { enabled: !!activeId }
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeConv?.messages, assistantDraft]);

  const handleCreate = () => {
    createConv.mutate({ data: {} }, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListAiConversationsQueryKey() });
        setActiveId(data.id);
      }
    });
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteConv.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAiConversationsQueryKey() });
        if (activeId === id) setActiveId(null);
      }
    });
  };

  const handleSend = async () => {
    if (!input.trim() || !activeId) return;
    
    const messageContent = input.trim();
    setInput("");
    setIsStreaming(true);
    setAssistantDraft("");

    // Optimistically add user message if we wanted to, but we'll rely on the stream start and refetch.
    // Actually, just wait for stream or update cache directly.
    const currentMessages = activeConv?.messages || [];
    queryClient.setQueryData(getGetAiConversationQueryKey(activeId), (old: any) => {
      if (!old) return old;
      return {
        ...old,
        messages: [...old.messages, { id: Date.now(), role: "user", content: messageContent, createdAt: new Date().toISOString() }]
      };
    });

    try {
      const token = localStorage.getItem("memora_token");
      const response = await fetch(`/api/ai/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
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
              if (event.content) setAssistantDraft(prev => prev + event.content);
              if (event.done) {
                // Done
              }
            } catch {}
          }
        }
      }
    } finally {
      setIsStreaming(false);
      setAssistantDraft("");
      queryClient.invalidateQueries({ queryKey: getGetAiConversationQueryKey(activeId) });
      queryClient.invalidateQueries({ queryKey: getListAiConversationsQueryKey() });
    }
  };

  return (
    <div className="h-[calc(100vh-10rem)] flex border border-border rounded-lg overflow-hidden bg-card">
      <div className="w-64 border-r border-border flex flex-col bg-background">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-mono font-bold">Conversations</h2>
          <Button variant="ghost" size="icon" onClick={handleCreate}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversations?.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setActiveId(conv.id)}
                className={`flex items-center justify-between p-2 rounded-md cursor-pointer group transition-colors ${
                  activeId === conv.id ? "bg-primary/20 text-primary" : "hover:bg-secondary"
                }`}
              >
                <div className="truncate text-sm pr-2">{conv.summary || "New Conversation"}</div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:text-destructive"
                  onClick={(e) => handleDelete(conv.id, e)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {conversations?.length === 0 && (
              <div className="text-center p-4 text-muted-foreground text-sm">No conversations</div>
            )}
          </div>
        </ScrollArea>
      </div>
      
      <div className="flex-1 flex flex-col relative">
        {!activeId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <Bot className="h-12 w-12 mb-4 opacity-20" />
            <p>Select a conversation or start a new one</p>
            <Button className="mt-4" onClick={handleCreate}>Start Conversation</Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
              <div className="space-y-4 pb-4">
                {activeConv?.messages?.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.role === "user" 
                          ? "bg-primary/20 text-primary-foreground border border-primary/30" 
                          : "bg-secondary text-secondary-foreground border border-border"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <span className="text-[10px] opacity-50 mt-1 block">
                        {format(new Date(msg.createdAt), "h:mm a")}
                      </span>
                    </div>
                  </div>
                ))}
                {assistantDraft && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-lg p-3 bg-secondary text-secondary-foreground border border-border">
                      <p className="text-sm whitespace-pre-wrap">{assistantDraft}</p>
                      <span className="text-[10px] opacity-50 mt-1 block animate-pulse">generating...</span>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="p-4 border-t border-border bg-background">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex gap-2"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 font-mono text-sm bg-card border-border focus-visible:ring-primary"
                  disabled={isStreaming}
                />
                <Button type="submit" size="icon" disabled={isStreaming || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
