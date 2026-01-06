// Message type definitions
export interface MessageMetadata {
    type?: 'file' | 'image' | 'voice';
    url?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    duration?: number; // for voice messages
}

export interface Message {
    id: string;
    content: string;
    senderId: string;
    senderName: string;
    timestamp: number;
    type?: string;
    metadata?: MessageMetadata;
    reactions?: Reaction[];
    isEdited?: boolean;
    isDeleted?: boolean;
    isPinned?: boolean;
    replyTo?: string;
    replyToContent?: string;
    replyToSender?: string;
}

export interface Reaction {
    emoji: string;
    userId: string;
    username: string;
}

export interface Room {
    id: string;
    name: string;
    lastMessage?: string;
    unreadCount?: number;
}

export interface User {
    id: string;
    username: string;
    avatar?: string;
    online: boolean;
    role?: string;
    status?: 'online' | 'away' | 'dnd' | 'invisible';
}

export interface TypingUser {
    id: string;
    username: string;
    roomId: string;
}

export interface FilePreview {
    file: File;
    url: string;
}
