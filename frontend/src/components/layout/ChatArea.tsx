import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { Phone, Video, BarChart3, Gamepad2, Tv, Search, MessageCircle, Hash } from 'lucide-react';
import { TypingIndicator } from '../chat/TypingIndicator';
import SearchMessages from '../search/SearchMessages';
import { MessageInput } from '../chat/MessageInput';
import { PollMessage } from '../chat/PollMessage';
import { TicTacToeGame } from '../chat/GameComponents';
import { useChatStore } from '@/stores/chatStore';

// Lazy load heavy modals
import { MessageBubble } from '../chat/MessageBubble';
const PollModal = lazy(() => import('../chat/PollModal').then(module => ({ default: module.PollModal })));
const GameModal = lazy(() => import('../chat/GameModal').then(module => ({ default: module.GameModal })));
const WatchModal = lazy(() => import('../chat/WatchModal').then(module => ({ default: module.WatchModal })));

interface Message {
    id: string;
    content: string;
    senderId: string;
    senderName: string;
    timestamp: number;
    type?: string;
    reactions?: { emoji: string; userId: string; username: string }[];
    isEdited?: boolean;
    isDeleted?: boolean;
    metadata?: {
        type?: 'file' | 'image' | 'voice';
        url?: string;
        fileName?: string;
        fileSize?: number;
        mimeType?: string;
        duration?: number;
    };
}

interface Poll {
    id: string;
    question: string;
    options: { id: string; text: string; votes: number; voters: string[] }[];
    createdBy: string;
    createdAt: number;
    isClosed: boolean;
    roomId?: string;
}

interface GameState {
    id: string;
    type: 'tictactoe' | 'chess';
    board: string[];
    currentTurn: string;
    players: { X: string; O: string };
    winner: string | null;
    status: 'waiting' | 'playing' | 'finished';
}

interface ChatAreaProps {
    currentRoom: string | null;
    currentUser: any;
    messages: Message[];
    rooms?: { id: string; name: string }[];
    onSendMessage: (content: string) => void;
    onToggleRightPanel: () => void;
    onEditMessage?: (messageId: string, newContent: string) => void;
    onDeleteMessage?: (messageId: string) => void;
    onAddReaction?: (messageId: string, emoji: string) => void;
    onStartCall?: (type: 'audio' | 'video') => void;
    // New feature props
    typingUsers?: { id: string; username: string }[];
    onCreatePoll?: (question: string, options: string[]) => void;
    onVotePoll?: (pollId: string, optionId: string) => void;
    polls?: Record<string, Poll>;
    activeGames?: Record<string, GameState>;
    onInviteGame?: (gameType: 'tictactoe' | 'chess', opponentId: string) => void;
    onAcceptGame?: (gameId: string, fromUserId: string) => void;
    onRejectGame?: (gameId: string) => void;
    onMakeGameMove?: (gameId: string, position: number) => void;
    watchSession?: { active: boolean; videoUrl?: string; viewerCount?: number };
    onCreateWatchSession?: (videoUrl: string) => void;
    onSyncWatch?: (action: 'play' | 'pause' | 'seek', time?: number) => void;
    onEndWatchSession?: () => void;
    users?: { id: string; username: string; online: boolean }[];
    // Message actions
    onPinMessage?: (messageId: string) => void;
    onReplyMessage?: (content: string, replyToId: string) => void;
    onForwardMessage?: (messageId: string, targetRoomId: string) => void;
    // AI Chat (optional - displayed from Sidebar instead)
    aiMessages?: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>;
    aiLoading?: boolean;
    onSendAIMessage?: (message: string) => void;
    onClearAIMessages?: () => void;
}

