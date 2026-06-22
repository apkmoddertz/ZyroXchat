import React, { useState, useRef } from "react";
import { doc, updateDoc, collectionGroup, query, where, getDocs, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { X, Camera, Save, RotateCcw, AlertCircle, Sparkles, Check, RefreshCw } from "lucide-react";

interface UserProfileModalProps {
  currentUserId: string;
  userProfile: {
    uid: string;
    displayName: string;
    email: string;
    photoURL: string;
    publicKey: string;
    createdAt: any;
  };
  onClose: () => void;
  onProfileUpdated: (updatedProfile: any) => void;
}

// Client-side image compression helper to keep base64 payloads lightweight and blazing fast
function resizeProfileImage(base64Str: string, maxWidth = 160, maxHeight = 160): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82)); // Compact 82% quality JPEG representation
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
    img.src = base64Str;
  });
}

export default function UserProfileModal({
  currentUserId,
  userProfile,
  onClose,
  onProfileUpdated,
}: UserProfileModalProps) {
  const [displayName, setDisplayName] = useState(userProfile.displayName || "");
  const [photoURL, setPhotoURL] = useState(userProfile.photoURL || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultAvatarFromEmail = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userProfile.email || "agent")}`;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processAvatarFile(file);
  };

  const processAvatarFile = (file: File) => {
    // Only accept common formats
    if (!file.type.startsWith("image/")) {
      setStatusMessage({ type: "error", text: "Please select a valid image file." });
      return;
    }
    
    // Max uncompressed limit: 5MB for staging, will compress
    if (file.size > 5 * 1024 * 1024) {
      setStatusMessage({ type: "error", text: "Image is too large. Max allowed size is 5MB." });
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const originalBase64 = reader.result as string;
      try {
        const compressedBase64 = await resizeProfileImage(originalBase64);
        setPhotoURL(compressedBase64);
        setStatusMessage(null);
      } catch (err) {
        console.error("Avatar compression failed:", err);
        setPhotoURL(originalBase64); // fallback to original
      }
    };
    reader.onerror = () => {
      setStatusMessage({ type: "error", text: "Error parsing image file." });
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processAvatarFile(file);
    }
  };

  const handleResetAvatar = () => {
    setPhotoURL(defaultAvatarFromEmail);
    setStatusMessage({ type: "success", text: "Avatar reverted to email-derived default!" });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setStatusMessage({ type: "error", text: "Username cannot be empty!" });
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    try {
      const userDocRef = doc(db, "users", currentUserId);
      const updatedFields = {
        displayName: displayName.trim(),
        photoURL: photoURL.trim(),
      };

      // 1. Update the primary user profile in /users
      await updateDoc(userDocRef, updatedFields);

      // 2. Cascade update to all memberships subcollections inside user's active channels
      // This immediately propagates the custom username and avatar inside all existing threads!
      try {
        const membershipsQuery = query(collectionGroup(db, "members"), where("userId", "==", currentUserId));
        const membershipsSnap = await getDocs(membershipsQuery);
        
        if (!membershipsSnap.empty) {
          const batch = writeBatch(db);
          membershipsSnap.docs.forEach((memberDoc) => {
            batch.update(memberDoc.ref, {
              displayName: displayName.trim(),
              photoURL: photoURL.trim(),
            });
          });
          await batch.commit();
        }
      } catch (cascadeError) {
        // Log error but do not hardblock if some channels are archived or have specific write blocks
        console.warn("Cascade updating channel memberships warnings:", cascadeError);
      }

      onProfileUpdated({
        ...userProfile,
        ...updatedFields,
      });

      setStatusMessage({ type: "success", text: "Secure profile updated successfully!" });
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error("Database save error:", err);
      setStatusMessage({
        type: "error",
        text: `Failed to save changes. ${err.message || 'Check connection.'}`
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" id="profile-settings-modal">
      <div className="w-full max-w-md bg-white border border-vibrant-border rounded-3xl shadow-2xl p-6 relative overflow-hidden flex flex-col">
        {/* Banner Gradient Strip */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-accent"></div>

        {/* Modal Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 text-primary rounded-xl shrink-0 border border-primary/15">
              <Sparkles className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">Customize Profile</h3>
              <p className="text-[10px] text-slate-400 font-medium">Update username and reupload avatar</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 px-1.5 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200/60 transition cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Status Alerts */}
        {statusMessage && (
          <div
            className={`p-3 text-xs mb-4 rounded-xl flex items-start gap-2 border font-medium ${
              statusMessage.type === "success"
                ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                : "bg-rose-50 border-rose-100 text-rose-600"
            }`}
          >
            {statusMessage.type === "success" ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-5">
          {/* Avatar Upload Drop Zone */}
          <div className="flex flex-col items-center">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative group cursor-pointer w-24 h-24 rounded-2xl overflow-hidden border-2 flex items-center justify-center transition-all ${
                isDragging
                  ? "border-primary bg-indigo-50/30 scale-105"
                  : "border-slate-200 hover:border-primary/50"
              }`}
              title="Click or Drag & Drop image"
            >
              <img
                src={photoURL || defaultAvatarFromEmail}
                alt="Avatar preview"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
              />
              
              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-5 w-5 text-white" />
                <span className="text-[8px] text-white font-extrabold mt-1 tracking-wider uppercase">Reupload</span>
              </div>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />

            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
              >
                Upload Photo
              </button>
              {photoURL !== defaultAvatarFromEmail && (
                <>
                  <span className="text-slate-300 text-[10px]">•</span>
                  <button
                    type="button"
                    onClick={handleResetAvatar}
                    className="text-[10px] font-bold text-slate-500 hover:text-slate-700 flex items-center gap-0.5 cursor-pointer"
                  >
                    <RotateCcw className="h-2.5 w-2.5" /> Revert default
                  </button>
                </>
              )}
            </div>
            <p className="text-[9px] text-slate-400 mt-1 font-medium">JPEG or PNG. Drag-and-drop or click to browse</p>
          </div>

          {/* Form Fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-550 uppercase tracking-wider mb-1">
                Secure Username
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. n, Charlie, Alpha"
                maxLength={30}
                className="w-full bg-[#F8FAFC] border border-vibrant-border rounded-xl px-3.5 py-2.5 text-xs text-slate-805 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                E2EE Node Email (Read Only)
              </label>
              <input
                type="text"
                value={userProfile.email}
                disabled
                className="w-full bg-[#f1f5f9]/50 border border-slate-200/60 rounded-xl px-3.5 py-2.5 text-xs text-slate-400 cursor-not-allowed select-none font-mono"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-55 text-slate-705 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 bg-primary hover:bg-indigo-700 disabled:opacity-55 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
