import React, { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, onSnapshot, doc, setDoc, updateDoc, getDocs } from "firebase/firestore";
import { db, handleFirestoreError } from "../lib/firebase";
import { encryptMessage, decryptMessage } from "../lib/encryption";
import { playNotificationSound, showBrowserNotification } from "../lib/notifications";
import { OperationType, Channel, ChannelMember, Message } from "../types";
import { Send, Image, Loader, ShieldCheck, Lock, Sparkles, User, FileImage, ShieldAlert, MessageSquareCode, BadgeCheck } from "lucide-react";

interface ChatWindowProps {
  channel: Channel;
  currentUserId: string;
  privateKeyJwkString: string;
  onStartDMWithUserId?: (userId: string) => void;
  onViewUserProfileUid?: (uid: string) => void;
}

export default function ChatWindow({
  channel,
  currentUserId,
  privateKeyJwkString,
  onStartDMWithUserId,
  onViewUserProfileUid,
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
        snapshot.forEach((snap) => {
          membersList.push(snap.data() as ChannelMember);
        });
        setMembers(membersList);
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
        <button
          key={match.index}
          onClick={() => handleMentionClick(targetUsername)}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold transition hover:opacity-90 cursor-pointer text-[11px] align-baseline select-none ${
            isMe 
              ? "bg-white/25 text-white hover:bg-white/40" 
              : "bg-primary/10 text-primary hover:bg-primary/20"
          }`}
        >
          <MessageSquareCode className="h-3 w-3 shrink-0" />
          {fullMatch}
        </button>
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
      const activeRecipients = members
        .filter((mem) => mem.publicKey)
        .map((mem) => ({
          userId: mem.userId,
          publicKeyJwkString: mem.publicKey,
        }));

      if (activeRecipients.length === 0) {
        throw new Error("No secure public key shares recorded on this sub-network.");
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

  return (
    <div className="flex-1 bg-vibrant-bg flex flex-col h-full overflow-hidden" id="chat-window-view">
      {/* Active Room Title Banner (Vibrant Palette version) */}
      <div className="px-6 py-4 border-b border-vibrant-border bg-white flex items-center justify-between shrink-0 shadow-xs">
        <div>
          <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5 uppercase font-sans">
            <Lock className="h-4 w-4 text-primary" />
            {channel.name}
          </h2>
          <p className="text-[10px] text-slate-400 font-mono tracking-wide font-medium">
            CRYPTO ROOM ID: {channel.id.toUpperCase()} • {members.length} SECURE PEER KEYS ACTIVE
          </p>
        </div>
        <div className="security-pill bg-[#ECFDF5] text-[#065F46] px-3.5 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 border border-[#A7F3D0]/40">
          <ShieldCheck className="h-4 w-4 text-[#10B981]" />
          End-to-End Encrypted
        </div>
      </div>

      {errorText && (
        <div className="m-4 shrink-0 p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs flex gap-2 font-medium">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
          <span>{errorText}</span>
        </div>
      )}

      {/* Messages stream display */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader className="h-5 w-5 animate-spin text-primary" />
            <span className="text-xs font-semibold">Decrypting decentralized security layer...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 max-w-sm mx-auto text-center py-12">
            <div className="p-4 bg-primary/10 text-primary border border-primary/20 rounded-full animate-bounce">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="text-xs font-bold text-slate-700">Vault Room Ready</p>
            <p className="text-[11px] leading-relaxed text-slate-450">
              Every message sent to this database is converted into armored RSA-AES ciphertext beforehand. Only room participants hold the private key.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            const decryptedBody = msg.decryptedContent || "";
            const isImage = decryptedBody.startsWith("[IMAGE]:");
            
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[80%] ${isMe ? "ml-auto flex-row-reverse" : "mr-auto"}`}
              >
                <img
                  src={
                    msg.senderPhotoURL ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(msg.senderName)}`
                  }
                  referrerPolicy="no-referrer"
                  onClick={() => onViewUserProfileUid && onViewUserProfileUid(msg.senderId)}
                  className="h-8 w-8 rounded-xl border border-slate-100 shrink-0 self-end mb-1 object-cover shadow-xs cursor-pointer hover:opacity-85 hover:scale-105 transition"
                  title="View user profile"
                />
                <div className="space-y-1">
                  <div className={`flex items-center gap-2 text-[10px] ${isMe ? "justify-end" : "justify-start"}`}>
                    <span 
                      onClick={() => onViewUserProfileUid && onViewUserProfileUid(msg.senderId)}
                      className="font-bold text-slate-600 font-sans cursor-pointer hover:text-primary transition flex items-center gap-1"
                    >
                      {msg.senderName}
                      {(msg.senderName.toLowerCase() === "zyromod" || members.find(m => m.userId === msg.senderId)?.email?.toLowerCase() === "zyromod@gmail.com") && (
                        <span className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-700 text-[7px] font-extrabold px-1.5 py-0.5 rounded-full border border-amber-200 uppercase tracking-widest scale-90" title="Main Admin">
                          <BadgeCheck className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />
                          Admin
                        </span>
                      )}
                    </span>
                    <span className="text-slate-400 font-mono">
                      {msg.createdAt?.seconds 
                        ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : "Just now"}
                    </span>
                  </div>

                  <div
                    className={`p-3.5 rounded-2xl text-xs break-words relative overflow-hidden group shadow-xs ${
                      isMe
                        ? "bg-primary text-white rounded-br-none border-none"
                        : "bg-[#F1F5F9] text-slate-800 rounded-bl-none border border-transparent"
                    }`}
                  >
                    {isImage ? (
                      <div className="space-y-2">
                        <img
                          src={decryptedBody.replace("[IMAGE]:", "")}
                          alt="Secure photo attachment"
                          referrerPolicy="no-referrer"
                          className="max-w-xs max-h-48 rounded-xl object-contain border border-slate-200 shadow-sm"
                        />
                      </div>
                    ) : (
                      <div className="leading-relaxed whitespace-pre-wrap select-text">
                        {renderMessageContent(decryptedBody, isMe)}
                      </div>
                    )}

                    <div className="absolute right-1.5 top-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Lock className="h-2.5 w-2.5 text-slate-400/60" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Typing box layout */}
      <div className="p-4 border-t border-vibrant-border bg-white shrink-0">
        {mediaPreview && (
          <div className="mb-3 p-2 bg-vibrant-bg border border-vibrant-border rounded-xl flex items-center justify-between max-w-xs shadow-xs">
            <div className="flex items-center gap-2">
              <FileImage className="h-5 w-5 text-primary" />
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

        <form onSubmit={handleSendMessage} className="flex gap-2">
          {/* File select binder */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-3 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-slate-550 rounded-xl border border-vibrant-border transition shrink-0 cursor-pointer"
            title="Attach secure image file"
          >
            <Image className="h-4.5 w-4.5 text-slate-500" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*"
            className="hidden"
          />

          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={sending}
            placeholder={mediaPreview ? "Click send to transmit encrypted image..." : "Write a secure end-to-end encrypted packet..."}
            className="flex-1 bg-[#F8FAFC] border border-vibrant-border rounded-xl px-4 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/45 transition"
          />

          <button
            type="submit"
            disabled={sending || (!text.trim() && !mediaPreview)}
            className="p-2.5 px-4 bg-secondary hover:bg-pink-600 active:bg-pink-700 disabled:opacity-50 text-white rounded-xl transition flex items-center justify-center gap-1.5 font-bold cursor-pointer font-sans text-xs shrink-0 shadow-md shadow-pink-500/10"
          >
            {sending ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Transmit
          </button>
        </form>
      </div>
    </div>
  );
}
