// WebSocket Configuration
export const WS_URL = 'ws://192.168.1.8:8080';
export const WS_RECONNECT_DELAY = 3000;
export const WS_MAX_RECONNECT_ATTEMPTS = 5;

// File Upload
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_FILE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/zip'
];

// Message Configuration
export const MAX_MESSAGE_LENGTH = 2000;
export const MESSAGE_LOAD_LIMIT = 50;
export const TYPING_INDICATOR_TIMEOUT = 3000;

// Emoji Quick Reactions
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// Time Formats
export const DATE_FORMAT = {
    TIME: { hour: '2-digit', minute: '2-digit' } as Intl.DateTimeFormatOptions,
    DATE: { month: 'short', day: 'numeric' } as Intl.DateTimeFormatOptions,
    WEEKDAY: { weekday: 'long' } as Intl.DateTimeFormatOptions,
    FULL: {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    } as Intl.DateTimeFormatOptions
};

// UI Constants
export const SIDEBAR_WIDTH = 280;
export const HEADER_HEIGHT = 64;
export const MESSAGE_INPUT_HEIGHT = 70;
export const EMOJI_PICKER_WIDTH = 320;
export const EMOJI_PICKER_HEIGHT = 400;

// Search
export const SEARCH_DEBOUNCE_MS = 300;
export const SEARCH_RESULTS_LIMIT = 20;

// Voice Recording
export const MAX_VOICE_DURATION = 5 * 60; // 5 minutes in seconds
export const VOICE_SAMPLE_RATE = 44100;

// Notification
export const NOTIFICATION_AUTO_CLOSE_MS = 5000;

// Theme
export const THEME_STORAGE_KEY = 'chatbox-theme';
export const THEMES = ['dark', 'light'] as const;
