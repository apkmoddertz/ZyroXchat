import { useState, useEffect } from "react";
import { collection, query, getDocs, doc, setDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db, handleFirestoreError } from "../lib/firebase";
import { OperationType, UserProfile } from "../types";
import { Search, X, Loader, Users, MessageSquareCode, Plus, Check } from "lucide-react";

interface NewChatModalProps {
  currentUserId: string;
  currentUserProfile: any; // { displayName, email, photoURL, publicKey }
  onClose: () => void;
  onChannelCreated: (channelId: string) => void;
}

export default function NewChatModal({
  currentUserId,
  currentUserProfile,
  onClose,
  onChannelCreated,
}: NewChatModalProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<UserProfile[]>([]);
  const [groupName, setGroupName] = useState("");
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch online users registered on this applet
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        const usersSnapshot = await getDocs(query(collection(db, "users")));
        const usersList: UserProfile[] = [];
        usersSnapshot.forEach((docSnap) => {
          const u = docSnap.data() as UserProfile;
          if (u.uid !== currentUserId) {
            usersList.push(u);
          }
        });
        setUsers(usersList);
      } catch (err) {
        console.error("Failed to load users:", err);
        setError("Could not load register users. Check network.");
        try {
          handleFirestoreError(err, OperationType.LIST, "users");
        } catch {}
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [currentUserId]);

  const handleSelectUser = (user: UserProfile) => {
    setError(null);
    if (!isGroupMode) {
      // Direct Message (DM) mode: instantly select one and proceed to construct dm
      createDM(user);
    } else {
      // Group mode: multi-select toggle
      setSelectedUsers((prev) => {
        const alreadySelected = prev.find((u) => u.uid === user.uid);
        if (alreadySelected) {
          return prev.filter((u) => u.uid !== user.uid);
        } else {
          return [...prev, user];
        }
      });
    }
  };

  // Launch a standard private 1-1 Direct message (Inbox) channel
  const createDM = async (otherUser: UserProfile) => {
    setSubmitting(true);
    setError(null);
    try {
      // Construct a deterministic channel ID based on sorted user IDs
      const sortedIds = [currentUserId, otherUser.uid].sort();
      const channelId = `dm-${sortedIds[0]}-${sortedIds[1]}`;

      // Let's write batch for channel and members
      const batch = writeBatch(db);

      // Channel master definition
      const channelRef = doc(db, "channels", channelId);
      const now = new Date();

      batch.set(channelRef, {
        id: channelId,
        name: otherUser.displayName, // Cache other user's name as channel title
        type: "dm",
        createdBy: currentUserId,
        createdAt: now,
        updatedAt: now,
        latestMessageText: "Direct chat created",
        latestMessageSender: "System",
        latestMessageAt: now,
      });

      // Member 1 (Current User)
      const member1Ref = doc(db, "channels", channelId, "members", currentUserId);
      batch.set(member1Ref, {
        userId: currentUserId,
        displayName: currentUserProfile.displayName || "Unknown User",
        email: currentUserProfile.email || "",
        photoURL: currentUserProfile.photoURL || "",
        publicKey: currentUserProfile.publicKey || "",
        joinedAt: now,
      });

      // Member 2 (Recipient User)
      const member2Ref = doc(db, "channels", channelId, "members", otherUser.uid);
      batch.set(member2Ref, {
        userId: otherUser.uid,
        displayName: otherUser.displayName,
        email: otherUser.email,
        photoURL: otherUser.photoURL,
        publicKey: otherUser.publicKey,
        joinedAt: now,
      });

      await batch.commit();
      onChannelCreated(channelId);
      onClose();
    } catch (err) {
      console.error("Failed to make DM:", err);
      setError("Failed to create secure inbox chat.");
    } finally {
      setSubmitting(false);
    }
  };

  // Launch a collaborative Group chat channel with members and their public keys
  const createGroup = async () => {
    if (!groupName.trim()) {
      setError("Please input a Group or Channel name.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const channelId = `group-${Date.now()}`;
      const batch = writeBatch(db);
      const now = new Date();

      // Write Group Channel Header
      const channelRef = doc(db, "channels", channelId);
      batch.set(channelRef, {
        id: channelId,
        name: groupName.trim(),
        type: "group",
        createdBy: currentUserId,
        createdAt: now,
        updatedAt: now,
        latestMessageText: `Public Chat "${groupName.trim()}" created`,
        latestMessageSender: "System",
        latestMessageAt: now,
      });

      // Write memberships for all selected users + current user
      const creatorRef = doc(db, "channels", channelId, "members", currentUserId);
      batch.set(creatorRef, {
        userId: currentUserId,
        displayName: currentUserProfile.displayName || "Unknown User",
        email: currentUserProfile.email || "",
        photoURL: currentUserProfile.photoURL || "",
        publicKey: currentUserProfile.publicKey || "",
        joinedAt: now,
      });

      selectedUsers.forEach((user) => {
        const memberRef = doc(db, "channels", channelId, "members", user.uid);
        batch.set(memberRef, {
          userId: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          publicKey: user.publicKey,
          joinedAt: now,
        });
      });

      await batch.commit();
      onChannelCreated(channelId);
      onClose();
    } catch (err) {
      console.error("Failed to build group:", err);
      setError("Could not launch secure group channel.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-905/30 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" id="new-chat-modal">
      <div className="w-full max-w-lg bg-white border border-vibrant-border rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[520px]">
        {/* Header */}
        <div className="p-4 border-b border-vibrant-border flex items-center justify-between bg-white">
          <div>
            <h3 className="text-sm font-extrabold text-slate-805 flex items-center gap-1.5">
              {isGroupMode ? "Create Group Chat" : "Start 1-to-1 PM"}
            </h3>
            <p className="text-xs text-slate-400 font-medium font-sans">
              {isGroupMode ? "Bundle contacts to talk betting strategies" : "Select contact to chat direct and clean"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 px-2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-205 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Toggle Mode */}
        <div className="px-4 py-2.5 bg-vibrant-bg/40 flex border-b border-vibrant-border gap-2">
          <button
            onClick={() => {
              setIsGroupMode(false);
              setSelectedUsers([]);
            }}
            className={`flex-1 flex py-2 rounded-xl text-xs font-bold justify-center items-center gap-1.5 transition cursor-pointer ${
              !isGroupMode ? "bg-primary text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <MessageSquareCode className="h-4 w-4" />
            1-to-1 PM (Inbox)
          </button>
          <button
            onClick={() => setIsGroupMode(true)}
            className={`flex-1 flex py-2 rounded-xl text-xs font-bold justify-center items-center gap-1.5 transition cursor-pointer ${
              isGroupMode ? "bg-primary text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Users className="h-4 w-4" />
            Group Chat
          </button>
        </div>

        {/* Error panel */}
        {error && (
          <div className="mx-4 mt-3 p-3 text-xs bg-rose-50 border border-rose-100 text-rose-600 rounded-xl font-medium">
            {error}
          </div>
        )}

        {/* Group metadata properties */}
        {isGroupMode && (
          <div className="p-4 bg-vibrant-bg/25 border-b border-vibrant-border space-y-3 shrink-0">
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold text-[#4a76a8] uppercase tracking-wider">
                Group Chat or Public Channel Name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Football Fans, Crypto Club, Daily Tips"
                  className="flex-1 bg-[#F8FAFC] border border-vibrant-border rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#4a76a8] focus:ring-1 focus:ring-[#4a76a8]/30 transition"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      createGroup();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={createGroup}
                  disabled={submitting || !groupName.trim()}
                  className="px-4 bg-[#4a76a8] hover:bg-[#3f6794] disabled:opacity-40 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                >
                  {submitting ? <Loader className="h-3 w-3 animate-spin text-white" /> : <Plus className="h-3.5 w-3.5 text-white" />}
                  Create
                </button>
              </div>
              <p className="text-[10.5px] text-[#707070] font-medium leading-relaxed pt-0.5">
                💡 Enter a name above and click <strong>Create</strong> to launch instantly! Everyone will see and auto-join it.
              </p>
            </div>
            {selectedUsers.length > 0 && (
              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold text-slate-550 uppercase tracking-wider">
                  Selected Initial Members ({selectedUsers.length})
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-12 overflow-y-auto">
                  {selectedUsers.map((u) => (
                    <div
                      key={u.uid}
                      className="bg-white border border-vibrant-border px-2.5 py-0.5 rounded-full flex items-center gap-1 text-[10px] text-slate-700 font-semibold shadow-xs"
                    >
                      <span>{u.displayName}</span>
                      <X
                        className="h-2.5 w-2.5 text-slate-400 cursor-pointer hover:text-rose-600 rounded"
                        onClick={() => setSelectedUsers((prev) => prev.filter((usr) => usr.uid !== u.uid))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search */}
        <div className="p-3 shrink-0 relative">
          <Search className="absolute left-6 top-5.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contact via name or email..."
            className="w-full bg-[#F8FAFC] border border-vibrant-border rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition"
          />
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader className="h-5 w-5 animate-spin text-primary" />
              <span className="text-xs font-semibold">Finding secure profiles on server...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-1 text-center py-6">
              <Users className="h-8 w-8 text-slate-300" />
              <p className="text-xs font-bold text-slate-755">No secure contacts found</p>
              <p className="text-[11px] text-slate-400">Invite friends to sign up and swap public keys!</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredUsers.map((user) => {
                const isSelected = selectedUsers.some((u) => u.uid === user.uid);
                return (
                  <div
                    key={user.uid}
                    onClick={() => handleSelectUser(user)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? "bg-[#EEF2FF] border-primary/50"
                        : "bg-[#F8FAFC] border-vibrant-border hover:bg-[#F1F5F9]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={
                          user.photoURL ||
                          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.displayName)}`
                        }
                        referrerPolicy="no-referrer"
                        className="h-8 w-8 rounded-xl border border-slate-100 object-cover shrink-0 shadow-xs"
                      />
                      <div className="text-left">
                        <p className="text-xs font-bold text-slate-800 leading-tight">{user.displayName}</p>
                        <p className="text-[10px] text-slate-400 font-mono truncate max-w-64">{user.email}</p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isGroupMode ? (
                        <div
                          className={`h-4.5 w-4.5 rounded-lg flex items-center justify-center transition border ${
                            isSelected
                              ? "bg-primary border-primary text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </div>
                      ) : (
                        <div className="p-1.5 px-3 bg-white hover:bg-slate-50 text-[10px] font-bold text-slate-700 border border-slate-200 rounded-xl shadow-xs transition flex items-center gap-1">
                          <Plus className="h-3 w-3 text-primary" /> Chat
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {isGroupMode && (
          <div className="p-4 border-t border-vibrant-border bg-[#F8FAFC] flex items-center justify-between shrink-0">
            <span className="text-[10px] text-slate-400 font-semibold leading-relaxed">
              Only profiles supporting E2EE are listed
            </span>
            <button
              onClick={createGroup}
              disabled={submitting}
              className="py-2.5 px-4 bg-accent hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-md transition"
            >
              {submitting ? (
                <Loader className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Users className="h-3.5 w-3.5" />
              )}
              {submitting ? "Forming Security Group..." : "Initialize E2EE Group"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
