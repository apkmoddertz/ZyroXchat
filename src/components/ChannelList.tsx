import { collectionGroup, query, where, onSnapshot, doc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db, handleFirestoreError } from "../lib/firebase";
import { OperationType, Channel } from "../types";
import { MessageSquare, Users, ShieldAlert, Loader, Plus, Rss } from "lucide-react";

interface ChannelListProps {
  currentUserId: string;
  activeChannelId: string | null;
  onSelectChannel: (channel: Channel) => void;
  onOpenNewChat: () => void;
  onBrowserNotificationToggle: () => void;
  browserNotificationsEnabled: boolean;
}

export default function ChannelList({
  currentUserId,
  activeChannelId,
  onSelectChannel,
  onOpenNewChat,
  onBrowserNotificationToggle,
  browserNotificationsEnabled,
}: ChannelListProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorHeader, setErrorHeader] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    // Listen to memberships of current logged in user via Collection Group Query
    const membershipsQuery = query(collectionGroup(db, "members"), where("userId", "==", currentUserId));

    const unsubscribeMemberships = onSnapshot(
      membershipsQuery,
      (snapshot) => {
        const channelList: Channel[] = [];
        const channelIds = snapshot.docs.map((memberDoc) => {
          // The parent of `/members/{userId}` is `/channels/{channelId}/members`
          // Its parent is `/channels/{channelId}`
          return memberDoc.ref.parent.parent!.id;
        });

        if (channelIds.length === 0) {
          setChannels([]);
          setLoading(false);
          return;
        }

        // Set up active list of listeners on each channel document
        const unsubscribes: (() => void)[] = [];
        let fetchedCount = 0;

        channelIds.forEach((cId) => {
          const chanDocRef = doc(db, "channels", cId);
          const unsubChan = onSnapshot(
            chanDocRef,
            (chanSnap) => {
              if (chanSnap.exists()) {
                const chanData = chanSnap.data() as Channel;
                
                // If it is a DM, we dynamically rewrite the DM's name to the recipient's name 
                // in case the channel was named after the other user
                setChannels((prev) => {
                  const updatedChannels = prev.filter((c) => c.id !== chanData.id);
                  updatedChannels.push(chanData);
                  
                  // Sort by latest message update
                  return updatedChannels.sort((a, b) => {
                    const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : new Date(a.updatedAt).getTime();
                    const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : new Date(b.updatedAt).getTime();
                    return timeB - timeA;
                  });
                });
              }

              fetchedCount++;
              if (fetchedCount >= channelIds.length) {
                setLoading(false);
              }
            },
            (err) => {
              console.error(`Failed to lock channel doc listener for ${cId}:`, err);
              // Handle firestore error for auditing
              fetchedCount++;
              if (fetchedCount >= channelIds.length) {
                setLoading(false);
              }
            }
          );
          unsubscribes.push(unsubChan);
        });

        return () => {
          unsubscribes.forEach((unsub) => unsub());
        };
      },
      (err) => {
        console.error("Subscription error on memberships collection:", err);
        setErrorHeader("Permission blocked. Waiting authentication syncing...");
        setLoading(false);
        try {
          handleFirestoreError(err, OperationType.LIST, "members");
        } catch {}
      }
    );

    return () => {
      unsubscribeMemberships();
    };
  }, [currentUserId]);

  return (
    <div className="w-80 border-r border-vibrant-border bg-white flex flex-col h-full overflow-hidden" id="channel-sidebar-view">
      {/* Search/New Actions */}
      <div className="p-4 border-b border-vibrant-border shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider font-sans">
            Channels
          </h2>
          <button
            onClick={onOpenNewChat}
            className="p-1 px-3 bg-primary hover:bg-indigo-700 active:bg-indigo-805 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition shadow-sm"
            id="start-new-chat-btn"
          >
            <Plus className="h-3.5 w-3.5" /> New
          </button>
        </div>
      </div>

      {/* Push Notification Toggle Option */}
      <div className="px-4 py-3 border-b border-vibrant-border bg-vibrant-bg/50 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
        <span className="flex items-center gap-1 font-semibold">
          <Rss className="h-3 w-3 text-accent" />
          Realtime Alerts
        </span>
        <button
          onClick={onBrowserNotificationToggle}
          className={`px-2.5 py-0.5 rounded-lg transition font-bold text-[10px] ${
            browserNotificationsEnabled
              ? "bg-accent/10 text-accent border border-accent/20"
              : "bg-slate-200/70 hover:bg-slate-205 text-slate-650 border border-slate-300/40"
          }`}
        >
          {browserNotificationsEnabled ? "Enabled" : "Allow"}
        </button>
      </div>

      {errorHeader && (
        <div className="p-3 mx-4 mt-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs flex gap-1.5 font-medium leading-relaxed">
          <ShieldAlert className="h-4 w-4 shrink-0 text-rose-500" />
          <span>{errorHeader}</span>
        </div>
      )}

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader className="h-5 w-5 animate-spin text-primary" />
            <span className="text-[11px] font-semibold">Syncing chat streams...</span>
          </div>
        ) : channels.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-center px-4 gap-1.5">
            <MessageSquare className="h-8 w-8 text-slate-300" />
            <p className="text-xs font-bold text-slate-700">Initialize E2EE inbox</p>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Launch a secure chat or group workspace with your contacts.
            </p>
          </div>
        ) : (
          channels.map((channel) => {
            const isActive = activeChannelId === channel.id;
            return (
              <div
                key={channel.id}
                onClick={() => onSelectChannel(channel)}
                className={`w-full text-left p-3 transition cursor-pointer flex items-center justify-between gap-2.5 ${
                  isActive
                    ? "bg-[#EEF2FF] border-l-4 border-l-primary rounded-r-xl border-t border-b border-r border-[#E2E8F0]"
                    : "bg-transparent border-l-4 border-l-transparent rounded-xl hover:bg-[#F8FAFC]"
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className={`p-2.5 rounded-xl shrink-0 ${isActive ? "bg-primary/10 text-primary" : "bg-[#F1F5F9] text-slate-400"}`}>
                    {channel.type === "group" ? (
                      <Users className="h-4 w-4" />
                    ) : (
                      <MessageSquare className="h-4 w-4" />
                    )}
                  </div>
                  
                  <div className="min-w-0 text-left">
                    <p className={`text-xs font-bold truncate ${isActive ? "text-primary font-extrabold" : "text-slate-800"}`}>
                      {channel.name}
                    </p>
                    <p className="text-[10px] text-slate-450 truncate">
                      {channel.latestMessageSender || "System"}: {channel.latestMessageText || ""}
                    </p>
                  </div>
                </div>

                {channel.type === "dm" && (
                  <span className="text-[9px] font-bold shrink-0 bg-secondary text-white px-2 py-0.5 rounded-full shadow-xs">
                    E2EE
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
