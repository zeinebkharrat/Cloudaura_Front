export interface ConversationResponse {
  chatRoomId: number;
  otherUserId: number;
  otherUsername: string;
  otherUserImage: string | null;
  lastMessage: string | null;
  lastMessageTime: string | null;
  unreadCount: number;
}

export interface MessageResponse {
  messageId: number;
  chatRoomId: number;
  senderId: number | null;
  senderUsername: string;
  senderImage: string | null;
  content: string;
  encryptedKey?: string | null;
  iv?: string | null;
  messageType?: string | null;
  voiceUrl?: string | null;
  voiceDurationSec?: number | null;
  sentAt: string;
}

export interface SendMessageRequest {
  chatRoomId: number;
  receiverId: number;
  encryptedMessage?: string;
  encryptedKey?: string;
  iv?: string;
  content?: string;
}

export interface E2eePublicKeyResponse {
  userId: number;
  publicKey: string | null;
}

export interface TypingEvent {
  chatRoomId: number;
  userId: number;
  username: string;
  typing: boolean;
}

export interface UserStatusEvent {
  userId: number;
  online: boolean;
}

export interface ChatRoomResponse {
  chatRoomId: number;
  name: string;
  createdAt: string;
}
