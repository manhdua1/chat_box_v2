import { useState, useEffect, useCallback, useRef } from 'react';
import { useCallStore } from '@/stores/callStore';

// Helper function to check Tic Tac Toe winner
function checkWinner(board: string[]): string | null {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6]             // Diagonals
    ];
    
    for (const [a, b, c] of lines) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return null;
}

// Auto-detect WebSocket URL based on current page URL
// Supports: localhost, LAN IP, VS Code Port Forwarding (devtunnels)
const getWebSocketUrl = (): string => {
    const { protocol, hostname } = window.location;
    
    // VS Code Port Forwarding: hostname contains devtunnels.ms
    if (hostname.includes('devtunnels.ms')) {
        // Convert: xxx-5173.xxx.devtunnels.ms -> xxx-8080.xxx.devtunnels.ms
        const wsHost = hostname.replace(/-\d+\./, '-8080.');
        return `wss://${wsHost}`;
    }
    
    // Local/LAN: use same host with port 8080
    const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${hostname}:8080`;
};

const WS_URL = getWebSocketUrl();

interface Message {
    id: string;
    content: string;
    senderId: string;
    senderName: string;
    timestamp: number;
    roomId: string;
    type?: string;
    isPinned?: boolean;
    poll?: Poll;
    game?: GameState;
    metadata?: {
        type?: 'file' | 'image' | 'voice';
        url?: string;
        fileName?: string;
        fileSize?: number;
        mimeType?: string;
    };
}

interface Room {
    id: string;
    name: string;
    lastMessage?: string;
    unreadCount?: number;
}

interface User {
    id: string;
    username: string;
    avatar?: string;
    online: boolean;
    role?: string;
    status?: 'online' | 'away' | 'dnd' | 'invisible';
}

interface PollOption {
    id: string;
    text: string;
    votes: number;
    voters: string[];
}

interface Poll {
    id: string;
    question: string;
    options: PollOption[];
    createdBy: string;
    createdAt: number;
    isClosed: boolean;
}

interface GameState {
    id: string;
    type: 'tictactoe' | 'chess';
    board: any[];
    currentTurn: string;
    players: { X: string; O: string };
    winner: string | null;
    status: 'waiting' | 'playing' | 'finished';
}

interface TypingUser {
    id: string;
    username: string;
    roomId: string;
}

interface AIMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

export function useWebSocket() {
    const [connected, setConnected] = useState(false);
    const [messages, setMessages] = useState<Record<string, Message[]>>({});
    const [rooms, setRooms] = useState<Room[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [currentRoomId, setCurrentRoomId] = useState<string>('');
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
    const handleMessageRef = useRef<(data: any) => void>(() => {});

    // New feature states
    const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
    const [polls, setPolls] = useState<Record<string, Poll>>({});
    const [activeGames, setActiveGames] = useState<Record<string, GameState>>({});
    const [watchSession, setWatchSession] = useState<{ active: boolean; videoUrl?: string; viewerCount?: number }>({ active: false });
    const [myPresence, setMyPresence] = useState<'online' | 'away' | 'dnd' | 'invisible'>('online');
    const [profileUpdate, setProfileUpdate] = useState<{ userId: string; displayName?: string; statusMessage?: string; avatar?: string } | null>(null);
    const [roomMembers, setRoomMembers] = useState<Record<string, any[]>>({});  // roomId -> members array

    // AI Chat state
    const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
    const [aiLoading, setAiLoading] = useState(false);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;
        
        // Expose WebSocket globally for components that need direct access
        (window as any).__chatbox_ws = ws;

        ws.onopen = () => {
            console.log('WebSocket connected');
            setConnected(true);

            // Auth if token exists
            const token = localStorage.getItem('token');
            if (token) {
                ws.send(JSON.stringify({
                    type: 'auth',
                    token
                }));
            }
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('🔔 WebSocket message received:', data.type, data);
                handleMessageRef.current(data);
            } catch (error) {
                console.error('Failed to parse message:', error);
            }
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected');
            setConnected(false);

            // Reconnect after 3 seconds
            reconnectTimeoutRef.current = setTimeout(connect, 3000);
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }, []);

    const handleMessage = useCallback((data: any) => {
        switch (data.type) {
            case 'auth_success':
                console.log('Authenticated');
                break;

            case 'chat':
                console.log('📩 Received chat message:', data);
                console.log('📩 Chat roomId:', data.roomId, 'content:', data.content);
                // Debug: show alert for DM
                if (data.roomId?.startsWith('dm_')) {
                    console.log('🔔 DM RECEIVED!', data.content);
                }
                setMessages(prev => {
                    console.log('📊 Previous messages for room', data.roomId, ':', prev[data.roomId]?.length || 0);
                    const roomMessages = prev[data.roomId] || [];
                    // Check if message already exists (prevent duplicates)
                    const messageExists = roomMessages.some(m => 
                        m.id === data.messageId || 
                        (m.content === data.content && m.senderId === data.userId && Math.abs(m.timestamp - (data.timestamp || Date.now())) < 1000)
                    );
                    if (messageExists) {
                        console.log('📊 Duplicate message ignored:', data.messageId);
                        return prev;
                    }
                    const newMessages = {
                        ...prev,
                        [data.roomId]: [...roomMessages, {
                            id: data.messageId || Date.now().toString(),
                            content: data.content,
                            senderId: data.userId,
                            senderName: data.username,
                            timestamp: data.timestamp || Date.now(),
                            roomId: data.roomId,
                            isPinned: data.isPinned || false,
                            metadata: data.metadata // Include file attachment metadata
                        }]
                    };
                    console.log('📊 setMessages - new state:', newMessages);
                    console.log('📊 Messages for room', data.roomId, ':', (newMessages as Record<string, any>)[data.roomId as string]);
                    return newMessages;
                });
                break;

            case 'room_list':
                setRooms(data.rooms || []);
                break;

            case 'user_list':
                setUsers(data.users || []);
                break;

            case 'online_users':
                // Handle online users from server
                console.log('👥 Received online users:', data.users);
                setUsers(prev => {
                    const onlineUserIds = new Set((data.users || []).map((u: any) => u.userId));
                    // Update existing users or add new ones
                    const updatedUsers = prev.map(u => ({
                        ...u,
                        online: onlineUserIds.has(u.id)
                    }));
                    // Add new users not in the list
                    const existingIds = new Set(prev.map(u => u.id));
                    const newUsers = (data.users || [])
                        .filter((u: any) => !existingIds.has(u.userId))
                        .map((u: any) => ({
                            id: u.userId,
                            username: u.username,
                            online: true
                        }));
                    return [...updatedUsers, ...newUsers];
                });
                break;

            case 'user_joined':
                setUsers(prev => [...prev.filter(u => u.id !== data.userId), {
                    id: data.userId,
                    username: data.username,
                    online: true
                }]);
                break;

            case 'user_left':
                setUsers(prev => prev.map(u =>
                    u.id === data.userId ? { ...u, online: false } : u
                ));
                break;

            case 'history':
                setMessages(prev => ({
                    ...prev,
                    [data.roomId]: (data.messages || []).map((m: any) => ({
                        id: m.messageId,
                        content: m.content,
                        senderId: m.userId,
                        senderName: m.username,
                        timestamp: m.timestamp,
                        roomId: m.roomId,
                        metadata: m.metadata // Include file attachment metadata
                    }))
                }));
                break;

            case 'message_edited':
                setMessages(prev => {
                    const newMessages = { ...prev };
                    for (const roomId in newMessages) {
                        newMessages[roomId] = newMessages[roomId].map(m =>
                            m.id === data.messageId
                                ? { ...m, content: data.newContent, isEdited: true }
                                : m
                        );
                    }
                    return newMessages;
                });
                break;

            case 'message_deleted':
                setMessages(prev => {
                    const newMessages = { ...prev };
                    for (const roomId in newMessages) {
                        newMessages[roomId] = newMessages[roomId].map(m =>
                            m.id === data.messageId
                                ? { ...m, isDeleted: true }
                                : m
                        );
                    }
                    return newMessages;
                });
                break;

            case 'message_pinned':
                setMessages(prev => {
                    const newMessages = { ...prev };
                    const roomId = data.roomId;
                    if (newMessages[roomId]) {
                        newMessages[roomId] = newMessages[roomId].map(m =>
                            m.id === data.messageId
                                ? { ...m, isPinned: true }
                                : m
                        );
                    }
                    return newMessages;
                });
                break;

            case 'message_unpinned':
                setMessages(prev => {
                    const newMessages = { ...prev };
                    const roomId = data.roomId;
                    if (newMessages[roomId]) {
                        newMessages[roomId] = newMessages[roomId].map(m =>
                            m.id === data.messageId
                                ? { ...m, isPinned: false }
                                : m
                        );
                    }
                    return newMessages;
                });
                break;

            case 'reaction_added':
                setMessages(prev => {
                    const newMessages = { ...prev };
                    for (const roomId in newMessages) {
                        newMessages[roomId] = newMessages[roomId].map(m => {
                            if (m.id === data.messageId) {
                                const reactions = (m as any).reactions || [];
                                return {
                                    ...m,
                                    reactions: [...reactions, {
                                        emoji: data.emoji,
                                        userId: data.userId,
                                        username: data.username
                                    }]
                                };
                            }
                            return m;
                        });
                    }
                    return newMessages;
                });
                break;

            case 'error':
                console.error('Server error:', data.message || data.error);
                break;

            case 'join_success':
            case 'leave_success':
                // Room join/leave acknowledged, no action needed
                break;

            case 'room_created':
                console.log('✅ Room created:', data);
                // Add new room to list
                const newRoom = {
                    id: data.roomId,
                    name: data.roomName,
                    type: data.roomType || 'public'
                };
                setRooms(prev => {
                    // Check if room already exists
                    if (prev.find(r => r.id === newRoom.id)) {
                        return prev;
                    }
                    return [...prev, newRoom];
                });
                // Auto-join the newly created room
                joinRoom(data.roomId);
                setCurrentRoomId(data.roomId);
                break;

            case 'room_joined':
                console.log('✅ Joined room:', data.roomId, 'with history:', data.history?.length || 0, 'polls:', data.polls?.length || 0);
                console.log('📜 History data:', JSON.stringify(data.history?.slice(0, 2)));
                // Load history from room_joined response
                if (data.history && Array.isArray(data.history)) {
                    const mappedMessages = data.history.map((m: any) => ({
                        id: m.messageId,
                        content: m.content,
                        senderId: m.userId,
                        senderName: m.username,
                        timestamp: m.timestamp,
                        roomId: data.roomId,
                        metadata: m.metadata
                    }));
                    console.log('📜 Mapped messages:', mappedMessages.length, mappedMessages.slice(0, 2));
                    setMessages(prev => {
                        const newState: Record<string, Message[]> = {
                            ...prev,
                            [data.roomId]: mappedMessages
                        };
                        console.log('📜 New messages state:', Object.keys(newState), newState[data.roomId]?.length);
                        return newState;
                    });
                }
                // Load room members
                if (data.members && Array.isArray(data.members)) {
                    console.log('👥 Loading room members:', data.members.length, 'for room:', data.roomId);
                    setRoomMembers(prev => ({
                        ...prev,
                        [data.roomId]: data.members
                    }));
                }
                // Load polls from room_joined response
                if (data.polls && Array.isArray(data.polls)) {
                    console.log('📊 Loading polls from room_joined:', data.polls.length, 'for room:', data.roomId);
                    console.log('📊 Polls data:', JSON.stringify(data.polls));
                    setPolls(prev => {
                        const newPolls: Record<string, any> = { ...prev };
                        data.polls.forEach((poll: any) => {
                            // Ensure roomId is set correctly
                            newPolls[poll.id] = { ...poll, roomId: data.roomId };
                        });
                        console.log('📊 Updated polls state:', Object.keys(newPolls));
                        return newPolls;
                    });
                }
                break;

            // WebRTC Events
            case 'call_init_response':
                console.log('📞 Call initiated:', data);
                if (data.success && data.callId) {
                    // Store callId for caller so they can end the call
                    const store = useCallStore.getState();
                    useCallStore.setState({
                        ...store,
                        callId: data.callId
                    });
                }
                break;

            case 'call_incoming':
                console.log('📞 Incoming call:', data);
                useCallStore.getState().receiveCall(data.callId, data.callerId, data.callerName, data.callType);
                break;

            case 'call_accepted':
                console.log('✅ Call accepted:', data);
                useCallStore.getState().callAccepted(data.callId);
                window.dispatchEvent(new CustomEvent('webrtc-signal', { detail: data }));
                break;

            case 'call_rejected':
                console.log('❌ Call rejected:', data);
                useCallStore.getState().endCall();
                break;

            case 'call_ended':
                console.log('📴 Call ended:', data);
                useCallStore.getState().endCall();
                break;

            // WebRTC Signaling
            case 'webrtc_offer':
            case 'webrtc_answer':
            case 'webrtc_ice':
                window.dispatchEvent(new CustomEvent('webrtc-signal', { detail: data }));
                break;

            // Typing Indicator
            case 'typing_start':
                setTypingUsers(prev => {
                    if (prev.find(u => u.id === data.userId)) return prev;
                    return [...prev, { id: data.userId, username: data.username, roomId: data.roomId }];
                });
                break;

            case 'typing_stop':
                setTypingUsers(prev => prev.filter(u => u.id !== data.userId));
                break;

            // Polls
            case 'poll_created':
                console.log('📊 Poll created:', data);
                // Add roomId to poll for filtering
                const pollWithRoom = { ...data.poll, roomId: data.roomId };
                setPolls(prev => ({ ...prev, [data.poll.id]: pollWithRoom }));
                // NOTE: Don't add to messages - polls are displayed from polls state only
                break;

            case 'poll_vote':
                console.log('🗳️ Poll vote received:', data);
                setPolls(prev => {
                    const poll = prev[data.pollId];
                    if (!poll) {
                        console.log('⚠️ Poll not found:', data.pollId);
                        return prev;
                    }
                    const updatedOptions = poll.options.map(opt =>
                        opt.id === data.optionId
                            ? { ...opt, votes: opt.votes + 1, voters: [...(opt.voters || []), data.userId] }
                            : opt
                    );
                    const updatedPoll = { ...poll, options: updatedOptions };
                    console.log('🗳️ Updated poll:', updatedPoll);
                    return { ...prev, [data.pollId]: updatedPoll };
                });
                // Also update poll in messages
                setMessages(prev => {
                    const newMessages = { ...prev };
                    Object.keys(newMessages).forEach(roomId => {
                        newMessages[roomId] = newMessages[roomId].map(msg => {
                            if (msg.type === 'poll' && msg.poll && msg.poll.id === data.pollId) {
                                const updatedOptions = msg.poll.options.map((opt: any) =>
                                    opt.id === data.optionId
                                        ? { ...opt, votes: opt.votes + 1, voters: [...(opt.voters || []), data.userId] }
                                        : opt
                                );
                                return { ...msg, poll: { ...msg.poll, options: updatedOptions } };
                            }
                            return msg;
                        });
                    });
                    return newMessages;
                });
                break;

            // Games
            case 'game_invite':
                window.dispatchEvent(new CustomEvent('game-invite', { detail: data }));
                break;

            case 'game_start':
                setActiveGames(prev => ({ ...prev, [data.gameId]: data.game }));
                break;

            case 'game_move': {
                const { gameId, position, playerId } = data;
                setActiveGames(prev => {
                    const game = prev[gameId];
                    if (!game || game.status !== 'playing') return prev;
                    
                    // Determine symbol for current player
                    const symbol = game.players.X === playerId ? 'X' : 'O';
                    
                    // Update board
                    const newBoard = [...game.board];
                    newBoard[position] = symbol;
                    
                    // Check for winner
                    const winner = checkWinner(newBoard);
                    const isDraw = !winner && newBoard.every(cell => cell !== '');
                    
                    // Switch turn
                    const nextTurn = symbol === 'X' ? 'O' : 'X';
                    
                    const updatedGame = {
                        ...game,
                        board: newBoard,
                        currentTurn: nextTurn,
                        winner,
                        status: (winner || isDraw) ? 'finished' as const : 'playing' as const
                    };
                    
                    return { ...prev, [gameId]: updatedGame };
                });
                break;
            }

            case 'game_end':
                setActiveGames(prev => {
                    const updated = { ...prev };
                    if (updated[data.gameId]) {
                        updated[data.gameId] = { ...updated[data.gameId], status: 'finished', winner: data.winner };
                    }
                    return updated;
                });
                break;

            case 'game_rejected':
                console.log('Game invitation rejected:', data.gameId);
                // Could show notification here
                break;

            // Watch Together
            case 'watch_session_created':
            case 'watch_sync':
                setWatchSession({ active: true, videoUrl: data.videoUrl, viewerCount: data.viewerCount });
                break;

            case 'watch_ended':
                setWatchSession({ active: false });
                break;

            // Presence
            case 'presence_update':
                setUsers(prev => prev.map(u =>
                    u.id === data.userId ? { ...u, status: data.status, online: data.status !== 'invisible' } : u
                ));
                break;

            // Profile
            case 'profile_update_response':
                console.log('📝 Profile update response:', data);
                // Show notification or update UI
                break;

            case 'profile_updated':
                console.log('👤 Profile updated:', data);
                // Update user in users list
                setUsers(prev => prev.map(u =>
                    u.id === data.userId ? { 
                        ...u, 
                        username: data.displayName || u.username,
                        avatar: data.avatar || u.avatar
                    } : u
                ));
                // Notify App.tsx to update currentUser if it's the logged-in user
                setProfileUpdate({
                    userId: data.userId,
                    displayName: data.displayName,
                    statusMessage: data.statusMessage,
                    avatar: data.avatar
                });
                break;

            // Change Password
            case 'change_password_response':
                console.log('🔐 Change password response:', data);
                // Dispatch event for Sidebar to handle
                window.dispatchEvent(new CustomEvent('password-change-result', { 
                    detail: { success: data.success, message: data.message }
                }));
                break;

            // AI Chat responses
            case 'ai_response':
                setAiLoading(false);
                setAiMessages(prev => [...prev, {
                    role: 'assistant',
                    content: data.response,
                    timestamp: Date.now()
                }]);
                break;

            case 'ai_error':
                setAiLoading(false);
                setAiMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `Error: ${data.message || 'Failed to get AI response'}`,
                    timestamp: Date.now()
                }]);
                break;

            default:
                console.log('Unknown message type:', data.type, data);
        }
    }, []);

    // Keep handleMessageRef updated - MUST run before connect
    handleMessageRef.current = handleMessage;

    useEffect(() => {
        connect();

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            wsRef.current?.close();
        };
    }, [connect]);

    const send = useCallback((data: any) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        }
    }, []);

    const login = useCallback(async (username: string, password: string) => {
        return new Promise<any>((resolve) => {
            const ws = wsRef.current;
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                resolve({ success: false, error: 'Not connected' });
                return;
            }

            const handleResponse = (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'login_response') {
                        ws.removeEventListener('message', handleResponse);
                        if (data.success) {
                            resolve({
                                success: true,
                                user: { 
                                    id: data.userId, 
                                    username: data.username,
                                    avatar: data.avatar || ''
                                },
                                token: data.token
                            });
                        } else {
                            resolve({ success: false, error: data.message || 'Login failed' });
                        }
                    }
                } catch (e) { }
            };

            ws.addEventListener('message', handleResponse);

            ws.send(JSON.stringify({
                type: 'login',
                username,
                password
            }));

            // Timeout
            setTimeout(() => {
                ws.removeEventListener('message', handleResponse);
                resolve({ success: false, error: 'Timeout' });
            }, 10000);
        });
    }, []);

    const register = useCallback(async (username: string, password: string, email?: string) => {
        return new Promise<any>((resolve) => {
            const ws = wsRef.current;
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                resolve({ success: false, error: 'Not connected' });
                return;
            }

            const handleResponse = (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'register_response') {
                        ws.removeEventListener('message', handleResponse);
                        if (data.success) {
                            resolve({ success: true });
                        } else {
                            resolve({ success: false, error: data.message || 'Registration failed' });
                        }
                    }
                } catch (e) { }
            };

            ws.addEventListener('message', handleResponse);

            ws.send(JSON.stringify({
                type: 'register',
                username,
                password,
                email: email || `${username}@chatbox.local`
            }));

            setTimeout(() => {
                ws.removeEventListener('message', handleResponse);
                resolve({ success: false, error: 'Timeout' });
            }, 10000);
        });
    }, []);

    const sendMessage = useCallback((roomId: string, content: string, metadata?: any) => {
        // Use the hook's currentRoomId if available, otherwise use passed roomId
        const effectiveRoomId = currentRoomId || roomId;
        console.log('📤 sendMessage called:', { passedRoomId: roomId, currentRoomId, effectiveRoomId, content });
        
        // Parse slash commands
        if (content.startsWith('/')) {
            // Handle /poll command specially
            if (content.startsWith('/poll')) {
                console.log('🎯 Poll command detected, roomId:', effectiveRoomId);
                console.log('🎯 RAW content:', JSON.stringify(content));
                console.log('🎯 Content chars:', [...content].map(c => c.charCodeAt(0)));
                
                // Normalize all types of quotes to regular quotes
                const normalizedContent = content
                    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036""„]/g, '"')  // All smart double quotes
                    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035''‚]/g, "'")  // All smart single quotes
                    .trim();
                
                console.log('🎯 Normalized:', JSON.stringify(normalizedContent));
                
                // Try multiple formats:
                
                // Format 1: /poll "Question" "Option1" "Option2"
                const allQuoted = normalizedContent.match(/"([^"]+)"/g);
                console.log('🎯 Quoted strings found:', allQuoted);
                
                if (allQuoted && allQuoted.length >= 3) {
                    const question = allQuoted[0].replace(/"/g, '');
                    const options = allQuoted.slice(1).map(o => o.replace(/"/g, ''));
                    console.log('📊 Parsed poll (format 1):', { question, options, roomId: effectiveRoomId });
                    send({ type: 'poll_create', roomId: effectiveRoomId, question, options });
                    return;
                }
                
                // Format 2: /poll Question? | Option1 | Option2
                const pipeFormat = normalizedContent.match(/^\/poll\s+(.+?)(?:\s*\|\s*(.+))?$/);
                if (pipeFormat && pipeFormat[2]) {
                    const parts = normalizedContent.replace(/^\/poll\s+/, '').split(/\s*\|\s*/);
                    if (parts.length >= 3) {
                        const question = parts[0].trim();
                        const options = parts.slice(1).map(o => o.trim());
                        console.log('📊 Parsed poll (format 2 - pipe):', { question, options, roomId: effectiveRoomId });
                        send({ type: 'poll_create', roomId: effectiveRoomId, question, options });
                        return;
                    }
                }
                
                // Format 3: Simple - take everything after /poll as question, create Yes/No poll
                const simpleQuestion = normalizedContent.replace(/^\/poll\s+/, '').replace(/"/g, '').trim();
                if (simpleQuestion && simpleQuestion.length > 0) {
                    console.log('📊 Creating Yes/No poll for:', simpleQuestion, 'roomId:', effectiveRoomId);
                    send({ type: 'poll_create', roomId: effectiveRoomId, question: simpleQuestion, options: ['Yes', 'No'] });
                    return;
                }
                
                console.log('⚠️ Could not parse poll. Formats supported:');
                console.log('  /poll "Question?" "Option1" "Option2"');
                console.log('  /poll Question? | Option1 | Option2');
                console.log('  /poll Question? (creates Yes/No poll)');
                return;
            }
            
            // Handle /vote command
            if (content.startsWith('/vote')) {
                const voteMatch = content.match(/^\/vote\s+(\S+)\s+(\S+)$/);
                if (voteMatch) {
                    send({ type: 'poll_vote', pollId: voteMatch[1], optionId: voteMatch[2], roomId: effectiveRoomId });
                }
                // Don't send /vote as text message
                return;
            }
        }
        
        const message: any = {
            type: 'chat',
            roomId: effectiveRoomId,
            content
        };

        // Add metadata if present (for file attachments)
        if (metadata) {
            message.metadata = metadata;
            console.log('📎 Message with metadata:', message);
        }

        send(message);
    }, [send, currentRoomId]);

    const joinRoom = useCallback((roomId: string) => {
        send({
            type: 'join_room',
            roomId
        });
    }, [send]);

    const leaveRoom = useCallback((roomId: string) => {
        send({
            type: 'leave_room',
            roomId
        });
    }, [send]);

    // Delete room from local state (after leaving)
    const deleteRoom = useCallback((roomId: string) => {
        setRooms(prev => prev.filter(r => r.id !== roomId));
        // Also clear messages for that room
        setMessages(prev => {
            const updated = { ...prev };
            delete updated[roomId];
            return updated;
        });
    }, []);

    const createRoom = useCallback((name: string, roomType?: 'public' | 'private' | 'group') => {
        send({
            type: 'create_room',
            name,
            roomType: roomType || 'public'
        });
    }, [send]);

    const editMessage = useCallback((messageId: string, newContent: string) => {
        send({
            type: 'edit_message',
            messageId,
            newContent
        });
    }, [send]);

    const deleteMessage = useCallback((messageId: string) => {
        send({
            type: 'delete_message',
            messageId
        });
    }, [send]);

    const addReaction = useCallback((messageId: string, emoji: string) => {
        send({
            type: 'add_reaction',
            messageId,
            emoji,
            roomId: currentRoomId
        });
    }, [send, currentRoomId]);

    // Send typing status to current room
    const sendTypingStatus = useCallback((isTyping: boolean) => {
        send({
            type: 'typing',
            roomId: currentRoomId,
            isTyping
        });
    }, [send, currentRoomId]);

    // WebRTC Signaling
    const startCall = useCallback((targetId: string, targetName: string, type: 'audio' | 'video') => {
        console.log('📞 Starting call to:', targetId, targetName, type);
        useCallStore.getState().startCall(targetId, targetName, type);
        send({
            type: 'call_init',
            targetId,
            callType: type
        });
    }, [send]);

    const acceptIncomingCall = useCallback((callId: string, callerId: string) => {
        console.log('✅ Accepting call:', callId);
        useCallStore.getState().acceptCall();
        send({
            type: 'call_accept',
            callId,
            callerId
        });
    }, [send]);

    const rejectIncomingCall = useCallback((callId: string, callerId: string) => {
        console.log('❌ Rejecting call:', callId);
        useCallStore.getState().rejectCall();
        send({
            type: 'call_reject',
            callId,
            callerId
        });
    }, [send]);

    const endCurrentCall = useCallback((callId: string, targetId: string) => {
        console.log('📴 Ending call:', callId);
        useCallStore.getState().endCall();
        send({
            type: 'call_end',
            callId,
            targetId
        });
    }, [send]);

    const sendSignal = useCallback((targetId: string, type: string, payload: any) => {
        console.log('📤 sendSignal:', type, 'to:', targetId);
        send({
            type,
            targetId,  // Backend expects 'targetId'
            ...payload
        })
    }, [send])

    // Message Actions
    const pinMessage = useCallback((messageId: string, roomId: string) => {
        send({ type: 'pin_message', messageId, roomId });
    }, [send]);

    const unpinMessage = useCallback((messageId: string, roomId: string) => {
        send({ type: 'unpin_message', messageId, roomId });
    }, [send]);

    const replyMessage = useCallback((content: string, replyToId: string, roomId: string) => {
        send({ type: 'reply_message', content, replyToId, roomId });
    }, [send]);

    const forwardMessage = useCallback((messageId: string, targetRoomId: string) => {
        send({ type: 'forward_message', messageId, targetRoomId });
    }, [send]);

    // User Management
    const blockUser = useCallback((userId: string) => {
        send({ type: 'user_block', targetUserId: userId });
    }, [send]);

    const unblockUser = useCallback((userId: string) => {
        send({ type: 'user_unblock', targetUserId: userId });
    }, [send]);

    const kickUser = useCallback((userId: string, roomId: string) => {
        send({ type: 'kick_user', targetUserId: userId, roomId });
    }, [send]);

    // Special Message Types
    const sendSticker = useCallback((sticker: string, roomId: string) => {
        send({ type: 'chat_sticker', sticker, roomId });
    }, [send]);

    const sendLocation = useCallback((latitude: number, longitude: number, roomId: string) => {
        send({ type: 'chat_location', latitude, longitude, roomId });
    }, [send]);

    // Polls
    const createPoll = useCallback((question: string, options: string[]) => {
        console.log('📊 Creating poll in room:', currentRoomId, 'Question:', question);
        if (!currentRoomId) {
            console.error('❌ Cannot create poll: No room selected');
            return;
        }
        send({ type: 'poll_create', roomId: currentRoomId, question, options });
    }, [send, currentRoomId]);

    const votePoll = useCallback((pollId: string, optionId: string) => {
        send({ type: 'poll_vote', pollId, optionId, roomId: currentRoomId });
    }, [send, currentRoomId]);

    // Games
    const inviteGame = useCallback((gameType: 'tictactoe' | 'chess', opponentId: string) => {
        send({ type: 'game_invite', gameType, opponentId });
    }, [send]);

    const acceptGame = useCallback((gameId: string, fromUserId: string) => {
        send({ type: 'game_accept', gameId, fromUserId });
    }, [send]);

    const rejectGame = useCallback((gameId: string) => {
        send({ type: 'game_reject', gameId });
    }, [send]);

    const makeGameMove = useCallback((gameId: string, position: number) => {
        send({ type: 'game_move', gameId, position });
    }, [send]);

    // Watch Together
    const createWatchSession = useCallback((videoUrl: string) => {
        send({ type: 'watch_create', roomId: currentRoomId, videoUrl });
    }, [send, currentRoomId]);

    const syncWatch = useCallback((action: 'play' | 'pause' | 'seek', time?: number) => {
        send({ type: 'watch_sync', action, time });
    }, [send]);

    const endWatchSession = useCallback(() => {
        send({ type: 'watch_end' });
        setWatchSession({ active: false });
    }, [send]);

    // Presence
    const updatePresence = useCallback((status: 'online' | 'away' | 'dnd' | 'invisible') => {
        setMyPresence(status);
        send({ type: 'presence_update', status });
    }, [send]);

    // Profile Update
    const updateProfile = useCallback((data: { displayName?: string; statusMessage?: string; avatar?: string }) => {
        send({ type: 'profile_update', ...data });
    }, [send]);

    // AI Chat
    const sendAIMessage = useCallback((message: string) => {
        setAiMessages(prev => [...prev, {
            role: 'user',
            content: message,
            timestamp: Date.now()
        }]);
        setAiLoading(true);
        send({ type: 'ai_request', message });
    }, [send]);

    const clearAIMessages = useCallback(() => {
        setAiMessages([]);
    }, []);

    // Alias for compatibility
    const isConnected = connected;

    return {
        connected,
        isConnected,
        messages,
        rooms,
        users,
        currentRoomId,
        setCurrentRoomId,
        sendMessage,
        sendTypingStatus,
        joinRoom,
        leaveRoom,
        deleteRoom,
        createRoom,
        editMessage,
        deleteMessage,
        addReaction,
        // New features
        typingUsers,
        roomMembers,
        // Message Actions
        pinMessage,
        unpinMessage,
        replyMessage,
        forwardMessage,
        // User Management
        blockUser,
        unblockUser,
        kickUser,
        // Special Message Types
        sendSticker,
        sendLocation,
        // Features
        polls,
        createPoll,
        votePoll,
        activeGames,
        inviteGame,
        acceptGame,
        rejectGame,
        makeGameMove,
        watchSession,
        createWatchSession,
        syncWatch,
        endWatchSession,
        myPresence,
        updatePresence,
        updateProfile,
        profileUpdate,
        clearProfileUpdate: () => setProfileUpdate(null),
        // AI Chat
        aiMessages,
        aiLoading,
        sendAIMessage,
        clearAIMessages,
        login,
        register,
        startCall,
        acceptIncomingCall,
        rejectIncomingCall,
        endCurrentCall,
        sendSignal,
        ws: wsRef.current
    };
}
