import React, { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, signInWithGoogle, registerWithEmailPassword, loginWithEmailPassword, logoutUser, db } from "./lib/firebase";
import { seedTelegramChats } from "./lib/firebase-seed";
import { requestBrowserNotificationPermission } from "./lib/notifications";
import { Channel } from "./types";
import NewChatModal from "./components/NewChatModal";
import ChannelList from "./components/ChannelList";
import ChatWindow from "./components/ChatWindow";
import UserProfileModal from "./components/UserProfileModal";
import UserProfilePreviewModal from "./components/UserProfilePreviewModal";
import SlidingMenu from "./components/SlidingMenu";
import RegisteredUsersList from "./components/RegisteredUsersList";
import { KeyRound, ShieldAlert, Sparkles, LogOut, Loader, Lock, MessageCircle, Settings, Mail, User as UserIcon, Menu, X, Search, Plus, ArrowLeft } from "lucide-react";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [privateKeyJwk, setPrivateKeyJwk] = useState<string | null>("cleartext-private");
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [previewUserUid, setPreviewUserUid] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSlidingMenuOpen, setIsSlidingMenuOpen] = useState(false);
  const [currentSidebarView, setCurrentSidebarView] = useState<"chats" | "registered-users">("chats");

  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(false);
  const [joiningError, setJoiningError] = useState<string | null>(null);

  // Global search states in the header
  const [isHeaderSearching, setIsHeaderSearching] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");

  // Email authentication form states
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [emailField, setEmailField] = useState("");
  const [passwordField, setPasswordField] = useState("");
  const [nameField, setNameField] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 1. Observe Firebase Authentication states
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthLoading(true);
      setJoiningError(null);
      if (firebaseUser) {
        // Ensure user document exists in Firestore `/users/{uid}`
        const userRef = doc(db, "users", firebaseUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          let profile = null;
          if (!userSnap.exists()) {
            const now = new Date();
            const emailStr = firebaseUser.email || "";
            let initialName = firebaseUser.displayName || "SecureUser";
            if (initialName === "SecureUser" && emailStr) {
              const emailBeforeGmail = emailStr.split("@gmail.com")[0] || emailStr.split("@")[0] || "";
              if (emailBeforeGmail.length > 0) {
                initialName = emailBeforeGmail;
              }
            }
            const initialPhoto = firebaseUser.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(emailStr || "agent")}`;
            
            const initProfile = {
              uid: firebaseUser.uid,
              displayName: initialName,
              email: emailStr,
              photoURL: initialPhoto,
              publicKey: "", // empty until Browser generates keypair
              createdAt: now,
              isAdmin: emailStr.toLowerCase() === "zyromod@gmail.com",
            };
            await setDoc(userRef, initProfile);
            profile = initProfile;
          } else {
            profile = userSnap.data();
          }
          setUserProfile(profile);
          setCurrentUser(firebaseUser); // Active only after profile is synced
          setPrivateKeyJwk("cleartext-private");
          
          if (profile && !profile.seededTelegram) {
            const dispName = profile.displayName || firebaseUser.displayName || "User";
            const emailAddr = profile.email || firebaseUser.email || "";
            const avatarPhoto = profile.photoURL || firebaseUser.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(dispName)}`;
            seedTelegramChats(firebaseUser.uid, dispName, emailAddr, avatarPhoto);
          }
        } catch (e) {
          console.error("Firestore user initialization failed:", e);
          setJoiningError("Database sync failed. Assure security rules let you write.");
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setPrivateKeyJwk(null);
        setActiveChannel(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // Update profile from Firestore when keys are created/updated
  const handleKeysReady = (privateKeyString: string) => {
    setPrivateKeyJwk(privateKeyString);
    if (currentUser) {
      // Re-fetch profile to capture public key update
      const userRef = doc(db, "users", currentUser.uid);
      getDoc(userRef).then((snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data());
        }
      });
    }
  };

  const handleBrowserNotificationToggle = async () => {
    const granted = await requestBrowserNotificationPermission();
    setBrowserNotificationsEnabled(granted);
  };

  if (authLoading) {
    return (
      <div className="h-screen w-screen bg-vibrant-bg flex flex-col items-center justify-center text-slate-500 gap-3">
        <Loader className="h-6 w-6 animate-spin text-primary" />
        <span className="text-xs font-mono tracking-wider font-semibold">Verifying secure environment...</span>
      </div>
    );
  }

  // Not signed-in lander page (Clean, premium Google Sign In image mockup replica)
  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSubmitting(true);
    try {
      if (authMode === "register") {
        if (!nameField.trim()) {
          throw new Error("Display name is required.");
        }
        if (passwordField.length < 6) {
          throw new Error("Password must be at least 6 characters.");
        }
        await registerWithEmailPassword(emailField.trim(), passwordField, nameField.trim());
      } else {
        await loginWithEmailPassword(emailField.trim(), passwordField);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let message = err?.message || "An authentication error occurred.";
      if (err?.code === "auth/email-already-in-use") {
        message = "This email is already registered. Please login instead.";
      } else if (err?.code === "auth/invalid-credential" || err?.code === "auth/wrong-password") {
        message = "Invalid email or password.";
      } else if (err?.code === "auth/user-not-found") {
        message = "No account found with this email.";
      } else if (err?.code === "auth/invalid-email") {
        message = "Please enter a valid email address.";
      } else if (err?.code === "auth/weak-password") {
        message = "Password should be at least 6 characters.";
      }
      setAuthError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="h-screen w-screen bg-[#F8FAFC] flex items-center justify-center overflow-y-auto relative py-12 px-4 selection:bg-primary/20 selection:text-primary">
        
        {/* Soft atmospheric background gradient light */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[140px] pointer-events-none"></div>

        <div className="w-full max-w-md z-10">
          <div className="bg-white border border-[#E2E8F0] shadow-xl rounded-3xl p-8 relative flex flex-col items-stretch">
            
            {/* Header section */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary mb-3.5">
                <MessageCircle className="h-6 w-6 animate-pulse" />
              </div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight font-sans uppercase">
                Bettors Chat
              </h1>
              <p className="text-xs text-slate-400 mt-1 font-medium font-sans">
                Sports betting insights, odds, & picks in real-time
              </p>
            </div>

            {/* Auth Tab Selectors */}
            <div className="grid grid-cols-2 bg-[#F1F5F9] rounded-xl p-1 mb-6">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setAuthError(null);
                }}
                className={`py-2 text-xs font-bold font-sans uppercase rounded-lg transition-all ${
                  authMode === "login"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-450 hover:text-slate-700"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("register");
                  setAuthError(null);
                }}
                className={`py-2 text-xs font-bold font-sans uppercase rounded-lg transition-all ${
                  authMode === "register"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-450 hover:text-slate-700"
                }`}
              >
                Register
              </button>
            </div>

            {/* Email & Password Authentication Form */}
            <form onSubmit={handleEmailAuthSubmit} className="space-y-4">
              {authMode === "register" && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Display Name
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. SportsMaster7"
                      value={nameField}
                      onChange={(e) => setNameField(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/45 transition"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="email@example.com"
                    value={emailField}
                    onChange={(e) => setEmailField(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/45 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={passwordField}
                    onChange={(e) => setPasswordField(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/45 transition"
                  />
                </div>
              </div>

              {/* Action Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary hover:bg-primary-hover text-white py-3.5 px-4 rounded-xl text-xs font-bold tracking-wider uppercase transition-all shadow-md focus:outline-none flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>{authMode === "login" ? "Sign In" : "Create Account"}</span>
                )}
              </button>
            </form>

            {/* Error alerts */}
            {(authError || joiningError) && (
              <div className="mt-4 p-3.5 bg-rose-50 border border-rose-150/45 text-rose-600 rounded-xl text-xs font-semibold animate-fade-in flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                <span className="leading-relaxed">{authError || joiningError}</span>
              </div>
            )}

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <hr className="w-full border-t border-[#E2E8F0]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-[10px] uppercase tracking-wider text-slate-450 font-bold">
                  Or continue with
                </span>
              </div>
            </div>

            {/* Google Sign-in Alternative */}
            <button
              type="button"
              onClick={signInWithGoogle}
              className="px-6 py-3 bg-white text-[#1f1f1f] font-sans font-medium text-xs border border-[#dadce0] hover:bg-[#f8fafd] hover:border-[#ccd0d5] active:bg-[#f1f3f4] rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2.5"
            >
              <svg className="h-4.5 w-4.5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5.04c1.64 0 3.12.56 4.28 1.67l3.2-3.2C17.52 1.62 14.94 1 12 1 7.35 1 3.39 3.67 1.48 7.56l3.76 2.92C6.12 7.14 8.84 5.04 12 5.04z"
                />
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.43h6.44c-.28 1.47-1.11 2.71-2.36 3.55l3.66 2.84c2.14-1.97 3.39-4.88 3.39-8.48z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.24 14.48c-.23-.68-.36-1.41-.36-2.17s.13-1.49.36-2.17L1.48 7.22C.54 9.12 0 11.24 0 13.5s.54 4.38 1.48 6.28l3.76-2.92z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.66-2.84c-1.01.68-2.31 1.08-3.9 1.08-3.16 0-5.88-2.1-6.84-5.44L1.8 15.8C3.72 19.69 7.68 23 12 23z"
                />
              </svg>
              <span>Google Account</span>
            </button>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-vibrant-bg flex flex-col overflow-hidden text-slate-800" id="fortress-app-main-layout">
      {/* 3. Global Navigation Header */}
      {!activeChannel && (
        <header className="px-4 py-2 bg-[#527da3] flex items-center justify-between shrink-0 shadow-sm border-b border-sky-850/10 select-none z-10 text-white">
          {isHeaderSearching ? (
            <div className="flex-1 flex items-center gap-2">
              <button
                onClick={() => {
                  setIsHeaderSearching(false);
                  setGlobalSearchTerm("");
                }}
                className="p-1 hover:bg-white/10 rounded-full text-white transition cursor-pointer"
                title="Close search"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70 pointer-events-none" />
                <input
                  id="header-chat-search"
                  type="text"
                  autoFocus
                  placeholder="Search chats, groups or channels..."
                  value={globalSearchTerm}
                  onChange={(e) => setGlobalSearchTerm(e.target.value)}
                  className="w-full bg-white/10 hover:bg-white/15 focus:bg-white/20 text-white placeholder-white/60 text-xs rounded-xl py-1.5 pl-9 pr-8 focus:outline-none focus:ring-1 focus:ring-white/40 transition"
                />
                {globalSearchTerm && (
                  <button
                    onClick={() => setGlobalSearchTerm("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-white/70 hover:text-white rounded-full transition cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center">
                {/* Hamburger sliding menu trigger */}
                <button
                  onClick={() => setIsSlidingMenuOpen(true)}
                  className="p-1.5 hover:bg-white/10 rounded-lg mr-2 text-white transition active:scale-95 flex items-center justify-center cursor-pointer"
                  title="Open Navigation Menu"
                  id="hamburger-sliding-menu-trigger"
                >
                  <Menu className="h-5 w-5" />
                </button>

                <h1 className="text-lg font-bold tracking-wide font-sans flex items-center gap-1.5 text-white">
                  ZyroX
                </h1>
                <span className="hidden md:inline-block ml-3 text-[9px] bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 font-bold tracking-wide px-1.5 py-0.5 rounded-full">
                  E2EE SECURED
                </span>
              </div>

              {/* Current user micro profile with Telegram styling */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsHeaderSearching(true);
                  }}
                  className="p-1 text-white/90 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer"
                  title="Search chats"
                >
                  <Search className="h-4.5 w-4.5" />
                </button>

                <div className="h-4 w-px bg-white/20 mx-0.5 hidden sm:block" />

                <div 
                  onClick={() => setIsProfileOpen(true)}
                  className="flex items-center gap-2 text-right cursor-pointer group hover:bg-white/10 p-0.5 px-2 rounded-xl transition"
                  title="Click to customize profile"
                >
                  <div className="hidden sm:block">
                    <p className="text-[11.5px] font-bold text-white leading-tight">
                      {userProfile?.displayName || currentUser.displayName || "User"}
                    </p>
                    <p className="text-[9.5px] text-sky-100/70 truncate max-w-40">{currentUser.email}</p>
                  </div>
                  <div className="relative">
                    <img
                      src={userProfile?.photoURL || currentUser.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userProfile?.displayName || "User")}`}
                      referrerPolicy="no-referrer"
                      className="h-7.5 w-7.5 rounded-full border border-white/20 object-cover shadow-xs"
                    />
                    <div className="absolute -bottom-1 -right-1 bg-[#527da3] border border-white/30 text-white rounded-full p-0.5 shadow-xs">
                      <Settings className="h-2 w-2" />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </header>
      )}

      {/* 4. Chat Area Wrapper */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Pure home page chats, groups and channels panel (WhatsApp / Telegram style) */}
        <div 
          className={`h-full flex flex-col bg-white border-r border-[#E2E8F0] shrink-0 w-full md:w-80 lg:w-90 transition-all duration-300
            ${activeChannel ? "hidden md:flex" : "flex"}`}
        >
          {currentSidebarView === "registered-users" ? (
            <RegisteredUsersList
              currentUserId={currentUser.uid}
              currentUserProfile={userProfile}
              onSelectChannel={(chan) => {
                setActiveChannel(chan);
                setCurrentSidebarView("chats");
              }}
              onBackToChats={() => setCurrentSidebarView("chats")}
            />
          ) : (
            <ChannelList
              currentUserId={currentUser.uid}
              activeChannelId={activeChannel ? activeChannel.id : null}
              onSelectChannel={(chan) => {
                setActiveChannel(chan);
              }}
              onOpenNewChat={() => setIsNewChatOpen(true)}
              onBrowserNotificationToggle={handleBrowserNotificationToggle}
              browserNotificationsEnabled={browserNotificationsEnabled}
              searchTerm={globalSearchTerm}
            />
          )}
        </div>

        {/* Master Right Window: Decrypt message thread */}
        <div className={`flex-1 h-full flex flex-col ${activeChannel ? "flex" : "hidden md:flex"}`}>
          {activeChannel && privateKeyJwk ? (
            <ChatWindow
              channel={activeChannel}
              currentUserId={currentUser.uid}
              currentUserProfile={userProfile}
              privateKeyJwkString={privateKeyJwk}
              onBackToChats={() => setActiveChannel(null)}
              onStartDMWithUserId={(userId) => {
                setPreviewUserUid(null);
                const sortedIds = [currentUser.uid, userId].sort();
                const channelId = `dm-${sortedIds[0]}-${sortedIds[1]}`;
                getDoc(doc(db, "channels", channelId)).then((snap) => {
                  if (snap.exists()) {
                    setActiveChannel(snap.data() as Channel);
                  }
                });
              }}
              onViewUserProfileUid={(targetUid) => {
                if (targetUid === currentUser.uid) {
                  setIsProfileOpen(true);
                } else {
                  setPreviewUserUid(targetUid);
                }
              }}
            />
          ) : (
            <div className="flex-1 bg-slate-100 flex flex-col items-center justify-center text-slate-400 p-8 text-center select-none" id="empty-chat-welcome" style={{
              backgroundImage: "radial-gradient(#d1d5db 1px, transparent 1px)",
              backgroundSize: "20px 20px"
            }}>
              <div className="bg-slate-600/80 backdrop-blur-md text-white p-2.5 px-5 rounded-full shadow-md max-w-xs transition-transform transform">
                <p className="text-[13.5px] font-semibold leading-relaxed tracking-tight">
                  Select a chat to start messaging on ZyroX
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. Start DM or Group Chat Selection Overlay */}
      {isNewChatOpen && userProfile && (
        <NewChatModal
          currentUserId={currentUser.uid}
          currentUserProfile={userProfile}
          onClose={() => setIsNewChatOpen(false)}
          onChannelCreated={(channelId) => {
            // Retrieve created channel and bind to active view
            const userRef = doc(db, "users", currentUser.uid);
            getDoc(doc(db, "channels", channelId)).then((snap) => {
              if (snap.exists()) {
                setActiveChannel(snap.data() as Channel);
              }
            });
          }}
        />
      )}

      {/* 6. Customize User Profile Settings Overlay */}
      {isProfileOpen && userProfile && (
        <UserProfileModal
          currentUserId={currentUser.uid}
          userProfile={userProfile}
          onClose={() => setIsProfileOpen(false)}
          onProfileUpdated={(updatedProfile) => {
            setUserProfile(updatedProfile);
          }}
        />
      )}

      {/* 7. View Other User Profile Overlay */}
      {previewUserUid && userProfile && (
        <UserProfilePreviewModal
          currentUserId={currentUser.uid}
          currentUserProfile={userProfile}
          targetUserId={previewUserUid}
          onClose={() => setPreviewUserUid(null)}
          onStartChat={(channelId) => {
            getDoc(doc(db, "channels", channelId)).then((snap) => {
              if (snap.exists()) {
                setActiveChannel(snap.data() as Channel);
              }
            });
          }}
        />
      )}

      {/* 8. Slide-out Left Navigation Drawer Menu */}
      {isSlidingMenuOpen && userProfile && (
        <SlidingMenu
          isOpen={isSlidingMenuOpen}
          onClose={() => setIsSlidingMenuOpen(false)}
          currentUserId={currentUser.uid}
          userProfile={userProfile}
          onProfileUpdated={(updated) => {
            setUserProfile(updated);
          }}
          onOpenNewChat={() => setIsNewChatOpen(true)}
          onToggleRegisteredUsers={() => {
            setCurrentSidebarView("registered-users");
          }}
        />
      )}
    </div>
  );
}
