import React, { useState, useEffect } from "react";
import { doc, getDoc, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { X, MessageSquareCode, ShieldAlert, BadgeCheck, Mail, Key } from "lucide-react";
import { ChannelMember } from "../types";

interface UserProfilePreviewModalProps {
  currentUserId: string;
  currentUserProfile: {
    uid: string;
    displayName: string;
    email: string;
    photoURL: string;
    publicKey: string;
  };
  targetUserId: string;
  onClose: () => void;
  onStartChat: (channelId: string) => void;
}

export default function UserProfilePreviewModal({
  currentUserId,
  currentUserProfile,
  targetUserId,
  onClose,
  onStartChat,
}: UserProfilePreviewModalProps) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [startingChat, setStartingChat] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTargetProfile() {
      setLoading(true);
      setError(null);
      try {
        const userRef = doc(db, "users", targetUserId);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          setProfile(snap.data());
        } else {
          setError("User profile not found.");
        }
      } catch (err) {
        console.error("Error fetching preview profile:", err);
        setError("Unable to retrieve profile from server.");
      } finally {
        setLoading(false);
      }
    }
    loadTargetProfile();
  }, [targetUserId]);

  const handleStartChat = async () => {
    if (!profile) return;
    setStartingChat(true);
    setError(null);

    try {
      const sortedIds = [currentUserId, profile.uid].sort();
      const channelId = `dm-${sortedIds[0]}-${sortedIds[1]}`;

      // Create DM if not exists
      const batch = writeBatch(db);
      const channelRef = doc(db, "channels", channelId);
      const now = new Date();

      batch.set(channelRef, {
        id: channelId,
        name: profile.displayName,
        type: "dm",
        createdBy: currentUserId,
        createdAt: now,
        updatedAt: now,
        latestMessageText: "🔒 Direct encrypted chat created",
        latestMessageSender: "System",
        latestMessageAt: now,
      });

      // Member 1: Me
      const member1Ref = doc(db, "channels", channelId, "members", currentUserId);
      batch.set(member1Ref, {
        userId: currentUserId,
        displayName: currentUserProfile.displayName || "Secure Agent",
        email: currentUserProfile.email || "",
        photoURL: currentUserProfile.photoURL || "",
        publicKey: currentUserProfile.publicKey || "",
        joinedAt: now,
      });

      // Member 2: Recipient
      const member2Ref = doc(db, "channels", channelId, "members", profile.uid);
      batch.set(member2Ref, {
        userId: profile.uid,
        displayName: profile.displayName || "Secure Agent",
        email: profile.email || "",
        photoURL: profile.photoURL || "",
        publicKey: profile.publicKey || "",
        joinedAt: now,
      });

      await batch.commit();
      onStartChat(channelId);
      onClose();
    } catch (err: any) {
      console.error("Failed to start DM:", err);
      setError("Failed to create secure chat inbox.");
    } finally {
      setStartingChat(false);
    }
  };

  const isTargetAdmin = profile?.email?.toLowerCase() === "zyromod@gmail.com";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" id="user-preview-modal">
      <div className="w-full max-w-sm bg-white border border-vibrant-border rounded-3xl shadow-2xl p-6 relative overflow-hidden flex flex-col">
        {/* Banner strip */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-accent"></div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 px-1.5 text-slate-400 hover:text-slate-750 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200/60 transition cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="text-[11px] text-slate-405 font-bold">Querying Profile...</span>
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <ShieldAlert className="h-8 w-8 text-rose-500 mx-auto mb-2" />
            <p className="text-xs font-bold text-rose-600">{error}</p>
          </div>
        ) : (
          <div className="text-center space-y-4 pt-4">
            {/* Avatar block with badge capability */}
            <div className="relative w-20 h-20 mx-auto">
              <img
                src={
                  profile.photoURL ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(profile.displayName)}`
                }
                referrerPolicy="no-referrer"
                className="w-full h-full rounded-2xl object-cover border border-slate-100 shadow-sm"
              />
              {isTargetAdmin && (
                <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-1 border-2 border-white shadow-xs" title="Main Admin">
                  <BadgeCheck className="h-3.5 w-3.5 fill-white text-amber-550" />
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-center gap-1.5">
                <h4 className="text-sm font-extrabold text-slate-800 leading-tight">
                  {profile.displayName}
                </h4>
                {isTargetAdmin && (
                  <span className="bg-amber-100 text-amber-700 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full border border-amber-200 uppercase tracking-widest">
                    Main Admin
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-455 font-mono flex items-center justify-center gap-1 mt-1 text-slate-400">
                <Mail className="h-2.5 w-2.5" /> {profile.email}
              </p>
            </div>

            <div className="bg-[#F8FAFC] border border-vibrant-border rounded-2xl p-3 text-[11px] text-left text-slate-600 space-y-2">
              <div className="flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-primary shrink-0" />
                <div>
                  <p className="font-bold text-slate-700 leading-none">E2EE Secured Node</p>
                  <p className="text-[9px] text-slate-400 font-medium mt-0.5">
                    {profile.publicKey ? "🔒 Cryptographic Handshake Active" : "⚠️ Cryptographic Keys Pending Generation"}
                  </p>
                </div>
              </div>
            </div>

            {/* Core redirect interaction button */}
            <button
              onClick={handleStartChat}
              disabled={startingChat}
              className="w-full py-2.5 bg-primary hover:bg-indigo-700 active:bg-indigo-800 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition"
            >
              <MessageSquareCode className="h-4 w-4" />
              {startingChat ? "Creating Secure Room..." : `Send PM to @${profile.displayName}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
