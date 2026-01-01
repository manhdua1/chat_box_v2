import { useState, useEffect, useCallback, useRef } from 'react';
import { useCallStore } from '@/stores/callStore';

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

interface AIMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
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

export function useWebSocket() {
    const [connected, setConnected] = useState(false);
    const [messages, setMessages] = useState<Record<string, Message[]>>({});
    const [rooms, setRooms] = useState<Room[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [currentRoomId, setCurrentRoomId] = useState<string>('');
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

    // New feature states
    const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
    const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
    const [aiLoading, setAiLoading] = useState(false);
    const [polls, setPolls] = useState<Record<string, Poll>>({});
    const [activeGames, setActiveGames] = useState<Record<string, GameState>>({});
    const [watchSession, setWatchSession] = useState<{ active: boolean; videoUrl?: string; viewerCount?: number }>({ active: false });
    const [myPresence, setMyPresence] = useState<'online' | 'away' | 'dnd' | 'invisible'>('online');

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

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
                handleMessage(data);
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
                setMessages(prev => {
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
                console.log('✅ Joined room:', data.roomId);
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

            // AI Bot
            case 'ai_response':
                setAiLoading(false);
                setAiMessages(prev => [...prev, {
                    role: 'assistant',
                    content: data.content,
                    timestamp: Date.now()
                }]);
                break;

            case 'ai_error':
                setAiLoading(false);
                setAiMessages(prev => [...prev, {
                    role: 'assistant',
                    content: 'Sorry, I encountered an error. Please try again.',
                    timestamp: Date.now()
                }]);
                break;

            // Polls
            case 'poll_created':
                setPolls(prev => ({ ...prev, [data.poll.id]: data.poll }));
                break;

            case 'poll_vote':
                setPolls(prev => {
                    const poll = prev[data.pollId];
                    if (!poll) return prev;
                    const updatedOptions = poll.options.map(opt =>
                        opt.id === data.optionId
                            ? { ...opt, votes: opt.votes + 1, voters: [...opt.voters, data.userId] }
                            : opt
                    );
                    return { ...prev, [data.pollId]: { ...poll, options: updatedOptions } };
                });
                break;

            // Games
            case 'game_invite':
                window.dispatchEvent(new CustomEvent('game-invite', { detail: data }));
                break;

            case 'game_start':
            case 'game_state':
                setActiveGames(prev => ({ ...prev, [data.gameId]: data.game }));
                break;

            case 'game_end':
                setActiveGames(prev => {
                    const updated = { ...prev };
                    if (updated[data.gameId]) {
                        updated[data.gameId] = { ...updated[data.gameId], status: 'finished', winner: data.winner };
                    }
                    return updated;
                });
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

            default:
                console.log('Unknown message type:', data.type, data);
        }
    }, []);

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
                                user: { id: data.userId, username: data.username },
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
        console.log('📤 sendMessage called:', { roomId, content, metadata });
        const message: any = {
            type: 'chat',
            roomId,
            content
        };

        // Add metadata if present (for file attachments)
        if (metadata) {
            message.metadata = metadata;
            console.log('📎 Message with metadata:', message);
        }

        send(message);
    }, [send]);

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
    const startCall = useCallback((targetId: string, type: 'audio' | 'video') => {
        console.log('📞 Starting call to:', targetId, type);
        useCallStore.getState().startCall(targetId, type);
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
        send({
            type,
            targetUserId: targetId,
            ...payload
        })
    }, [send])

    // AI Bot
    const sendAIMessage = useCallback((message: string) => {
        setAiMessages(prev => [...prev, { role: 'user', content: message, timestamp: Date.now() }]);
        setAiLoading(true);
        send({ type: 'ai_request', content: message });
    }, [send]);

    const clearAIMessages = useCallback(() => {
        setAiMessages([]);
    }, []);

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

    const acceptGame = useCallback((gameId: string) => {
        send({ type: 'game_accept', gameId });
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
        aiMessages,
        aiLoading,
        sendAIMessage,
        clearAIMessages,
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
