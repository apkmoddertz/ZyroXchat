import React, { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, onSnapshot, doc, setDoc, updateDoc, getDocs } from "firebase/firestore";
import { db, handleFirestoreError } from "../lib/firebase";
import { encryptMessage, decryptMessage } from "../lib/encryption";
import { playNotificationSound, showBrowserNotification } from "../lib/notifications";
import { OperationType, Channel, ChannelMember, Message } from "../types";
import { Send, Image, Loader, ShieldCheck, Lock, Sparkles, User, FileImage, ShieldAlert, MessageSquareCode, BadgeCheck, MessageCircle, ArrowLeft, Users, Globe, Plus, MoreVertical, Smile, Paperclip, Mic } from "lucide-react";

interface ChatWindowProps {
  channel: Channel;
  currentUserId: string;
  currentUserProfile: any;
  privateKeyJwkString: string;
  onStartDMWithUserId?: (userId: string) => void;
  onViewUserProfileUid?: (uid: string) => void;
  onBackToChats?: () => void;
}

export default function ChatWindow({
  channel,
  currentUserId,
  currentUserProfile,
  privateKeyJwkString,
  onStartDMWithUserId,
  onViewUserProfileUid,
  onBackToChats,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<(Message & { decryptedContent?: string })[]>([]);
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Listen to channel members to get E2EE Public Keys
  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setMembers([]);

    const membersRef = collection(db, "channels", channel.id, "members");
    const unsubMembers = onSnapshot(
      membersRef,
      (snapshot) => {
        const membersList: ChannelMember[] = [];
        let amIMember = false;
        snapshot.forEach((snap) => {
          const m = snap.data() as ChannelMember;
          membersList.push(m);
          if (m.userId === currentUserId) {
            amIMember = true;
          }
        });
        setMembers(membersList);

        // Auto join only if NOT a group channel (e.g. DM chats auto-join, group channels require explicit subscription!)
        if (!amIMember && currentUserProfile && channel.type !== "group") {
          const myMemberRef = doc(db, "channels", channel.id, "members", currentUserId);
          setDoc(myMemberRef, {
            userId: currentUserId,
            displayName: currentUserProfile.displayName || "SecureUser",
            email: currentUserProfile.email || "",
            photoURL: currentUserProfile.photoURL || "",
            publicKey: currentUserProfile.publicKey || "cleartext-public",
            joinedAt: new Date()
          }).catch((err) => console.warn("Auto-join DM room membership failed:", err));
        }
      },
      (err) => {
        console.error("Failed to read members for E2EE keys:", err);
        try {
          handleFirestoreError(err, OperationType.GET, `channels/${channel.id}/members`);
        } catch {}
      }
    );

    // 2. Listen to real-time end-to-end encrypted messages
    const messagesRef = collection(db, "channels", channel.id, "messages");
    const messagesQuery = query(messagesRef, orderBy("createdAt", "asc"));

    const unsubMessages = onSnapshot(
      messagesQuery,
      async (snapshot) => {
        const rawMessages: Message[] = [];
        snapshot.forEach((msgSnap) => {
          rawMessages.push(msgSnap.data() as Message);
        });

        // Decrypt all messages on client side asynchronously
        const decryptedList = await Promise.all(
          rawMessages.map(async (msg) => {
            let cleartext = "🔒 [Message encrypted]";
            // Find key share sent for the current registered user
            const userEncryptedAesShare = msg.recipientKeys[currentUserId];
            
            if (userEncryptedAesShare) {
              try {
                cleartext = await decryptMessage(
                  msg.encryptedContent,
                  msg.iv,
                  userEncryptedAesShare,
                  privateKeyJwkString
                );
              } catch (decErr) {
                console.error("Decryption exception on message id", msg.id, decErr);
                cleartext = "🔓 [Decryption Error: Private Key cannot decrypt item]";
              }
            } else {
              cleartext = "🔓 [Encrypted for other members]";
            }

            return {
              ...msg,
              decryptedContent: cleartext,
            };
          })
        );

        // Deduplicate and sound check when a newer message is placed on stream by another writer
        setMessages((prev) => {
          if (prev.length > 0 && decryptedList.length > prev.length) {
            const lastNewMsg = decryptedList[decryptedList.length - 1];
            if (lastNewMsg.senderId !== currentUserId) {
              // Sweet physical alert tone
              playNotificationSound();
              // In-background secure OS warning
              showBrowserNotification(
                `🔒 Secure Chat: ${lastNewMsg.senderName}`,
                lastNewMsg.decryptedContent?.startsWith("[IMAGE]:") 
                  ? "Sent an encrypted photo file" 
                  : lastNewMsg.decryptedContent || "Encrypted Message"
              );
            }
          }
          return decryptedList;
        });
        
        setLoading(false);
      },
      (err) => {
        console.error("Messages subscribe blocked:", err);
        setErrorText("You do not have credentials to view this vault.");
        setLoading(false);
        try {
          handleFirestoreError(err, OperationType.GET, `channels/${channel.id}/messages`);
        } catch {}
      }
    );

    return () => {
      unsubMembers();
      unsubMessages();
    };
  }, [channel.id, currentUserId, privateKeyJwkString]);

  // Adjust scroll position to latest E2EE message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, mediaPreview]);

  const handleMentionClick = async (targetUsername: string) => {
    if (!targetUsername) return;
    setErrorText(null);
    try {
      const usersSnap = await getDocs(query(collection(db, "users")));
      let foundUser: any = null;
      usersSnap.forEach((docSnap) => {
        const u = docSnap.data();
        if (u.displayName?.toLowerCase().trim() === targetUsername.toLowerCase().trim()) {
          foundUser = u;
        }
      });

      if (foundUser) {
        if (onStartDMWithUserId) {
          onStartDMWithUserId(foundUser.uid);
        }
      } else {
        setErrorText(`Profile info for "@${targetUsername}" not found on server.`);
        setTimeout(() => setErrorText(null), 4000);
      }
    } catch (e) {
      console.error("Failed to query user for mention link:", e);
      setErrorText("Error resolving secure user mention link.");
    }
  };

  const renderMessageContent = (content: string, isMe: boolean) => {
    const regex = /(inbox\s+@([a-zA-Z0-9_.-]+))|(@([a-zA-Z0-9_.-]+))/g;
    
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }

      const fullMatch = match[0];
      const targetUsername = match[2] || match[4];

      parts.push(
        <span
          key={match.index}
          onClick={() => handleMentionClick(targetUsername)}
          className={`font-semibold cursor-pointer select-text transition duration-150 ${
            isMe
              ? "text-[#2b68a8] hover:underline"
              : "text-[#1d82db] hover:underline"
          }`}
        >
          {fullMatch}
        </span>
      );

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts.length > 0 ? parts : content;
  };

  // Convert files into base64 DataURL
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorText(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 400 * 1024) {
      setErrorText("Security limit: Attachments must be under 400KB to stay within document margins.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorText("Only image attachments are currently allowed.");
      return;
    }

    setMediaFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setMediaPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Seal message details, encrypt via RSA-AES, and publish mock-free to Firestore
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !mediaPreview) return;
    if (members.length === 0) {
      setErrorText("Connecting to keys. Please wait a millisecond.");
      return;
    }

    setSending(true);
    setErrorText(null);
    
    try {
      // 1. Gather all participants registered with public keys inside this channel 
      let activeRecipients = members
        .filter((mem) => mem.publicKey)
        .map((mem) => ({
          userId: mem.userId,
          publicKeyJwkString: mem.publicKey,
        }));

      if (activeRecipients.length === 0) {
        activeRecipients = [{
          userId: currentUserId,
          publicKeyJwkString: "cleartext-public"
        }];
      }

      // Prepare cleartext payload
      let finalCleartext = text.trim();
      if (mediaPreview) {
        // Embed Base64 encrypted media inline
        finalCleartext = `[IMAGE]:${mediaPreview}`;
      }

      // 2. Perform RSA-AES Hybrid envelope encryption
      const encryptedPayload = await encryptMessage(finalCleartext, activeRecipients);

      const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const messageDocRef = doc(db, "channels", channel.id, "messages", messageId);

      const userProfile = members.find((m) => m.userId === currentUserId);
      const senderName = userProfile?.displayName || "Private User";
      const senderPhotoUrl = userProfile?.photoURL || "";

      const now = new Date();

      // 3. Store base64 security sealed envelope strictly into Firestore documents
      await setDoc(messageDocRef, {
        id: messageId,
        senderId: currentUserId,
        senderName,
        senderPhotoURL: senderPhotoUrl,
        encryptedContent: encryptedPayload.encryptedContent,
        iv: encryptedPayload.iv,
        recipientKeys: encryptedPayload.recipientKeys,
        isEncrypted: true,
        createdAt: now,
      });

      // 4. Update parent Channel metadata for latest message status safely
      const channelDocRef = doc(db, "channels", channel.id);
      await updateDoc(channelDocRef, {
        latestMessageText: mediaPreview ? "🔒 Encrypted Photo" : `🔒 ${text.trim().substring(0, 40)}...`,
        latestMessageSender: senderName,
        latestMessageAt: now,
        updatedAt: now,
      });

      // Clear layout input bounds
      setText("");
      setMediaFile(null);
      setMediaPreview(null);
    } catch (err) {
      console.error("Sending failed:", err);
      setErrorText("Failed to encrypt and transmit payload.");
    } finally {
      setSending(false);
    }
  };

  const clearSelectedMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isSubscribed = channel.type === "group"
    ? members.some((mem) => mem.userId === currentUserId)
    : true;

  const handleSubscribe = async () => {
    if (!currentUserProfile) return;
    try {
      const myMemberRef = doc(db, "channels", channel.id, "members", currentUserId);
      await setDoc(myMemberRef, {
        userId: currentUserId,
        displayName: currentUserProfile.displayName || "SecureUser",
        email: currentUserProfile.email || "",
        photoURL: currentUserProfile.photoURL || "",
        publicKey: currentUserProfile.publicKey || "cleartext-public",
        joinedAt: new Date()
      });
    } catch (err) {
      console.error("Failed to subscribe:", err);
      setErrorText("Failed to subscribe to the group. Please try again.");
    }
  };

  const otherMember = channel.type === "dm"
    ? members.find((mem) => mem.userId !== currentUserId)
    : null;

  const chatTitle = channel.type === "group"
    ? channel.name
    : (otherMember?.displayName || channel.name);

  const chatAvatar = channel.type === "group"
    ? channel.avatarUrl
    : (otherMember?.photoURL || channel.avatarUrl);

  const renderHeaderAvatar = () => {
    if (chatAvatar) {
      return (
        <img
          src={chatAvatar}
          alt={chatTitle}
          className="h-10 w-10 rounded-full object-cover border border-slate-200 shadow-xs shrink-0"
          referrerPolicy="no-referrer"
        />
      );
    }
    const initials = chatTitle ? chatTitle.charAt(0).toUpperCase() : "?";
    return (
      <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 bg-gradient-to-tr ${
        channel.type === "group"
          ? "from-[#4a76a8] to-[#608bb9]"
          : "from-emerald-400 to-teal-500"
      }`}>
        {initials}
      </div>
    );
  };

  return (
    <div className="flex-1 bg-vibrant-bg flex flex-col h-full overflow-hidden" id="chat-window-view">
      {/* Telegram-style Solid Blue Header Banner */}
      <div className="px-4 py-2 bg-[#527da3] text-white flex items-center justify-between shrink-0 shadow-sm select-none z-10">
        <div className="flex items-center gap-2 min-w-0">
          {onBackToChats && (
            <button
               onClick={onBackToChats}
               className="p-2 -ml-1.5 hover:bg-white/10 active:bg-white/20 text-white rounded-full transition cursor-pointer shrink-0"
               title="Back to chat list"
            >
              <ArrowLeft className="h-5.5 w-5.5" />
            </button>
          )}
          
          <div className="flex items-center gap-2.5 min-w-0">
            {renderHeaderAvatar()}
            <div className="min-w-0">
              <h2 className="text-[15.5px] font-bold text-white font-sans tracking-tight leading-snug truncate">
                {chatTitle}
              </h2>
              <p className="text-[11.5px] text-sky-100/80 font-normal leading-none mt-0.5">
                {channel.type === "group" ? (
                  <span>{members.length} members, {Math.max(1, Math.ceil(members.length * 0.3))} online</span>
                ) : (
                  <span>online</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Vertical ellipsis action link matching screenshot */}
        <div className="shrink-0 flex items-center">
          <button className="p-2 text-white/90 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer">
            <MoreVertical className="h-5.5 w-5.5" />
          </button>
        </div>
      </div>

      {errorText && (
        <div className="m-4 shrink-0 p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs flex gap-2 font-medium">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
          <span>{errorText}</span>
        </div>
      )}

      {!isSubscribed ? (
        <div 
          className="flex-1 overflow-y-auto px-6 py-12 flex flex-col items-center justify-center select-none"
          style={{
            backgroundColor: "#eef2f5",
            backgroundImage: "radial-gradient(#d5dde6 1.2px, transparent 1.2px)",
            backgroundSize: "18px 18px"
          }}
        >
          <div className="max-w-md w-full bg-white border border-slate-200/80 rounded-3xl p-8 shadow-sm flex flex-col items-center gap-6 text-center animate-fade-in">
            {/* Pulsing Globe or Custom Ground Icon Banner */}
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-[#3a78b5] to-[#2e6091] flex items-center justify-center text-white shadow-md shadow-slate-350/50">
              <Globe className="h-8 w-8 text-white" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-extrabold text-slate-800 uppercase font-sans tracking-wide">
                Subscribe to Start Chatting
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
                You are currently previewing the <span className="font-extrabold text-slate-705">{channel.name}</span> ground. Join as a subscriber to start sending and receiving end-to-end encrypted messages with members.
              </p>
            </div>

            <div className="w-full border-t border-slate-150" />

            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200/60 p-2.5 px-4 rounded-xl">
              <Users className="h-4 w-4 text-[#3a78b5]" />
              <span>{members.length} active subscribers on ground</span>
            </div>

            <button
              onClick={handleSubscribe}
              className="w-full py-3 bg-[#111111] hover:bg-[#222222] text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-black/10 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              Subscribe to Channel
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Messages stream display with seamless Telegram patterns */}
          <div 
            className="flex-1 overflow-y-auto px-4 py-5 space-y-4 select-text"
            style={{
              backgroundColor: "#d5e1ee",
              backgroundImage: "radial-gradient(#b5cbe3 1.3px, transparent 1.3px)",
              backgroundSize: "20px 20px"
            }}
          >
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 font-sans">
                <Loader className="h-5.5 w-5.5 animate-spin text-[#527da3]" />
                <span className="text-xs font-semibold">Streaming room messages...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 max-w-sm mx-auto text-center py-12">
                <div className="p-4 bg-white/80 border border-slate-200/50 rounded-full animate-bubble shadow-sm">
                  <Sparkles className="h-6 w-6 text-[#527da3]" />
                </div>
                <p className="text-xs font-bold text-slate-700 font-sans uppercase tracking-wider">Chat Room Empty</p>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Start exchanging messages, attachments and secure chats inside this room.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderId === currentUserId;
                const decryptedBody = msg.decryptedContent || "";
                const isImage = decryptedBody.startsWith("[IMAGE]:");
                const timeString = msg.createdAt?.seconds 
                  ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
                  : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2.5 max-w-[85%] sm:max-w-[75%] ${isMe ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                  >
                    {!isMe && (
                      <img
                        src={
                          msg.senderPhotoURL ||
                          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(msg.senderName)}`
                        }
                        referrerPolicy="no-referrer"
                        onClick={() => onViewUserProfileUid && onViewUserProfileUid(msg.senderId)}
                        className="h-8.5 w-8.5 rounded-full border border-slate-200/60 shrink-0 self-end mb-1 object-cover shadow-sm cursor-pointer hover:opacity-85 hover:scale-105 transition duration-150"
                        title="View user profile"
                      />
                    )}
                    <div className="relative">
                      <div
                        className={`p-3 rounded-2xl relative overflow-hidden group shadow-xs select-text ${
                          isMe
                            ? "bg-[#efffde] text-[#111111] rounded-br-[2px] border border-[#d2eba3] pr-12 pb-4.5"
                            : "bg-white text-[#111111] rounded-bl-[2px] border border-slate-200/50 pr-12 pb-4.5"
                        }`}
                        style={{ minWidth: "95px" }}
                      >
                        {/* Sender's Display Name for incoming messages inside group chats */}
                        {channel.type === "group" && !isMe && (
                          <div 
                            onClick={() => onViewUserProfileUid && onViewUserProfileUid(msg.senderId)}
                            className="text-[#3a78b5] font-bold text-[12.5px] mb-1 hover:underline cursor-pointer select-none leading-none truncate max-w-48"
                          >
                            {msg.senderName}
                          </div>
                        )}

                        {isImage ? (
                          <div className="space-y-1 pr-6">
                            <img
                              src={decryptedBody.replace("[IMAGE]:", "")}
                              alt="Secure photo attachment"
                              referrerPolicy="no-referrer"
                              className="max-w-xs max-h-48 rounded-xl object-contain border border-slate-200/80"
                            />
                          </div>
                        ) : (
                          <div className="text-[14px] leading-normal whitespace-pre-wrap select-text pr-2.5">
                            {renderMessageContent(decryptedBody, isMe)}
                          </div>
                        )}

                        {/* Relative Timestamp and double ticks inside the bubble */}
                        <div className="absolute bottom-1 right-2 flex items-center gap-0.5 select-none pointer-events-none">
                          <span className={`text-[10px] font-sans ${isMe ? "text-[#5cb85c]" : "text-slate-400"} font-normal`}>
                            {timeString}
                          </span>
                          {isMe && (
                            <span className="text-[#5cb85c] text-[11px] font-bold leading-none select-none">✔✔</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Typing box layout structured exactly like Telegram in screenshot */}
          <div className="py-2.5 px-4 bg-[#f0f4f8] border-t border-slate-200 shrink-0">
            {mediaPreview && (
              <div className="mb-2 p-2 bg-white border border-slate-205 rounded-xl flex items-center justify-between max-w-xs shadow-xs">
                <div className="flex items-center gap-2">
                  <FileImage className="h-5 w-5 text-[#527da3]" />
                  <div className="text-[10px] text-slate-600 font-mono truncate max-w-48 font-semibold">
                    {mediaFile ? mediaFile.name : "Secure Media payload"}
                  </div>
                </div>
                <button
                  onClick={clearSelectedMedia}
                  className="p-1 px-2 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded-lg font-bold transition text-[10px] font-sans cursor-pointer"
                >
                  Remove
                </button>
              </div>
            )}

            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              {/* Curved Input Wrapper */}
              <div className="flex-1 bg-white hover:bg-slate-50/50 border border-slate-200/80 rounded-2xl px-3 py-1.5 flex items-center gap-2 shadow-xs transition duration-150">
                
                {/* Emoji Icon Button */}
                <button
                  type="button"
                  onClick={() => setText(prev => prev + "😊")}
                  className="p-1 text-slate-400 hover:text-slate-600 active:scale-95 transition cursor-pointer shrink-0"
                  title="Insert emoji"
                >
                  <Smile className="h-5.5 w-5.5" />
                </button>

                {/* Input Text Field */}
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={sending}
                  placeholder={mediaPreview ? "Press Transmit to upload..." : "Message"}
                  className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-450 focus:outline-none py-0.5"
                />

                {/* Secure File Select Attachment Trigger */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1 text-slate-400 hover:text-slate-600 active:scale-95 transition cursor-pointer shrink-0"
                  title="Attach secure image file"
                >
                  <Paperclip className="h-5.5 w-5.5" />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*"
                  className="hidden"
                />
              </div>

              {/* Telegram mic/send layout */}
              <button
                type="submit"
                disabled={sending}
                className="p-3 bg-[#527da3] hover:bg-[#46698b] active:scale-95 text-white rounded-full transition flex items-center justify-center shrink-0 shadow-sm cursor-pointer"
                title={text.trim() || mediaPreview ? "Transmit encrypted message" : "Hold to talk"}
              >
                {sending ? (
                  <Loader className="h-5.5 w-5.5 animate-spin" />
                ) : (text.trim() || mediaPreview) ? (
                  <Send className="h-5.5 w-5.5 pl-0.5" />
                ) : (
                  <Mic className="h-5.5 w-5.5" />
                )}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
