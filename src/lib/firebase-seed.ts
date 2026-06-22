import { writeBatch, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export async function seedTelegramChats(
  userId: string,
  userDisplayName: string,
  userEmail: string,
  userPhotoUrl: string
) {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;

    const userData = userSnap.data();
    if (userData.seededTelegram) {
      console.log("User already seeded with Telegram channels.");
      return;
    }

    console.log("Seeding authentic Telegram-styled chats for user", userId);
    const batch = writeBatch(db);
    const now = new Date();

    const seededChannels = [
      {
        id: `seed-dm-alicia-${userId}`,
        name: "Alicia Torreaux",
        type: "dm" as const,
        avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80",
        latestMessageText: "Bob says hi.",
        latestMessageSender: "Alicia Torreaux",
        pinned: true,
        messages: [
          {
            id: `msg-alicia1-${userId}`,
            senderId: "alicia",
            senderName: "Alicia Torreaux",
            senderPhotoURL: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80",
            content: "Hey there! How has your week been?",
            offsetMin: -15,
          },
          {
            id: `msg-alicia2-${userId}`,
            senderId: userId,
            senderName: userDisplayName,
            senderPhotoURL: userPhotoUrl,
            content: "It's been great! Busy with work, but good. How about yours?",
            offsetMin: -10,
          },
          {
            id: `msg-alicia3-${userId}`,
            senderId: "alicia",
            senderName: "Alicia Torreaux",
            senderPhotoURL: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80",
            content: "Not too bad! Bob says hi.",
            offsetMin: -2,
          }
        ]
      },
      {
        id: `seed-dm-roberto-${userId}`,
        name: "Roberto",
        type: "dm" as const,
        avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80",
        latestMessageText: "Say hello to Alice.",
        latestMessageSender: "Roberto",
        unreadCount: 1,
        messages: [
          {
            id: `msg-roberto1-${userId}`,
            senderId: "roberto",
            senderName: "Roberto",
            senderPhotoURL: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80",
            content: "Hey mate, did you finish that design layout?",
            offsetMin: -30,
          },
          {
            id: `msg-roberto2-${userId}`,
            senderId: userId,
            senderName: userDisplayName,
            senderPhotoURL: userPhotoUrl,
            content: "Almost done, just refining some styling.",
            offsetMin: -20,
          },
          {
            id: `msg-roberto3-${userId}`,
            senderId: "roberto",
            senderName: "Roberto",
            senderPhotoURL: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80",
            content: "Great. Say hello to Alice.",
            offsetMin: -1,
          }
        ]
      },
      {
        id: `seed-group-nomads-${userId}`,
        name: "Digital Nomads",
        type: "group" as const,
        avatarUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=150&h=150&q=80",
        latestMessageText: "We just reached 2,500 members! WOO!",
        latestMessageSender: "Jennie",
        messages: [
          {
            id: `msg-nomads1-${userId}`,
            senderId: "mark",
            senderName: "Mark",
            senderPhotoURL: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&h=150&q=80",
            content: "Hey nomads, what's reference city to live in July?",
            offsetMin: -60,
          },
          {
            id: `msg-nomads2-${userId}`,
            senderId: "clara",
            senderName: "Clara",
            senderPhotoURL: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&h=150&q=80",
            content: "Chiang Mai is beautiful but very warm. Lisbon is amazing!",
            offsetMin: -45,
          },
          {
            id: `msg-nomads3-${userId}`,
            senderId: "jennie",
            senderName: "Jennie",
            senderPhotoURL: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80",
            content: "We just reached 2,500 members! WOO!",
            offsetMin: -5,
          }
        ]
      },
      {
        id: `seed-dm-veronica-${userId}`,
        name: "Veronica",
        type: "dm" as const,
        avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150&q=80",
        latestMessageText: "Table for four, 2 PM. Be there.",
        latestMessageSender: "Veronica",
        unreadCount: 1,
        messages: [
          {
            id: `msg-veronica1-${userId}`,
            senderId: "veronica",
            senderName: "Veronica",
            senderPhotoURL: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150&q=80",
            content: "Hey, are you joining the team lunch today?",
            offsetMin: -120,
          },
          {
            id: `msg-veronica2-${userId}`,
            senderId: userId,
            senderName: userDisplayName,
            senderPhotoURL: userPhotoUrl,
            content: "Yes, absolutely! Where are we going?",
            offsetMin: -110,
          },
          {
            id: `msg-veronica3-${userId}`,
            senderId: "veronica",
            senderName: "Veronica",
            senderPhotoURL: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150&q=80",
            content: "Table for four, 2 PM. Be there.",
            offsetMin: -90,
          }
        ]
      },
      {
        id: `seed-group-animals-${userId}`,
        name: "Animal Videos",
        type: "group" as const,
        avatarUrl: "https://images.unsplash.com/photo-1534361960057-19889db9621e?auto=format&fit=crop&w=150&h=150&q=80",
        latestMessageText: "Vote now! Moar cat videos in this channel?",
        latestMessageSender: "Animal Videos",
        messages: [
          {
            id: `msg-animals1-${userId}`,
            senderId: "admin",
            senderName: "Admin",
            senderPhotoURL: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&h=150&q=80",
            content: "Check out this funny dog reaction!",
            offsetMin: -240,
          },
          {
            id: `msg-animals2-${userId}`,
            senderId: "clara",
            senderName: "Clara",
            senderPhotoURL: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&h=150&q=80",
            content: "So adorable!",
            offsetMin: -230,
          },
          {
            id: `msg-animals3-${userId}`,
            senderId: "animals",
            senderName: "Animal Videos",
            senderPhotoURL: "https://images.unsplash.com/photo-1534361960057-19889db9621e?auto=format&fit=crop&w=150&h=150&q=80",
            content: "Vote now! Moar cat videos in this channel?",
            offsetMin: -200,
          }
        ]
      },
      {
        id: `seed-dm-sister-${userId}`,
        name: "Little Sister",
        type: "dm" as const,
        isSecret: true,
        avatarUrl: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=150&h=150&q=80",
        latestMessageText: "Don't tell mom yet, but I got the job! I'm going to ROME!",
        latestMessageSender: "Little Sister",
        messages: [
          {
            id: `msg-sister1-${userId}`,
            senderId: "sister",
            senderName: "Little Sister",
            senderPhotoURL: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=150&h=150&q=80",
            content: "Omg guess what?!",
            offsetMin: -360,
          },
          {
            id: `msg-sister2-${userId}`,
            senderId: userId,
            senderName: userDisplayName,
            senderPhotoURL: userPhotoUrl,
            content: "What is it? Did you hear back from the company?",
            offsetMin: -350,
          },
          {
            id: `msg-sister3-${userId}`,
            senderId: "sister",
            senderName: "Little Sister",
            senderPhotoURL: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=150&h=150&q=80",
            content: "Don't tell mom yet, but I got the job! I'm going to ROME!",
            offsetMin: -320,
          }
        ]
      }
    ];

    for (const s of seededChannels) {
      // 1. Channel document
      const channelRef = doc(db, "channels", s.id);
      
      // Calculate realistic timing
      const latestMsgOffset = s.messages[s.messages.length - 1].offsetMin;
      const latestDate = new Date(now.getTime() + latestMsgOffset * 60 * 1000);

      batch.set(channelRef, {
        id: s.id,
        name: s.name,
        type: s.type,
        createdBy: "System",
        createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Created yesterday
        updatedAt: latestDate,
        latestMessageText: s.latestMessageText,
        latestMessageSender: s.latestMessageSender,
        latestMessageAt: latestDate,
        avatarUrl: s.avatarUrl,
        isSecret: s.isSecret || false,
        pinned: s.pinned || false,
        unreadCount: s.unreadCount || 0
      });

      // 2. Add current logged in user as member of channel so it queries correctly
      const memberRef = doc(db, "channels", s.id, "members", userId);
      batch.set(memberRef, {
        userId,
        displayName: userDisplayName || "User",
        email: userEmail || "",
        photoURL: userPhotoUrl || "",
        publicKey: "cleartext-public",
        joinedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000)
      });

      // 3. For DMs and Groups, add the virtual sender as a member too!
      const virtualSenderId = s.messages[0].senderId;
      if (virtualSenderId !== userId) {
        const otherMemberRef = doc(db, "channels", s.id, "members", virtualSenderId);
        batch.set(otherMemberRef, {
          userId: virtualSenderId,
          displayName: s.name,
          email: `${virtualSenderId}@example.com`,
          photoURL: s.avatarUrl,
          publicKey: "cleartext-public",
          joinedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000)
        });
      }

      // 4. Create historic messages formatted with recipientKeys for user
      s.messages.forEach((msg) => {
        const msgRef = doc(db, "channels", s.id, "messages", msg.id);
        const msgDate = new Date(now.getTime() + msg.offsetMin * 60 * 1000);
        
        batch.set(msgRef, {
          id: msg.id,
          senderId: msg.senderId,
          senderName: msg.senderName,
          senderPhotoURL: msg.senderPhotoURL,
          encryptedContent: msg.content,
          iv: "cleartext-iv",
          recipientKeys: {
            [userId]: "cleartext-share",
            ...(virtualSenderId !== userId ? { [virtualSenderId]: "cleartext-share" } : {})
          },
          isEncrypted: false,
          createdAt: msgDate
        });
      });
    }

    // Mark user schema as seeded so we don't repeat
    batch.update(userRef, {
      seededTelegram: true
    });

    await batch.commit();
    console.log("Database seeded successfully with beautiful Telegram demo chats.");
  } catch (err) {
    console.error("Failed to seed database:", err);
  }
}
