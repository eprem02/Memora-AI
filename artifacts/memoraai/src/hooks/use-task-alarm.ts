import { useEffect, useRef } from "react";
import { useListTasks } from "@workspace/api-client-react";

function playAlarm() {
  try {
    const ctx = new AudioContext();
    const times = [0, 0.35, 0.7, 1.05];
    times.forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime + t);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + t + 0.25);
      gain.gain.setValueAtTime(0.4, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.28);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.3);
    });
    setTimeout(() => ctx.close(), 2000);
  } catch {}
}

async function showNotification(title: string, body: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
  if (Notification.permission === "granted") {
    new Notification(`⏰ Task Due: ${title}`, {
      body: body || "This task is now due!",
      icon: "/favicon.ico",
      tag: `task-alarm-${title}`,
    });
  }
}

const STORAGE_KEY = "memora_dismissed_alarms";

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function dismiss(key: string) {
  const set = getDismissed();
  set.add(key);
  // prune keys older than 24h — key format is "id:dueDate"
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set].slice(-200)));
}

export function useTaskAlarm() {
  const { data: tasks } = useListTasks({ status: "pending" });
  const lastChecked = useRef<number>(0);

  useEffect(() => {
    function check() {
      if (!tasks) return;
      const now = Date.now();
      lastChecked.current = now;
      const dismissed = getDismissed();

      for (const task of tasks) {
        if (!task.dueDate || task.completed) continue;
        const due = new Date(task.dueDate).getTime();
        if (isNaN(due)) continue;
        // ring if overdue within the last 5 minutes (avoid ringing for ancient tasks)
        const overdueMs = now - due;
        if (overdueMs < 0 || overdueMs > 5 * 60 * 1000) continue;
        const key = `${task.id}:${task.dueDate}`;
        if (dismissed.has(key)) continue;
        dismiss(key);
        playAlarm();
        showNotification(task.title, task.description ?? "");
      }
    }

    check(); // run immediately on mount / task data change
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [tasks]);
}
