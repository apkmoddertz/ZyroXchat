import React, { useState, useRef, useEffect } from "react";
import { doc, updateDoc, collectionGroup, query, where, getDocs, writeBatch } from "firebase/firestore";
import { db, logoutUser } from "../lib/firebase";
import { 
  Users, 
  User as UserIcon, 
  Phone, 
  MapPin, 
  Bookmark, 
  Settings, 
  UserPlus, 
  HelpCircle, 
  LogOut, 
  Moon, 
  Sun, 
  ChevronDown, 
  ArrowLeft,
  Camera,
  X,
  RotateCcw,
  Check,
  Loader
} from "lucide-react";

interface SlidingMenuProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  userProfile: {
    uid: string;
    displayName: string;
    email: string;
    photoURL: string;
    publicKey: string;
    createdAt: any;
  };
  onProfileUpdated: (updatedProfile: any) => void;
  onOpenNewChat: () => void;
  onToggleRegisteredUsers: () => void;
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

export default function SlidingMenu({
  isOpen,
  onClose,
  currentUserId,
  userProfile,
  onProfileUpdated,
  onOpenNewChat,
  onToggleRegisteredUsers,
}: SlidingMenuProps) {
  // Navigation inside the drawer: "menu" | "settings"
  const [drawerMode, setDrawerMode] = useState<"menu" | "settings">("menu");

  // Settings edited state
  const [displayName, setDisplayName] = useState(userProfile?.displayName || "");
  const [photoURL, setPhotoURL] = useState(userProfile?.photoURL || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [statusText, setStatusText] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isClosingEffect, setIsClosingEffect] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const defaultAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userProfile?.email || "user")}`;

  // Reset drawer state when slider opens/closes
  useEffect(() => {
    if (isOpen) {
      setDrawerMode("menu");
      setDisplayName(userProfile?.displayName || "");
      setPhotoURL(userProfile?.photoURL || "");
      setStatusText(null);
      setIsClosingEffect(false);
    }
  }, [isOpen, userProfile]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processAvatarFile(file);
  };

  const processAvatarFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setStatusText({ type: "error", text: "Select a valid image file." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setStatusText({ type: "error", text: "Max image size is 5MB." });
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const originalBase64 = reader.result as string;
      try {
        const compressedBase64 = await resizeProfileImage(originalBase64);
        setPhotoURL(compressedBase64);
        setStatusText(null);
      } catch (err) {
        console.error("Failed to compress avatar:", err);
        setPhotoURL(originalBase64);
      }
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

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setStatusText({ type: "error", text: "Display name is required." });
      return;
    }

    setIsSaving(true);
    setStatusText(null);

    try {
      const userRef = doc(db, "users", currentUserId);
      const updatedFields = {
        displayName: displayName.trim(),
        photoURL: photoURL.trim(),
      };

      // 1. Update the primary user profile in Firestore
      await updateDoc(userRef, updatedFields);

      // 2. Cascade update to all memberships inside channels
      try {
        const membershipsQuery = query(collectionGroup(db, "members"), where("userId", "==", currentUserId));
        const membershipsSnap = await getDocs(membershipsQuery);
        if (!membershipsSnap.empty) {
          const batch = writeBatch(db);
          membershipsSnap.docs.forEach((docSnap) => {
            batch.update(docSnap.ref, {
              displayName: displayName.trim(),
              photoURL: photoURL.trim(),
            });
          });
          await batch.commit();
        }
      } catch (err) {
        console.warn("Cascade updating memberships had warnings:", err);
      }

      onProfileUpdated({
        ...userProfile,
        ...updatedFields,
      });

      setStatusText({ type: "success", text: "Settings saved!" });
      setTimeout(() => {
        setDrawerMode("menu");
        setStatusText(null);
      }, 1000);
    } catch (err: any) {
      console.error("Settings save error:", err);
      setStatusText({ type: "error", text: "Database save failed." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleBackgroundClick}
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-start animate-fade-in"
      id="sliding-menu-backdrop"
    >
      <div 
        className="w-[260px] h-full bg-white shadow-2xl flex flex-col animate-slide-right select-none"
        id="sliding-menu-content"
      >
        {drawerMode === "menu" ? (
          <>
            {/* Header: Exact Replica of Blue Top header from Telegram */}
            <div className="bg-[#527da3] p-5 pt-7 pb-4 text-white relative flex flex-col justify-between">
              {/* Top Icons */}
              <div className="flex justify-between items-start mb-6">
                {/* User Avatar Circle */}
                <div className="relative">
                  <img
                    src={userProfile?.photoURL || defaultAvatar}
                    alt="Current profile"
                    referrerPolicy="no-referrer"
                    className="h-16 w-16 rounded-full border-2 border-white/20 object-cover shadow-md"
                  />
                </div>
                
                {/* Close button with X icon */}
                <button 
                  onClick={onClose}
                  className="p-1 hover:bg-white/10 rounded-full transition cursor-pointer text-white"
                  title="Close Menu"
                >
                  <X className="h-5.5 w-5.5" />
                </button>
              </div>

              {/* Display name & email details */}
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-sm font-bold truncate tracking-tight">
                    {userProfile?.displayName || "Subham Raj"}
                  </h2>
                  <p className="text-[11px] text-white/75 truncate mt-0.5">
                    {userProfile?.email || "no-phone-linked"}
                  </p>
                </div>
                {/* Chevron icon decor */}
                <ChevronDown className="h-4 w-4 text-white/80 shrink-0" />
              </div>
            </div>

            {/* List menu options */}
            <div className="flex-1 overflow-y-auto py-1">
              {/* Option 1: New Group */}
              <button
                onClick={() => {
                  onClose();
                  onOpenNewChat();
                }}
                className="w-full text-left px-5 py-3 hover:bg-slate-50 transition flex items-center gap-5 text-slate-700 hover:text-slate-900 cursor-pointer"
              >
                <Users className="h-4.5 w-4.5 text-slate-400" />
                <span className="text-[12.5px] font-bold">New Group</span>
              </button>

              {/* Option 2: All Registered Users / Contacts */}
              <button
                onClick={() => {
                  onClose();
                  onToggleRegisteredUsers();
                }}
                className="w-full text-left px-5 py-3 hover:bg-slate-50 transition flex items-center gap-5 text-slate-700 hover:text-slate-900 cursor-pointer"
              >
                <UserIcon className="h-4.5 w-4.5 text-slate-400" />
                <div className="flex-1 flex justify-between items-center pr-1">
                  <span className="text-[12.5px] font-bold">Registered Users</span>
                  <span className="bg-slate-100 text-slate-500 font-mono text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                    Active
                  </span>
                </div>
              </button>

              {/* Option 3: Contacts list label */}
              <button
                onClick={() => {
                  onClose();
                  onToggleRegisteredUsers();
                }}
                className="w-full text-left px-5 py-3 hover:bg-slate-50 transition flex items-center gap-5 text-slate-700 hover:text-slate-900 cursor-pointer"
              >
                <UserIcon className="h-4.5 w-4.5 text-slate-400" />
                <span className="text-[12.5px] font-bold">Contacts</span>
              </button>

              {/* Option 4: Calls decor */}
              <div
                className="w-full text-left px-5 py-3 hover:bg-slate-50 transition flex items-center gap-5 text-slate-450 cursor-not-allowed"
                title="Calls feature currently encrypted"
              >
                <Phone className="h-4.5 w-4.5 text-slate-300" />
                <span className="text-[12.5px] font-semibold">Calls</span>
              </div>

              {/* Option 5: People Nearby */}
              <div
                className="w-full text-left px-5 py-3 hover:bg-slate-50 transition flex items-center gap-5 text-slate-450 cursor-not-allowed"
              >
                <MapPin className="h-4.5 w-4.5 text-slate-300" />
                <span className="text-[12.5px] font-semibold">People Nearby</span>
              </div>

              {/* Option 6: Saved Messages */}
              <div
                className="w-full text-left px-5 py-3 hover:bg-slate-50 transition flex items-center gap-5 text-slate-450 cursor-not-allowed"
              >
                <Bookmark className="h-4.5 w-4.5 text-slate-300" />
                <span className="text-[12.5px] font-semibold">Saved Messages</span>
              </div>

              {/* Option 7: Profile Customization Settings (Crucial requirement!) */}
              <button
                onClick={() => setDrawerMode("settings")}
                className="w-full text-left px-5 py-3 hover:bg-slate-50 transition flex items-center gap-5 text-slate-700 hover:text-slate-900 cursor-pointer border-t border-slate-50"
              >
                <Settings className="h-4.5 w-4.5 text-slate-400" />
                <span className="text-[12.5px] font-bold text-slate-800">Settings</span>
              </button>

              {/* Separated area */}
              <div className="border-t border-slate-100 my-1"></div>

              {/* Option 8: Invite Friends */}
              <div className="w-full text-left px-5 py-3 hover:bg-slate-50 transition flex items-center gap-5 text-slate-450 cursor-not-allowed">
                <UserPlus className="h-4.5 w-4.5 text-slate-350" />
                <span className="text-[12.5px] font-semibold">Invite Friends</span>
              </div>

              {/* Option 9: Telegram Features */}
              <div className="w-full text-left px-5 py-3 hover:bg-slate-50 transition flex items-center gap-5 text-slate-450 cursor-not-allowed">
                <HelpCircle className="h-4.5 w-4.5 text-slate-350" />
                <span className="text-[12.5px] font-semibold">Telegram Features</span>
              </div>

              {/* Option 10: Log Out */}
              <button
                onClick={() => {
                  onClose();
                  logoutUser();
                }}
                className="w-full text-left px-5 py-3 hover:bg-rose-50/50 hover:text-rose-600 transition flex items-center gap-5 text-slate-550 border-t border-slate-100/80 cursor-pointer"
              >
                <LogOut className="h-4.5 w-4.5. text-rose-400 shrink-0" />
                <span className="text-[12.5px] font-bold">Logout Securely</span>
              </button>
            </div>
            
            {/* Version name footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 text-[10px] text-center text-slate-400 font-mono">
              ZyroX Client • Secure Chat Build
            </div>
          </>
        ) : (
          /* Profile / User settings mode within the drawer */
          <div className="flex flex-col h-full overflow-hidden" id="sliding-menu-settings">
            {/* Blue Settings Header with standard back button */}
            <div className="bg-[#527da3] p-4 pt-6 text-white select-none flex items-center gap-3">
              <button
                onClick={() => setDrawerMode("menu")}
                className="p-1 hover:bg-white/10 rounded-lg text-white transition cursor-pointer"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h3 className="text-sm font-extrabold">Settings</h3>
                <p className="text-[10px] text-sky-100/80 font-medium">Change username & profile photo</p>
              </div>
            </div>

            {/* Scrollable form inside settings */}
            <form onSubmit={handleSaveSettings} className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Status indicator alerts */}
              {statusText && (
                <div
                  className={`p-3 text-[11.5px] rounded-xl flex items-start gap-1.5 border font-semibold ${
                    statusText.type === "success"
                      ? "bg-emerald-50 border-emerald-100/50 text-emerald-800"
                      : "bg-rose-50 border-rose-100/50 text-rose-700"
                  }`}
                >
                  {statusText.type === "success" ? (
                    <Check className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                  ) : (
                    <X className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                  )}
                  <span className="leading-relaxed">{statusText.text}</span>
                </div>
              )}

              {/* Large Edit Avatar upload zone */}
              <div className="flex flex-col items-center">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative group cursor-pointer w-24 h-24 rounded-full overflow-hidden border-2 flex items-center justify-center transition-all ${
                    isDragging
                      ? "border-primary bg-sky-50 scale-105"
                      : "border-slate-200 hover:border-[#527da3]"
                  }`}
                  title="Click or drag an image here to change profile photo"
                >
                  <img
                    src={photoURL || defaultAvatar}
                    alt="Avatar upload preview"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="h-5 w-5 text-white" />
                    <span className="text-[8px] text-white font-extrabold mt-1 uppercase tracking-wider">Change</span>
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
                    className="text-[10px] font-bold text-[#527da3] hover:underline cursor-pointer"
                  >
                    Upload Photo
                  </button>
                  {photoURL !== defaultAvatar && (
                    <>
                      <span className="text-slate-300 text-[10px]">•</span>
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoURL(defaultAvatar);
                          setStatusText({ type: "success", text: "Avatar reverted to email default." });
                        }}
                        className="text-[10px] font-bold text-slate-500 hover:text-slate-700 flex items-center gap-0.5 cursor-pointer"
                      >
                        <RotateCcw className="h-2.5 w-2.5" /> Default
                      </button>
                    </>
                  )}
                </div>
                <p className="text-[9px] text-slate-400 mt-1 font-medium text-center">
                  Drag and drop or select photo to compress and save
                </p>
              </div>

              {/* Username Input */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Choose Username
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Subham Raj"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#527da3] focus:ring-1 focus:ring-[#527da3]/30 transition"
                />
              </div>

              {/* Locked email address info */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  Verified Identity
                </label>
                <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs text-slate-500 font-mono">
                  {userProfile?.email || "anonymous"}
                </div>
              </div>

              {/* Actions submit */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setDrawerMode("menu")}
                  className="flex-1 bg-slate-105 hover:bg-slate-200 hover:text-slate-800 text-slate-600 font-bold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 bg-[#527da3] hover:bg-[#436785] text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-md flex items-center justify-center gap-1 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <Loader className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
