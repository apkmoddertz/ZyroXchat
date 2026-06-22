// Web Audio API custom notification synthesizer
export function playNotificationSound() {
  try {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return;

    const audioCtx = new AudioCtxClass();
    const now = audioCtx.currentTime;

    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);
      
      gainNode.gain.setValueAtTime(0.05, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    // A beautiful sweet digital chime (880Hz then 1318Hz offset by 80ms)
    playTone(880, now, 0.12);
    playTone(1318, now + 0.08, 0.22);
  } catch (err) {
    console.warn("Blocked by browser autoplay limits or audio unsupported:", err);
  }
}

// Request permission for Desktop notifications
export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    return false;
  }
  if (Notification.permission === "granted") {
    return true;
  }
  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  return false;
}

// Trigger real browser Notification
export function showBrowserNotification(title: string, body: string, icon = "") {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }
  try {
    new Notification(title, {
      body,
      icon: icon || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128&q=80",
    });
  } catch (err) {
    console.error("Failed to show system notification:", err);
  }
}
