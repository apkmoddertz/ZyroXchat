export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  publicKey: string; // JWK string
  createdAt: any; // ServerTimestamp
}

export interface Channel {
  id: string; // e.g., auto-ID or direct DM key
  name: string; // "General", "Dev Talk", or direct user's name
  type: "group" | "dm";
  createdBy: string;
  createdAt: any;
  updatedAt: any;
  latestMessageText?: string; // encrypted or "[Encrypted Message]" placeholder
  latestMessageSender?: string;
  latestMessageAt?: any;
  avatarUrl?: string;
  isSecret?: boolean;
  pinned?: boolean;
  unreadCount?: number;
}

export interface ChannelMember {
  userId: string;
  displayName: string;
  email: string;
  photoURL: string;
  publicKey: string;
  joinedAt: any;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderPhotoURL: string;
  encryptedContent: string; // Cipher text
  iv: string; // Initialization vector
  recipientKeys: { [userId: string]: string }; // Map of recipientId -> RSA-encrypted AES key
  isEncrypted: boolean;
  createdAt: any;
}

export interface LocalDeviceKeys {
  publicKeyJwk: string;
  privateKeyJwk: string;
}

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}
