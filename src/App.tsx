import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, signInWithGoogle, logoutUser, db } from "./lib/firebase";
import { requestBrowserNotificationPermission } from "./lib/notifications";
import { Channel } from "./types";
import UserSetup from "./components/UserSetup";
import NewChatModal from "./components/NewChatModal";
import ChannelList from "./components/ChannelList";
import ChatWindow from "./components/ChatWindow";
import UserProfileModal from "./components/UserProfileModal";
import UserProfilePreviewModal from "./components/UserProfilePreviewModal";
import { KeyRound, ShieldAlert, Sparkles, LogOut, Loader, Lock, MessageCircle, Settings } from "lucide-react";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [privateKeyJwk, setPrivateKeyJwk] = useState<string | null>(null);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [previewUserUid, setPreviewUserUid] = useState<string | null>(null);
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(false);
  const [joiningError, setJoiningError] = useState<string | null>(null);

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
            let initialName = "SecureUser";
            if (emailStr) {
              const emailBeforeGmail = emailStr.split("@gmail.com")[0] || emailStr.split("@")[0] || "";
              if (emailBeforeGmail.length > 0) {
                initialName = emailBeforeGmail;
              }
            }
            const initialPhoto = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(emailStr || "agent")}`;
            
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
  if (!currentUser) {
    return (
      <div className="h-screen w-screen bg-[#fafbfc] flex items-center justify-center overflow-hidden relative select-none">
        
        {/* Soft background light */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#3b82f6]/5 rounded-full blur-[140px] pointer-events-none"></div>

        <div className="w-full max-w-lg flex flex-col items-center text-center z-10 px-6">
          
          {/* Main Google Sign-in Typography Header */}
          <h1 className="text-[38px] font-normal text-[#1f1f1f] tracking-tight font-sans leading-none">
            Bettors Chat
          </h1>
          
          <h2 className="text-[20px] text-[#444746] mt-2 font-normal font-sans">
            with your Google Account
          </h2>
          
          <p className="text-[13.5px] text-[#5f6368] mt-4 max-w-sm mx-auto font-sans leading-relaxed">
            Connect with verified sports bettors. Sign in to analyze real-time odds, exchange daily picks, and talk betting strategies completely secure and encrypted.
          </p>

          {/* Minimalist Google Avatar Placeholder Centerpiece */}
          <div className="my-[46px] relative animate-fade-in">
            <div className="w-[140px] h-[140px] rounded-full bg-[#f0f4f9] flex flex-col items-center justify-center overflow-hidden border border-slate-100 shadow-inner">
              {/* Head */}
              <div className="w-13 h-13 rounded-full bg-[#2a62ff] mb-1.5 translate-y-2 shadow-sm"></div>
              {/* Shoulders */}
              <div className="w-26 h-15 rounded-t-full bg-[#2a62ff] translate-y-3.5 shadow-sm"></div>
            </div>
          </div>

          {/* Authentic Google Sign-in Button */}
          <button
            onClick={signInWithGoogle}
            className="px-7 py-3.5 bg-white text-[#1f1f1f] font-sans font-medium text-[15px] border border-[#dadce0] hover:bg-[#f8fafd] hover:border-[#ccd0d5] active:bg-[#f1f3f4] rounded-2xl shadow-[0_1px_3px_rgba(60,64,67,0.3),0_1px_2px_rgba(60,64,67,0.15)] hover:shadow-[0_1px_3px_1px_rgba(60,64,67,0.15),0_1px_2px_0_rgba(60,64,67,0.3)] transition-all cursor-pointer flex items-center justify-center gap-3.5 min-w-[245px] select-none"
            id="google-login-btn"
          >
            {/* Colorful custom Google branded SVG */}
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
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
            <span className="tracking-wide">Sign in with Google</span>
          </button>

          {joiningError && (
            <div className="mt-6 p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-semibold max-w-xs animate-fade-in">
              {joiningError}
            </div>
          )}
          
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-vibrant-bg flex flex-col overflow-hidden text-slate-800" id="fortress-app-main-layout">
      {/* 2. E2EE Key Verification & Setup Panel */}
      <UserSetup
        userId={currentUser.uid}
        userEmail={currentUser.email || ""}
        onKeysReady={handleKeysReady}
      />

      {/* 3. Global Navigation Header */}
      <header className="px-6 py-4 bg-white border-b border-vibrant-border flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-xl shrink-0 border border-primary/20">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-slate-805 tracking-wider font-sans">FORTRESS SECURE</h1>
            <p className="text-[9px] font-bold text-accent uppercase tracking-widest flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-accent animate-pulse"></span> ACTIVE NODE SECURITY
            </p>
          </div>
        </div>

        {/* Current user micro profile */}
        <div className="flex items-center gap-4">
          <div 
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-2.5 text-right cursor-pointer group hover:opacity-85 transition"
            title="Click to customize profile"
          >
            <div className="hidden sm:block">
              <p className="text-xs font-bold text-slate-800 leading-tight group-hover:text-primary transition">
                {userProfile?.displayName || currentUser.displayName || "Agent"}
              </p>
              <p className="text-[10px] text-slate-400 font-mono truncate max-w-40">{currentUser.email}</p>
            </div>
            <div className="relative">
              <img
                src={userProfile?.photoURL || currentUser.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userProfile?.displayName || "Agent")}`}
                referrerPolicy="no-referrer"
                className="h-8 w-8 rounded-xl border border-slate-200 object-cover shadow-xs"
              />
              <div className="absolute -bottom-1 -right-1 bg-white border border-slate-200 text-slate-500 rounded-full p-0.5 shadow-xs">
                <Settings className="h-2.5 w-2.5 text-primary" />
              </div>
            </div>
          </div>

          <button
            onClick={logoutUser}
            className="p-1.5 px-3.5 bg-slate-100 hover:bg-slate-205 active:bg-slate-300 text-slate-600 hover:text-slate-800 rounded-xl border border-slate-200 transition flex items-center gap-1.5 cursor-pointer text-xs font-semibold"
            id="user-logout-btn"
          >
            <LogOut className="h-3.5 w-3.5" />
            Exit
          </button>
        </div>
      </header>

      {/* 4. Chat Area Wrapper */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Left: Chats, Groups and Alerts */}
        <ChannelList
          currentUserId={currentUser.uid}
          activeChannelId={activeChannel ? activeChannel.id : null}
          onSelectChannel={(chan) => setActiveChannel(chan)}
          onOpenNewChat={() => setIsNewChatOpen(true)}
          onBrowserNotificationToggle={handleBrowserNotificationToggle}
          browserNotificationsEnabled={browserNotificationsEnabled}
        />

        {/* Master Right Window: Decrypt message thread */}
        {activeChannel && privateKeyJwk ? (
          <ChatWindow
            channel={activeChannel}
            currentUserId={currentUser.uid}
            privateKeyJwkString={privateKeyJwk}
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
          <div className="flex-1 bg-white flex flex-col items-center justify-center text-slate-400 p-8 text-center" id="empty-chat-welcome">
            <div className="p-5 bg-gradient-to-tr from-primary/5 to-secondary/5 text-primary border border-primary/10 rounded-3xl mb-4 shadow-xs">
              <MessageCircle className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">Decentralized Messenger</h3>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed mt-1">
              Select or create an E2EE chat. All keys remain private and local to your system.
            </p>
          </div>
        )}
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
    </div>
  );
}
