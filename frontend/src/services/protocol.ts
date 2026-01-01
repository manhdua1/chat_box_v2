// ============================================================================
// CHATBOX1 PROTOCOL - TypeScript Version (JSON Only)
// Synced with: backend/server/include/protocol_chatbox1.h
// Version: 1.0
// Port: 8080
// ============================================================================

// Auto-detect WebSocket URL based on current page URL
const getWebSocketUrl = (): string => {
    const { protocol, hostname } = window.location;
    
    if (hostname.includes('devtunnels.ms')) {
        const wsHost = hostname.replace(/-\d+\./, '-8080.');
        return `wss://${wsHost}`;
    }
    
    const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${hostname}:8080`;
};

// Constants & Limits
export const WS_URL = getWebSocketUrl();
export const PROTOCOL_VERSION = 1;
export const DEFAULT_PORT = 8080;
export const MAX_MESSAGE_LEN = 4096;
export const MAX_FILENAME_LEN = 256;
export const MAX_ROOM_NAME_LEN = 128;
export const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB max

// ============================================================================
// MESSAGE TYPES (matching backend JSON protocol)
// ============================================================================

export enum MessageType {
    // ===== AUTHENTICATION (1-19) =====
    MSG_REGISTER_REQUEST = 1,
    MSG_REGISTER_RESPONSE = 2,
    MSG_LOGIN_REQUEST = 3,
    MSG_LOGIN_RESPONSE = 4,
    MSG_LOGOUT = 5,
    MSG_HEARTBEAT = 6,
    MSG_SESSION_EXPIRED = 7,
    MSG_2FA_CHALLENGE = 8,
    MSG_2FA_RESPONSE = 9,

    // ===== PUB/SUB CORE (20-39) =====
    MSG_SUBSCRIBE = 20,
    MSG_UNSUBSCRIBE = 21,
    MSG_PUBLISH = 22,
    MSG_SUB_ACK = 23,
    MSG_UNSUB_ACK = 24,
    MSG_PUBLISH_ACK = 25,

    // ===== CHAT MESSAGES (40-69) =====
    MSG_CHAT_TEXT = 40,
    MSG_CHAT_IMAGE = 41,
    MSG_CHAT_VIDEO = 42,
    MSG_CHAT_AUDIO = 43,
    MSG_CHAT_FILE = 44,
    MSG_CHAT_STICKER = 45,
    MSG_CHAT_LOCATION = 46,
    MSG_CHAT_CONTACT = 47,
    MSG_EDIT_MESSAGE = 48,
    MSG_DELETE_MESSAGE = 49,
    MSG_REPLY_MESSAGE = 50,
    MSG_FORWARD_MESSAGE = 51,
    MSG_TYPING_START = 52,
    MSG_TYPING_STOP = 53,
    MSG_MESSAGE_READ = 54,
    MSG_MESSAGE_DELIVERED = 55,

    // ===== ROOMS/GROUPS (70-89) =====
    MSG_CREATE_ROOM = 70,
    MSG_JOIN_ROOM = 71,
    MSG_LEAVE_ROOM = 72,
    MSG_INVITE_USER = 73,
    MSG_KICK_USER = 74,
    MSG_ROOM_INFO_REQUEST = 75,
    MSG_ROOM_INFO_RESPONSE = 76,
    MSG_UPDATE_ROOM_SETTINGS = 77,
    MSG_PIN_MESSAGE = 78,
    MSG_UNPIN_MESSAGE = 79,

    // ===== REACTIONS (90-99) =====
    MSG_ADD_REACTION = 90,
    MSG_REMOVE_REACTION = 91,
    MSG_REACTION_UPDATE = 92,

    // ===== FILE TRANSFER (100-119) =====
    MSG_FILE_INIT = 100,
    MSG_FILE_CHUNK = 101,
    MSG_FILE_COMPLETE = 102,
    MSG_FILE_ERROR = 103,
    MSG_FILE_REQUEST = 104,
    MSG_FILE_CANCEL = 105,
    MSG_FILE_PROGRESS = 106,

    // ===== VOICE/VIDEO CALLS - WebRTC Signaling (120-139) =====
    MSG_CALL_INIT = 120,
    MSG_CALL_OFFER = 121,
    MSG_CALL_ANSWER = 122,
    MSG_CALL_ICE_CANDIDATE = 123,
    MSG_CALL_ACCEPT = 124,
    MSG_CALL_REJECT = 125,
    MSG_CALL_HANGUP = 126,
    MSG_CALL_MUTE_AUDIO = 127,
    MSG_CALL_UNMUTE_AUDIO = 128,
    MSG_CALL_MUTE_VIDEO = 129,
    MSG_CALL_UNMUTE_VIDEO = 130,

    // ===== GAMES (140-159) =====
    MSG_GAME_INVITE = 140,
    MSG_GAME_ACCEPT = 141,
    MSG_GAME_REJECT = 142,
    MSG_GAME_MOVE = 143,
    MSG_GAME_STATE = 144,
    MSG_GAME_END = 145,
    MSG_GAME_FORFEIT = 146,

    // ===== WATCH TOGETHER (160-179) =====
    MSG_WATCH_CREATE = 160,
    MSG_WATCH_JOIN = 161,
    MSG_WATCH_LEAVE = 162,
    MSG_WATCH_PLAY = 163,
    MSG_WATCH_PAUSE = 164,
    MSG_WATCH_SEEK = 165,
    MSG_WATCH_SYNC = 166,
    MSG_WATCH_END = 167,

    // ===== POLLS (180-189) =====
    MSG_POLL_CREATE = 180,
    MSG_POLL_VOTE = 181,
    MSG_POLL_CLOSE = 182,
    MSG_POLL_RESULT = 183,

    // ===== WORKFLOWS (190-199) =====
    MSG_WORKFLOW_CREATE = 190,
    MSG_WORKFLOW_UPDATE = 191,
    MSG_WORKFLOW_DELETE = 192,
    MSG_WORKFLOW_TRIGGER = 193,
    MSG_WORKFLOW_EXECUTE = 194,

    // ===== AI BOT (200-219) =====
    MSG_AI_REQUEST = 200,
    MSG_AI_RESPONSE = 201,
    MSG_AI_TYPING = 202,
    MSG_AI_ERROR = 203,

    // ===== PRESENCE (220-229) =====
    MSG_PRESENCE_UPDATE = 220,
    MSG_PRESENCE_REQUEST = 221,
    MSG_PRESENCE_RESPONSE = 222,

    // ===== USER MANAGEMENT (230-249) =====
    MSG_USER_PROFILE_REQUEST = 230,
    MSG_USER_PROFILE_RESPONSE = 231,
    MSG_USER_PROFILE_UPDATE = 232,
    MSG_USER_SEARCH = 233,
    MSG_USER_BLOCK = 234,
    MSG_USER_UNBLOCK = 235,

    // ===== SYSTEM (250-255) =====
    MSG_ERROR = 250,
    MSG_ACK = 251,
    MSG_NACK = 252,
    MSG_PING = 253,
    MSG_PONG = 254
}

// ============================================================================
// ENUMS
// ============================================================================

export enum UserStatus {
    STATUS_OFFLINE = 0,
    STATUS_ONLINE = 1,
    STATUS_AWAY = 2,
    STATUS_DND = 3,      // Do Not Disturb
    STATUS_INVISIBLE = 4
}

export enum RoomType {
    ROOM_PRIVATE = 0,   // 1-1 chat
    ROOM_GROUP = 1,     // Group chat
    ROOM_CHANNEL = 2    // Broadcast channel
}

export enum FileType {
    FILE_IMAGE = 0,
    FILE_VIDEO = 1,
    FILE_AUDIO = 2,
    FILE_DOCUMENT = 3,
    FILE_ARCHIVE = 4,
    FILE_OTHER = 5
}

export enum GameType {
    GAME_TIC_TAC_TOE = 0,
    GAME_CHESS = 1,
    GAME_CHECKERS = 2
}

// ============================================================================
// BACKWARD COMPATIBILITY ALIASES
// ============================================================================

// Auth aliases (for existing frontend code)
export const MSG_AUTH_LOGIN = MessageType.MSG_LOGIN_REQUEST;
export const MSG_AUTH_LOGIN_RESPONSE = MessageType.MSG_LOGIN_RESPONSE;
export const MSG_AUTH_REGISTER = MessageType.MSG_REGISTER_REQUEST;
export const MSG_AUTH_REGISTER_RESPONSE = MessageType.MSG_REGISTER_RESPONSE;
export const MSG_AUTH_LOGOUT = MessageType.MSG_LOGOUT;

// Chat aliases
export const MSG_CHAT_TYPING = MessageType.MSG_TYPING_START;

// Room aliases
export const MSG_ROOM_CREATE = MessageType.MSG_CREATE_ROOM;
export const MSG_ROOM_JOIN = MessageType.MSG_JOIN_ROOM;
export const MSG_ROOM_LEAVE = MessageType.MSG_LEAVE_ROOM;

// File aliases
export const MSG_FILE_UPLOAD = MessageType.MSG_FILE_INIT;