export default function ChatArea({
    currentRoom,
    currentUser,
    messages,
    rooms = [],
    onSendMessage,
    onToggleRightPanel,
    onEditMessage,
    onDeleteMessage,
    onAddReaction,
    onStartCall,
    typingUsers = [],
    onCreatePoll,
    onVotePoll,
    polls = {},
    activeGames = {},
    onInviteGame,
    onAcceptGame,
    onRejectGame,
    onMakeGameMove,
    watchSession = { active: false },
    onCreateWatchSession,
    onSyncWatch,
    onEndWatchSession,
    users = [],
    onPinMessage,
    onReplyMessage
}: ChatAreaProps) {
    const { onlineUsers } = useChatStore();
    const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

    // Helper function to get display name for room/DM
    const getDisplayName = (roomId: string | null) => {
        if (!roomId) return 'Chat';
        
        // Check if it's a DM room (format: dm_userId)
        if (roomId.startsWith('dm_')) {
            const targetUserId = roomId.replace('dm_', '');
            // Find user in online users list
            const targetUser = onlineUsers.find(u => u.userId === targetUserId);
            if (targetUser) {
                return targetUser.username;
            }
            // Fallback: check users prop
            const targetFromProp = users.find(u => u.id === targetUserId);
            if (targetFromProp) {
                return targetFromProp.username;
            }
            // Last fallback: show shortened ID
            return `User ${targetUserId.slice(0, 8)}`;
        }
        
        // For regular rooms, find room name
        const room = rooms.find(r => r.id === roomId);
        return room?.name || roomId;
    };

    // Check if current room is a DM
    const isDmRoom = currentRoom?.startsWith('dm_');

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Modal states
    const [showPollModal, setShowPollModal] = useState(false);
    const [showGameModal, setShowGameModal] = useState(false);
    const [showWatchModal, setShowWatchModal] = useState(false);
    const [showSearchModal, setShowSearchModal] = useState(false);

    // Reply/Forward/Pin states
    const [replyingTo, setReplyingTo] = useState<any>(null);

    // File preview state

    const displayMessages = messages;
    
    // Debug: log messages prop
    useEffect(() => {
        console.log('🎯 ChatArea received messages prop:', messages);
        console.log('🎯 displayMessages:', displayMessages);
    }, [messages, displayMessages]);
    
    // Debug: log polls prop
    useEffect(() => {
        console.log('🗳️ ChatArea received polls prop:', polls);
        console.log('🗳️ Polls count:', Object.keys(polls).length);
    }, [polls]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [displayMessages]);

    // Handle game invitations
    useEffect(() => {
        const handleGameInvite = (event: CustomEvent) => {
            const { gameId, gameType, fromUser, fromUserId } = event.detail;
            
            // Show confirm dialog
            const accept = window.confirm(`${fromUser} invited you to play ${gameType}. Accept?`);
            
            if (accept && onAcceptGame) {
                onAcceptGame(gameId, fromUserId);
            } else if (!accept && onRejectGame) {
                onRejectGame(gameId);
            }
        };
        
        window.addEventListener('game-invite' as any, handleGameInvite as any);
        return () => window.removeEventListener('game-invite' as any, handleGameInvite as any);
    }, [onAcceptGame, onRejectGame]);

    // Close emoji picker on outside click




    const handleEditStart = (messageId: string, _content: string) => {
        setEditingMessageId(messageId);
    };



    const handleEditCancel = () => {
        setEditingMessageId(null);
    };

    const handlePinMessage = (messageId: string) => {
        onPinMessage?.(messageId);
    };



    const handleDelete = (messageId: string) => {
        if (confirm('Delete this message?') && onDeleteMessage) {
            onDeleteMessage(messageId);
        }
    };



    // Quick reactions
    const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '😡'];

    if (!currentRoom) {
        return (
            <main className="flex-1 flex items-center justify-center bg-slate-900">
                <div className="text-center">
                    <div className="w-[100px] h-[100px] mx-auto mb-6 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-700 rounded-3xl">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5">
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                        </svg>
                    </div>
                    <h2 className="text-slate-100 text-2xl font-semibold mb-2">
                        Welcome to ChatBox
                    </h2>
                    <p className="text-slate-500 m-0">
                        Select a room to start chatting
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="flex-1 flex flex-col bg-slate-900 min-w-0">
            {/* Header */}
            <header className="flex items-center justify-between px-5 py-3 bg-gray-900 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 flex items-center justify-center rounded-xl text-white text-lg font-semibold ${
                        isDmRoom 
                            ? 'bg-gradient-to-br from-pink-500 to-rose-500' 
                            : 'bg-gradient-to-br from-violet-500 to-indigo-500'
                    }`}>
                        {isDmRoom ? <MessageCircle size={20} /> : <Hash size={20} />}
                    </div>
                    <div>
                        <h3 className="m-0 text-slate-100 text-base font-semibold">
                            {isDmRoom ? '' : '#'}{getDisplayName(currentRoom)}
                        </h3>
                        <span className="text-xs text-slate-500">
                            {isDmRoom ? 'Direct Message' : `${displayMessages.length} messages`}
                        </span>
                    </div>
                </div>

                <div className="flex gap-2">
                    {/* New Feature Buttons */}
                    <button
                        onClick={() => setShowPollModal(true)}
                        className="w-10 h-10 flex items-center justify-center bg-white/5 border-none rounded-xl text-emerald-400 cursor-pointer hover:bg-emerald-500/20 transition-colors"
                        title="Create Poll"
                    >
                        <BarChart3 size={20} />
                    </button>
                    <button
                        onClick={() => setShowGameModal(true)}
                        className="w-10 h-10 flex items-center justify-center bg-white/5 border-none rounded-xl text-orange-400 cursor-pointer hover:bg-orange-500/20 transition-colors"
                        title="Play Games"
                    >
                        <Gamepad2 size={20} />
                    </button>
                    <button
                        onClick={() => setShowWatchModal(true)}
                        className="w-10 h-10 flex items-center justify-center bg-white/5 border-none rounded-xl text-pink-400 cursor-pointer hover:bg-pink-500/20 transition-colors"
                        title="Watch Together"
                    >
                        <Tv size={20} />
                    </button>
                    <button
                        onClick={() => setShowSearchModal(true)}
                        className="w-10 h-10 flex items-center justify-center bg-white/5 border-none rounded-xl text-amber-400 cursor-pointer hover:bg-amber-500/20 transition-colors"
                        title="Search Messages (Ctrl+F)"
                    >
                        <Search size={20} />
                    </button>

                    <div className="w-[1px] h-6 bg-white/10 my-auto mx-1" />

                    {/* Call Buttons */}
                    <button
                        onClick={() => onStartCall?.('audio')}
                        className="w-10 h-10 flex items-center justify-center bg-white/5 border-none rounded-xl text-green-500 cursor-pointer hover:bg-white/10 transition-colors"
                        title="Voice Call"
                    >
                        <Phone size={20} />
                    </button>
                    <button
                        onClick={() => onStartCall?.('video')}
                        className="w-10 h-10 flex items-center justify-center bg-white/5 border-none rounded-xl text-blue-500 cursor-pointer hover:bg-white/10 transition-colors"
                        title="Video Call"
                    >
                        <Video size={20} />
                    </button>
                    <div className="w-[1px] h-6 bg-white/10 my-auto mx-1" />
                    <button
                        onClick={onToggleRightPanel}
                        className="w-10 h-10 flex items-center justify-center bg-white/5 border-none rounded-xl text-slate-400 cursor-pointer hover:bg-white/10 transition-colors"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                    </button>
                </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
                {(() => {
                    // Helper to normalize timestamp to milliseconds
                    const normalizeTimestamp = (ts: number) => {
                        // Timestamps < 10000000000 are likely in seconds
                        if (ts < 10000000000) {
                            return ts * 1000;
                        }
                        return ts;
                    };
                    
                    // Get polls for current room from polls state only
                    const roomPolls = Object.values(polls).filter(poll => poll.roomId === currentRoom);
                    
                    // Get active games - only show games where current user is a player
                    const games = Object.values(activeGames).filter(game => {
                        if (!currentUser) return false;
                        // Show game if current user is either X or O player
                        return game.players.X === currentUser.id || game.players.O === currentUser.id;
                    });
                    
                    // Convert polls to items
                    const pollItems = roomPolls.map(poll => ({
                        type: 'poll' as const,
                        id: `poll-${poll.id}`,
                        timestamp: normalizeTimestamp(poll.createdAt),
                        poll: poll,
                        senderId: poll.createdBy,
                        message: null as any,
                        game: null as any,
                    }));
                    
                    // Convert games to items
                    const gameItems = games.map(game => ({
                        type: 'game' as const,
                        id: `game-${game.id}`,
                        timestamp: Date.now(), // Games don't have timestamps, use current time
                        game: game,
                        senderId: game.players.X, // Use X player as sender
                        message: null as any,
                        poll: null as any,
                    }));
                    
                    // Convert messages to items (exclude poll type messages to avoid duplicates)
                    const messageItems = displayMessages
                        .filter(msg => msg.type !== 'poll')
                        .map(msg => ({
                            type: 'message' as const,
                            id: msg.id,
                            timestamp: normalizeTimestamp(msg.timestamp),
                            message: msg,
                            poll: null as any,
                            game: null as any,
                            senderId: msg.senderId,
                        }));
                    
                    // Merge and sort by timestamp
                    const allItems = [...messageItems, ...pollItems, ...gameItems]
                        .sort((a, b) => a.timestamp - b.timestamp);
                    
                    if (allItems.length === 0) {
                        return (
                            <div className="text-center text-slate-500 p-10">
                                <div className="text-5xl mb-4">💬</div>
                                <p>No messages yet. Start the conversation!</p>
                            </div>
                        );
                    }
                    
                    return allItems.map((item, index) => {
                        const isOwn = item.senderId === currentUser?.id;
                        const showAvatar = index === 0 || allItems[index - 1]?.senderId !== item.senderId;
                        
                        // Render poll
                        if (item.type === 'poll' && item.poll) {
                            return (
                                <div key={item.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                    <div className="max-w-md w-full">
                                        <PollMessage
                                            poll={item.poll}
                                            currentUserId={currentUser?.id || ''}
                                            onVote={onVotePoll || (() => {})}
                                        />
                                    </div>
                                </div>
                            );
                        }
                        
                        // Render game (Tic Tac Toe)
                        if (item.game) {
                            return (
                                <div key={item.id} className="flex justify-start mb-2">
                                    <div className="max-w-[80%]">
                                        <TicTacToeGame
                                            gameId={item.game.id}
                                            board={item.game.board}
                                            currentTurn={item.game.currentTurn}
                                            players={item.game.players}
                                            currentUserId={currentUser?.id || ''}
                                            onMove={onMakeGameMove || (() => {})}
                                            winner={item.game.winner}
                                            status={item.game.status}
                                        />
                                    </div>
                                </div>
                            );
                        }
                        
                        // Render regular message
                        if (item.message) {
                            return (
                                <MessageBubble
                                    key={item.id}
                                    message={item.message}
                                    isOwn={isOwn}
                                    showAvatar={showAvatar}
                                    isEditing={editingMessageId === item.id}
                                    onEditStart={handleEditStart}
                                    onEditSave={(id, content) => onEditMessage?.(id, content)}
                                    onEditCancel={handleEditCancel}
                                    onDelete={handleDelete}
                                    onPin={handlePinMessage}
                                    onReply={setReplyingTo}
                                    onReactionAdd={(id, emoji) => onAddReaction?.(id, emoji)}
                                    showReactionPicker={showReactionPicker === item.id}
                                    onToggleReactionPicker={setShowReactionPicker}
                                    quickReactions={quickReactions}
                                />
                            );
                        }
                        
                        return null;
                    });
                })()}
                <div ref={messagesEndRef} />
            </div>

            {/* Typing Indicator */}
            {typingUsers.length > 0 && (
                <TypingIndicator typingUsers={typingUsers} />
            )}



            {/* Input */}
            {/* Input Area */}
            <div className="flex flex-col bg-slate-900 border-t border-white/10">
                {/* Reply Quote UI */}
                {replyingTo && (
                    <div className="flex items-center gap-3 p-3 px-5 bg-violet-500/10 border-b border-violet-500/30">
                        <div className="w-1 h-10 bg-violet-500 rounded-full shrink-0" />
                        <div className="flex-1 min-w-0">
                            <span className="text-xs text-violet-400 font-semibold">Replying to {replyingTo.senderName}</span>
                            <p className="text-sm text-slate-400 truncate">{replyingTo.content}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setReplyingTo(null)}
                            className="w-8 h-8 flex items-center justify-center bg-transparent border-none rounded-lg text-slate-400 cursor-pointer hover:text-white hover:bg-white/10"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                )}

                <MessageInput
                    onSend={(content) => {
                        if (replyingTo) {
                            onReplyMessage?.(content, replyingTo.id);
                            setReplyingTo(null);
                        } else {
                            onSendMessage(content);
                        }
                    }}
                />
            </div>



            {/* Modals wrapped in Suspense */}
            <Suspense fallback={null}>
                <PollModal
                    isOpen={showPollModal}
                    onClose={() => setShowPollModal(false)}
                    onCreatePoll={onCreatePoll || (() => { })}
                />

                <GameModal
                    isOpen={showGameModal}
                    onClose={() => setShowGameModal(false)}
                    onInviteGame={onInviteGame || (() => { })}
                    users={users}
                    currentUserId={currentUser?.id || ''}
                />

                <WatchModal
                    isOpen={showWatchModal}
                    onClose={() => setShowWatchModal(false)}
                    onCreateSession={onCreateWatchSession || (() => { })}
                    onEndSession={onEndWatchSession}
                    onSyncAction={onSyncWatch || (() => { })}
                    sessionActive={watchSession.active}
                    currentVideoUrl={watchSession.videoUrl}
                    viewerCount={watchSession.viewerCount}
                />
            </Suspense>









            {/* Search Messages Modal */}
            <SearchMessages
                isOpen={showSearchModal}
                onClose={() => setShowSearchModal(false)}
                messages={messages}
                onScrollToMessage={(messageId) => {
                    const element = document.querySelector(`[data-message-id="${messageId}"]`);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        element.classList.add('bg-violet-500/30');
                        setTimeout(() => element.classList.remove('bg-violet-500/30'), 2000);
                    }
                }}
            />
        </main>
    );
}
