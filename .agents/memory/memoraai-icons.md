---
name: MemoraAI lucide-react icon availability
description: Some lucide-react icon names used by subagents don't exist in the installed version
---

`MessageSquareTerminal` does not exist in the lucide-react version installed in this project. Subagents may hallucinate icon names. When a runtime error says "does not provide an export named X", replace with a real icon.

**Why:** lucide-react frequently adds icons; the installed version may lag behind what models have seen in training data.

**How to apply:** When a subagent adds new lucide icons, verify they exist. Safe replacements: `Bot` for AI/chat icons, `MessageSquare` for messaging.
