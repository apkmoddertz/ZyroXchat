import React, { useState, useEffect } from "react";
import { collection, onSnapshot, doc, getDoc, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Channel } from "../types";
import { User, ShieldAlert, Loader, MessageSquare, ArrowLeft, Clock, ShieldCheck } from "lucide-react";

interface RegisteredUsersListProps {
  currentUserId: string;
  currentUserProfile: any;
  onSelectChannel: (channel: Channel) => void;
  onBackToChats: () => void;
}

export default function RegisteredUsersList({
  currentUserId,
  currentUserProfile,
  onSelectChannel,
  onBackToChats,
}: RegisteredUsersListProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErrorText(null);

    const usersRef = collection(db, "users");
    const unsubscribe = onSnapshot(
      usersRef,
      (snapshot) => {
        const userList: any[] = [];
        snapshot.forEach((snap) => {
          const data = snap.data();
          if (data && data.uid) {
            userList.push({ id: snap.id, ...data });
          }
        });

        // Sort by registration date/time, newest first
        const sorted = userList.sort((a, b) => {
          const getMs = (field: any) => {
            if (!field) return 0;
            if (field.toMillis) return field.toMillis();
            if (field.seconds) return field.seconds * 1000;
            const parsed = new Date(field).getTime();
            return isNaN(parsed) ? 0 : parsed;
          };
          return getMs(b.createdAt) - getMs(a.createdAt);
        });

        setUsers(sorted);
        setLoading(false);
      },
      (err) => {
        console.error("Error subscribing to users list:", err);
        setErrorText("Missing query permissions. Please check rule config.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleStartDM = async (targetUser: any) => {
    if (targetUser.uid === currentUserId) return; // Can't chat with self here

    try {
      const sortedIds = [currentUserId, targetUser.uid].sort();
      const channelId = `dm-${sortedIds[0]}-${sortedIds[1]}`;

      const channelDocRef = doc(db, "channels", channelId);
      const snap = await getDoc(channelDocRef);

      if (snap.exists()) {
        onSelectChannel(snap.data() as Channel);
        onBackToChats();
        return;
      }

      // Create new private encrypted chat if not exists
      const batch = writeBatch(db);
      const now = new Date();

      batch.set(channelDocRef, {
        id: channelId,
        name: targetUser.displayName || "Secure Chat",
        type: "dm",
        createdBy: currentUserId,
        createdAt: now,
        updatedAt: now,
        latestMessageText: "🔒 Direct encrypted chat created",
        latestMessageSender: "System",
        latestMessageAt: now,
      });

      // Member 1: Self
      const member1Ref = doc(db, "channels", channelId, "members", currentUserId);
      batch.set(member1Ref, {
        userId: currentUserId,
        displayName: currentUserProfile?.displayName || "Secure Agent",
        email: currentUserProfile?.email || "",
        photoURL: currentUserProfile?.photoURL || "",
        publicKey: currentUserProfile?.publicKey || "",
        joinedAt: now,
      });

      // Member 2: Target Recipient
      const member2Ref = doc(db, "channels", channelId, "members", targetUser.uid);
      batch.set(member2Ref, {
        userId: targetUser.uid,
        displayName: targetUser.displayName || "Secure Agent",
        email: targetUser.email || "",
        photoURL: targetUser.photoURL || "",
        publicKey: targetUser.publicKey || "",
        joinedAt: now,
      });

      await batch.commit();

      // Trigger selection of new channel
      onSelectChannel({
        id: channelId,
        name: targetUser.displayName || "Secure Chat",
        type: "dm",
      } as Channel);
      onBackToChats();
    } catch (err) {
      console.error("Error establishing secured direct chat:", err);
    }
  };

  const formatRegDate = (field: any) => {
    if (!field) return "Just Joined";
    try {
      const date = field.toDate ? field.toDate() : new Date(field);
      return date.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "Registered";
    }
  };

  return (
    <div className="w-full bg-white flex flex-col h-full overflow-hidden" id="registered-users-view">
      {/* Header bar within the left panel */}
      <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between shadow-xs select-none">
        <div className="flex items-center gap-2">
          <button
            onClick={onBackToChats}
            className="p-1 hover:bg-slate-200/80 rounded-lg text-slate-500 hover:text-slate-700 transition cursor-pointer"
            title="Back to chats"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>
          <div>
            <h3 className="text-xs font-bold text-slate-800 tracking-tight">Registered Users</h3>
            <p className="text-[10px] text-slate-450 font-medium">
              {users.length} {users.length === 1 ? "member" : "members"} on platform
            </p>
          </div>
        </div>
      </div>

      {errorText && (
        <div className="p-3 mx-4 mt-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs flex gap-1.5 font-medium leading-relaxed">
          <ShieldAlert className="h-4 w-4 shrink-0 text-rose-500" />
          <span>{errorText}</span>
        </div>
      )}

      {/* Main List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100/60">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader className="h-5 w-5 animate-spin text-[#527da3]" />
            <span className="text-[11px] font-semibold">Loading users...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-450 gap-2">
            <User className="h-7 w-7 text-slate-350" />
            <span className="text-xs font-bold">No other users yet</span>
          </div>
        ) : (
          users.map((profile, i) => {
            const isMe = profile.uid === currentUserId;
            const isTargetAdmin = profile.email?.toLowerCase() === "zyromod@gmail.com";
            
            return (
              <div
                key={profile.uid || i}
                onClick={() => !isMe && handleStartDM(profile)}
                className={`flex items-center gap-3 px-4 py-3 select-none transition-colors ${
                  isMe
                    ? "bg-slate-50/50 cursor-default"
                    : "cursor-pointer hover:bg-slate-50 active:bg-slate-100/70"
                }`}
              >
                {/* Photo */}
                <div className="relative shrink-0">
                  <img
                    src={
                      profile.photoURL ||
                      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                        profile.displayName || "User"
                      )}`
                    }
                    alt={profile.displayName}
                    referrerPolicy="no-referrer"
                    className="h-10 w-10 rounded-full border border-slate-100 object-cover shadow-2xs"
                  />
                  <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${isMe ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[12.5px] font-bold text-slate-800 truncate flex items-center gap-1.5 leading-tight">
                      {profile.displayName || "Secure Agent"}
                      {isMe && (
                        <span className="text-[9.5px] font-extrabold text-[#527da3] bg-[#527da3]/10 px-1 rounded-sm uppercase tracking-wider">
                          You
                        </span>
                      )}
                      {isTargetAdmin && (
                        <span className="text-[9px] font-extrabold bg-amber-500/10 text-amber-600 border border-amber-500/15 px-1 rounded-sm flex items-center gap-0.5">
                          <ShieldCheck className="h-2.5 w-2.5" /> Staff
                        </span>
                      )}
                    </p>
                    <span className="text-[9px] text-slate-400 font-mono flex items-center gap-0.5 whitespace-nowrap">
                      <Clock className="h-2.5 w-2.5 shrink-0" />
                      {profile.createdAt ? formatRegDate(profile.createdAt) : "Joined"}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-550 truncate mt-0.5 font-medium leading-relaxed">
                    {profile.email || "No email available"}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
