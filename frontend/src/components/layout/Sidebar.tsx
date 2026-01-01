import { useState, useRef, useEffect } from 'react';
import UserSearchModal from '../chat/UserSearchModal';
import { useTheme } from '../providers/ThemeProvider';
import { BlockedUsersModal } from '../users/BlockedUsersModal';
import { RoomManager } from '../room/RoomManager';

type PresenceStatus = 'online' | 'away' | 'dnd' | 'invisible';

interface AIMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

interface SidebarProps {
    currentUser: any;
    rooms: any[];
    users: any[];
    currentRoom: string | null;
    onRoomSelect: (roomId: string) => void;
    onCreateRoom: (name: string) => void;
    onLogout: () => void;
    connected: boolean;
    // New presence props
    myPresence?: PresenceStatus;
    onUpdatePresence?: (status: PresenceStatus) => void;
    // Profile update
    onUpdateProfile?: (data: { displayName?: string; statusMessage?: string; avatar?: string }) => void;
    // AI props
    aiMessages?: AIMessage[];
    aiLoading?: boolean;
    onSendAIMessage?: (message: string) => void;
    onClearAIMessages?: () => void;
    // Call
    onStartCall?: (userId: string, type: 'audio' | 'video') => void;
    // Tab control from parent
    activeTab?: 'rooms' | 'users';
    onTabChange?: (tab: 'rooms' | 'users') => void;
}

export default function Sidebar({
    currentUser,
    rooms,
    users,
    currentRoom,
    onRoomSelect,
    onCreateRoom,
    onLogout,
    connected,
    myPresence = 'online',
    onUpdatePresence,
    onUpdateProfile,
    aiMessages: wsAiMessages = [],
    aiLoading = false,
    onSendAIMessage,
    onClearAIMessages: _onClearAIMessages,
    onStartCall,
    activeTab: controlledActiveTab,
    onTabChange
}: SidebarProps) {
    const { theme, toggleTheme } = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [internalActiveTab, setInternalActiveTab] = useState<'rooms' | 'users'>('rooms');
    
    // Use controlled or internal state
    const activeTab = controlledActiveTab ?? internalActiveTab;
    const setActiveTab = (tab: 'rooms' | 'users') => {
        if (onTabChange) {
            onTabChange(tab);
        } else {
            setInternalActiveTab(tab);
        }
    };
    
    const [isCreatingRoom, setIsCreatingRoom] = useState(false);
    const [newRoomName, setNewRoomName] = useState('');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [showStatusDropdown, setShowStatusDropdown] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isAIChatOpen, setIsAIChatOpen] = useState(false);
    const [isBotManagerOpen, setIsBotManagerOpen] = useState(false);
    const [isBlockedUsersOpen, setIsBlockedUsersOpen] = useState(false);
    const [isRoomManagerOpen, setIsRoomManagerOpen] = useState(false);
    const [aiInput, setAiInput] = useState('');
    const statusDropdownRef = useRef<HTMLDivElement>(null);

    // Profile form state
    const [profileDisplayName, setProfileDisplayName] = useState('');
    const [profileStatusMessage, setProfileStatusMessage] = useState('');

    // Bot Manager state
    const [bots, setBots] = useState([
        { id: 'welcome', name: 'Welcome Bot', desc: 'Greets new members automatically', icon: '👋', active: true, commands: ['/welcome'] },
        { id: 'mod', name: 'Moderation Bot', desc: 'Auto-moderates chat content', icon: '🛡️', active: false, commands: ['/kick', '/ban', '/mute'] },
        { id: 'music', name: 'Music Bot', desc: 'Play music from YouTube', icon: '🎵', active: false, commands: ['/play', '/skip', '/queue'] },
        { id: 'poll', name: 'Poll Bot', desc: 'Create and manage polls', icon: '📊', active: true, commands: ['/poll', '/vote'] },
        { id: 'game', name: 'Game Bot', desc: 'Mini games and fun activities', icon: '🎮', active: false, commands: ['/dice', '/flip', '/trivia'] },
    ]);
    const [isCreatingBot, setIsCreatingBot] = useState(false);
    const [newBotName, setNewBotName] = useState('');
    const [newBotTrigger, setNewBotTrigger] = useState('');
    const [newBotResponse, setNewBotResponse] = useState('');

    const toggleBot = (botId: string) => {
        setBots(prev => prev.map(bot => 
            bot.id === botId ? { ...bot, active: !bot.active } : bot
        ));
    };

    const createCustomBot = () => {
        if (newBotName.trim() && newBotTrigger.trim() && newBotResponse.trim()) {
            const newBot = {
                id: `custom_${Date.now()}`,
                name: newBotName,
                desc: `Responds to ${newBotTrigger}`,
                icon: '🤖',
                active: true,
                commands: [newBotTrigger],
                isCustom: true,
                response: newBotResponse
            };
            setBots(prev => [...prev, newBot]);
            setNewBotName('');
            setNewBotTrigger('');
            setNewBotResponse('');
            setIsCreatingBot(false);
        }
    };

    const deleteBot = (botId: string) => {
        setBots(prev => prev.filter(bot => bot.id !== botId));
    };

    // Reset profile form when modal opens
    useEffect(() => {
        if (isSettingsOpen) {
            setProfileDisplayName(currentUser?.username || '');
            setProfileStatusMessage('');
        }
    }, [isSettingsOpen, currentUser]);

    const handleSaveProfile = () => {
        onUpdateProfile?.({
            displayName: profileDisplayName,
            statusMessage: profileStatusMessage
        });
        setIsSettingsOpen(false);
    };

    // Close status dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
                setShowStatusDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const statusConfig = {
        online: { label: 'Online', color: 'bg-green-500', textColor: 'text-green-500' },
        away: { label: 'Away', color: 'bg-yellow-500', textColor: 'text-yellow-500' },
        dnd: { label: 'Do Not Disturb', color: 'bg-red-500', textColor: 'text-red-500' },
        invisible: { label: 'Invisible', color: 'bg-gray-500', textColor: 'text-gray-500' }
    };

    const currentStatus = connected ? statusConfig[myPresence] : { label: 'Offline', color: 'bg-gray-500', textColor: 'text-gray-500' };

    const handleCreateRoom = (e: React.FormEvent) => {
        e.preventDefault();
        if (newRoomName.trim()) {
            onCreateRoom(newRoomName.trim());
            setNewRoomName('');
            setIsCreatingRoom(false);
        }
    };

    const filteredRooms = rooms.filter(room =>
        room.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredUsers = users.filter(user =>
        user.username?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        user.id !== currentUser?.id
    );

    // Use actual rooms only - no demo data
    const displayRooms = filteredRooms;

    // Use real users only, no mock data for calling
    const displayUsers = filteredUsers;
    const hasMockUsers = filteredUsers.length === 0;
    const mockUsers = [
        { id: 'u1', username: 'Alice', online: true },
        { id: 'u2', username: 'Bob', online: true },
        { id: 'u3', username: 'Charlie', online: false },
    ];

    return (
        <aside className="w-[280px] h-full flex flex-col bg-gradient-to-b from-[#1e1b4b] to-[#1e293b] border-r border-white/10 shrink-0">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <img
                            src={currentUser?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.username || 'user'}`}
                            alt="Avatar"
                            className="w-11 h-11 rounded-xl border-2 border-violet-500/50"
                        />
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#1e1b4b] ${connected ? 'bg-green-500' : 'bg-gray-500'}`} />
                    </div>
                    <div className="relative" ref={statusDropdownRef}>
                        <div className="font-semibold text-slate-100 text-[15px]">
                            {currentUser?.username || 'User'}
                        </div>
                        <button
                            onClick={() => connected && setShowStatusDropdown(!showStatusDropdown)}
                            className={`text-xs flex items-center gap-1 ${currentStatus.textColor} hover:opacity-80 transition-opacity cursor-pointer bg-transparent border-none p-0`}
                            disabled={!connected}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${currentStatus.color}`} />
                            {currentStatus.label}
                            {connected && (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                            )}
                        </button>

                        {/* Status Dropdown */}
                        {showStatusDropdown && (
                            <div className="absolute top-full left-0 mt-2 w-48 bg-slate-800 border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
                                {(Object.entries(statusConfig) as [PresenceStatus, typeof statusConfig.online][]).map(([key, config]) => (
                                    <button
                                        key={key}
                                        onClick={() => {
                                            onUpdatePresence?.(key);
                                            setShowStatusDropdown(false);
                                        }}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors border-none bg-transparent cursor-pointer ${myPresence === key ? 'bg-white/10' : ''
                                            }`}
                                    >
                                        <span className={`w-2.5 h-2.5 rounded-full ${config.color}`} />
                                        <span className="text-slate-200 text-sm">{config.label}</span>
                                        {myPresence === key && (
                                            <svg className="ml-auto text-violet-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex gap-1 flex-wrap">
                    <button
                        onClick={() => setIsSearchOpen(true)}
                        className="w-9 h-9 flex items-center justify-center bg-violet-500/10 border-none rounded-lg text-violet-400 cursor-pointer hover:bg-violet-500/20 hover:text-violet-300 transition-colors"
                        title="Search Users"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                    </button>

                    {/* AI Bot Button */}
                    <button
                        onClick={() => setIsAIChatOpen(true)}
                        className="w-9 h-9 flex items-center justify-center bg-emerald-500/10 border-none rounded-lg text-emerald-400 cursor-pointer hover:bg-emerald-500/20 hover:text-emerald-300 transition-colors"
                        title="AI Assistant"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                        </svg>
                    </button>

                    {/* Bot Manager Button */}
                    <button
                        onClick={() => setIsBotManagerOpen(true)}
                        className="w-9 h-9 flex items-center justify-center bg-blue-500/10 border-none rounded-lg text-blue-400 cursor-pointer hover:bg-blue-500/20 hover:text-blue-300 transition-colors"
                        title="Bot Manager"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="10" rx="2" />
                            <circle cx="12" cy="5" r="3" />
                            <line x1="12" y1="8" x2="12" y2="11" />
                            <circle cx="8" cy="16" r="1" />
                            <circle cx="16" cy="16" r="1" />
                        </svg>
                    </button>

                    {/* Theme Toggle Button */}
                    <button
                        onClick={toggleTheme}
                        className="w-9 h-9 flex items-center justify-center bg-amber-500/10 border-none rounded-lg text-amber-400 cursor-pointer hover:bg-amber-500/20 hover:text-amber-300 transition-colors"
                        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    >
                        {theme === 'dark' ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="5" />
                                <line x1="12" y1="1" x2="12" y2="3" />
                                <line x1="12" y1="21" x2="12" y2="23" />
                                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                                <line x1="1" y1="12" x2="3" y2="12" />
                                <line x1="21" y1="12" x2="23" y2="12" />
                                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                            </svg>
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                            </svg>
                        )}
                    </button>

                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="w-9 h-9 flex items-center justify-center bg-white/5 border-none rounded-lg text-slate-400 cursor-pointer hover:bg-white/10 hover:text-slate-200 transition-colors"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                    </button>
                    <button
                        onClick={onLogout}
                        className="w-9 h-9 flex items-center justify-center bg-red-500/10 border-none rounded-lg text-red-400 cursor-pointer hover:bg-red-500/20 hover:text-red-300 transition-colors"
                        title="Logout"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="p-3 px-4 relative">
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#64748b"
                    strokeWidth="2"
                    className="absolute left-7 top-1/2 -translate-y-1/2"
                >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full py-2.5 px-3 pl-10 bg-white/5 border border-white/10 rounded-xl text-slate-100 text-sm outline-none transition-all placeholder:text-slate-500 focus:border-violet-500/50 focus:bg-white/10"
                />
            </div>

            {/* Tabs */}
            <div className="flex px-3 gap-2">
                <button
                    onClick={() => setActiveTab('rooms')}
                    className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-none rounded-xl text-[13px] font-medium cursor-pointer transition-colors ${activeTab === 'rooms'
                        ? 'bg-violet-500/20 text-violet-400'
                        : 'bg-transparent text-slate-500 hover:bg-white/5 hover:text-slate-300'
                        }`}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="4" y1="9" x2="20" y2="9" />
                        <line x1="4" y1="15" x2="20" y2="15" />
                        <line x1="10" y1="3" x2="8" y2="21" />
                        <line x1="16" y1="3" x2="14" y2="21" />
                    </svg>
                    Rooms
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-none rounded-xl text-[13px] font-medium cursor-pointer transition-colors ${activeTab === 'users'
                        ? 'bg-violet-500/20 text-violet-400'
                        : 'bg-transparent text-slate-500 hover:bg-white/5 hover:text-slate-300'
                        }`}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    Users
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1">
                {/* Header */}
                <div className="flex items-center justify-between px-1 py-2 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                    <span>{activeTab === 'rooms' ? 'Channels' : 'Direct Messages'}</span>
                    {activeTab === 'rooms' && (
                        <button
                            onClick={() => setIsCreatingRoom(true)}
                            className="w-6 h-6 flex items-center justify-center bg-transparent border-none rounded-md text-slate-500 cursor-pointer hover:bg-white/5 hover:text-slate-300 transition-colors"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Items */}
                {activeTab === 'rooms' ? (
                    displayRooms.map(room => (
                        <div
                            key={room.id}
                            onClick={() => onRoomSelect(room.id)}
                            className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border-l-[3px] ${currentRoom === room.id
                                ? 'bg-violet-500/15 border-violet-500'
                                : 'bg-transparent border-transparent hover:bg-white/5'
                                }`}
                        >
                            <div className="w-9 h-9 flex items-center justify-center bg-gradient-to-br from-violet-500 to-indigo-500 rounded-xl text-white text-sm font-semibold shadow-sm">
                                #
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-slate-100 text-sm mb-0.5">
                                    {room.name}
                                </div>
                                {room.lastMessage && (
                                    <div className="text-xs text-slate-500 truncate">
                                        {room.lastMessage}
                                    </div>
                                )}
                            </div>
                            {room.unreadCount > 0 && (
                                <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-violet-500 rounded-full text-white text-[11px] font-semibold">
                                    {room.unreadCount}
                                </span>
                            )}
                        </div>
                    ))
                ) : (
                    /* Users Tab - Different UI */
                    <div className="space-y-4">
                        {/* Online Users Section */}
                        <div>
                            <div className="flex items-center gap-2 px-1 py-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                                    Online — {(hasMockUsers ? mockUsers : displayUsers).filter(u => u.online).length}
                                </span>
                            </div>
                            {(hasMockUsers ? mockUsers : displayUsers).filter(u => u.online).map(user => (
                                <div
                                    key={user.id}
                                    onClick={() => !hasMockUsers && onRoomSelect(`dm_${user.id}`)}
                                    className={`flex items-center gap-3 p-2.5 bg-transparent rounded-xl transition-all hover:bg-white/5 group ${hasMockUsers ? 'cursor-default opacity-60' : 'cursor-pointer'}`}
                                >
                                    <div className="relative">
                                        <img
                                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                                            alt={user.username}
                                            className="w-10 h-10 rounded-xl ring-2 ring-green-500/30"
                                        />
                                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#1e293b] bg-green-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-slate-100 text-sm">
                                            {user.username}
                                            {hasMockUsers && <span className="text-xs text-slate-500 ml-1">(demo)</span>}
                                        </div>
                                        <div className="text-xs text-green-400 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                                            Active now
                                        </div>
                                    </div>
                                    {/* Action buttons on hover - only for real users */}
                                    {!hasMockUsers && (
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onRoomSelect(`dm_${user.id}`);
                                                }}
                                                className="w-8 h-8 flex items-center justify-center bg-violet-500/20 border-none rounded-lg text-violet-400 cursor-pointer hover:bg-violet-500/30 transition-colors"
                                                title="Send Message"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    console.log('📞 Voice call button clicked for user:', user.id);
                                                    onStartCall?.(user.id, 'audio');
                                                }}
                                                className="w-8 h-8 flex items-center justify-center bg-emerald-500/20 border-none rounded-lg text-emerald-400 cursor-pointer hover:bg-emerald-500/30 transition-colors"
                                                title="Voice Call"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    console.log('📹 Video call button clicked for user:', user.id);
                                                    onStartCall?.(user.id, 'video');
                                                }}
                                                className="w-8 h-8 flex items-center justify-center bg-blue-500/20 border-none rounded-lg text-blue-400 cursor-pointer hover:bg-blue-500/30 transition-colors"
                                                title="Video Call"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polygon points="23 7 16 12 23 17 23 7" />
                                                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                                                </svg>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Offline Users Section */}
                        {(hasMockUsers ? mockUsers : displayUsers).filter(u => !u.online).length > 0 && (
                            <div>
                                <div className="flex items-center gap-2 px-1 py-2">
                                    <div className="w-2 h-2 bg-slate-500 rounded-full" />
                                    <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                                        Offline — {(hasMockUsers ? mockUsers : displayUsers).filter(u => !u.online).length}
                                    </span>
                                </div>
                                {(hasMockUsers ? mockUsers : displayUsers).filter(u => !u.online).map(user => (
                                    <div
                                        key={user.id}
                                        onClick={() => !hasMockUsers && onRoomSelect(`dm_${user.id}`)}
                                        className={`flex items-center gap-3 p-2.5 bg-transparent rounded-xl transition-all hover:bg-white/5 opacity-60 hover:opacity-100 ${hasMockUsers ? 'cursor-default' : 'cursor-pointer'}`}
                                    >
                                        <div className="relative">
                                            <img
                                                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                                                alt={user.username}
                                                className="w-10 h-10 rounded-xl grayscale"
                                            />
                                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#1e293b] bg-slate-500" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-medium text-slate-400 text-sm">
                                                {user.username}
                                                {hasMockUsers && <span className="text-xs text-slate-600 ml-1">(demo)</span>}
                                            </div>
                                            <div className="text-xs text-slate-600">
                                                Offline
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* No users message when showing mock */}
                        {hasMockUsers && (
                            <div className="text-center py-4 text-slate-500 text-xs">
                                <p>Demo users shown - Connect more users to chat!</p>
                            </div>
                        )}

                        {/* No users at all */}
                        {!hasMockUsers && displayUsers.length === 0 && (
                            <div className="text-center py-8 text-slate-500">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 opacity-50">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                </svg>
                                <p className="text-sm">No users found</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Create Room Modal */}
            {isCreatingRoom && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-sm p-6 bg-[#1e293b] rounded-2xl border border-white/10 shadow-xl">
                        <h3 className="text-xl font-semibold text-white mb-2">Create New Room</h3>
                        <p className="text-slate-400 text-sm mb-6">Enter a name for your new discussion channel.</p>

                        <form onSubmit={handleCreateRoom}>
                            <div className="mb-6">
                                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                                    Room Name
                                </label>
                                <input
                                    type="text"
                                    value={newRoomName}
                                    onChange={(e) => setNewRoomName(e.target.value)}
                                    placeholder="e.g. project-alpha"
                                    className="w-full p-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:border-violet-500 outline-none transition-colors"
                                    autoFocus
                                />
                            </div>

                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsCreatingRoom(false)}
                                    className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!newRoomName.trim()}
                                    className="px-6 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors"
                                >
                                    Create Room
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* User Settings / Profile Editor Modal */}
            {isSettingsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-md p-6 bg-[#1e293b] rounded-2xl border border-white/10 shadow-xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-semibold text-white">Edit Profile</h3>
                            <button
                                onClick={() => setIsSettingsOpen(false)}
                                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        {/* Avatar Section */}
                        <div className="flex flex-col items-center mb-6">
                            <div className="relative group">
                                <img
                                    src={currentUser?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.username || 'user'}`}
                                    alt="Avatar"
                                    className="w-24 h-24 rounded-2xl border-4 border-violet-500/30 mb-2"
                                />
                                <button
                                    className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Change avatar"
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                        <circle cx="12" cy="13" r="4" />
                                    </svg>
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Hover to change avatar</p>
                        </div>

                        {/* Profile Fields */}
                        <div className="space-y-4 mb-6">
                            {/* Display Name */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                                    Display Name
                                </label>
                                <input
                                    type="text"
                                    value={profileDisplayName}
                                    onChange={(e) => setProfileDisplayName(e.target.value)}
                                    placeholder="Your display name"
                                    className="w-full p-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:border-violet-500 outline-none transition-colors"
                                />
                            </div>

                            {/* Status Message */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                                    Status Message
                                </label>
                                <input
                                    type="text"
                                    value={profileStatusMessage}
                                    onChange={(e) => setProfileStatusMessage(e.target.value)}
                                    placeholder="What are you up to?"
                                    className="w-full p-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:border-violet-500 outline-none transition-colors"
                                    maxLength={100}
                                />
                            </div>

                            {/* Email (read-only) */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                                    Email
                                </label>
                                <div className="text-slate-400 text-sm p-3 bg-black/30 rounded-xl border border-white/5 font-mono">
                                    {currentUser?.email || `${currentUser?.username}@chatbox.local`}
                                </div>
                            </div>

                            {/* User ID (read-only) */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                                    User ID
                                </label>
                                <div className="text-slate-500 text-xs p-3 bg-black/30 rounded-xl border border-white/5 font-mono truncate">
                                    {currentUser?.id || 'N/A'}
                                </div>
                            </div>
                        </div>

                        {/* Privacy Section */}
                        <div className="border-t border-white/10 pt-4 mb-6">
                            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Privacy & Management</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setIsSettingsOpen(false);
                                        setIsBlockedUsersOpen(true);
                                    }}
                                    className="flex-1 px-3 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                    </svg>
                                    Blocked Users
                                </button>
                                <button
                                    onClick={() => {
                                        setIsSettingsOpen(false);
                                        setIsRoomManagerOpen(true);
                                    }}
                                    className="flex-1 px-3 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                    </svg>
                                    Manage Rooms
                                </button>
                            </div>
                        </div>

                        {/* Danger Zone */}
                        <div className="border-t border-white/10 pt-4 mb-6">
                            <p className="text-xs font-medium text-red-400 uppercase tracking-wider mb-3">Danger Zone</p>
                            <div className="flex gap-2">
                                <button
                                    className="flex-1 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                    Change Password
                                </button>
                                <button
                                    onClick={onLogout}
                                    className="flex-1 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                        <polyline points="16 17 21 12 16 7" />
                                        <line x1="21" y1="12" x2="9" y2="12" />
                                    </svg>
                                    Logout
                                </button>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setIsSettingsOpen(false)}
                                className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveProfile}
                                className="px-6 py-2 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-violet-500/20"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* User Search Modal */}
            <UserSearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                users={users}
                currentUserId={currentUser?.id}
                onStartDM={(userId) => onRoomSelect(`dm_${userId}`)}
            />

            {/* AI Chat Panel (Slide-in) */}
            {isAIChatOpen && (
                <div className="fixed inset-0 z-50 flex">
                    <div className="flex-1 bg-black/30" onClick={() => setIsAIChatOpen(false)} />
                    <div className="w-96 h-full bg-[#0f172a] border-l border-white/10 flex flex-col shadow-2xl">
                        {/* Header */}
                        <div className="p-4 border-b border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                        <circle cx="12" cy="12" r="3" />
                                        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-white font-semibold">AI Assistant</h3>
                                    <p className="text-emerald-400 text-xs">Powered by Gemini</p>
                                </div>
                            </div>
                            <button onClick={() => setIsAIChatOpen(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white bg-transparent border-none cursor-pointer rounded-lg hover:bg-white/10">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {wsAiMessages.length === 0 ? (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-emerald-500/20 rounded-2xl">
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5">
                                            <circle cx="12" cy="12" r="3" />
                                            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4" />
                                        </svg>
                                    </div>
                                    <h4 className="text-white font-semibold mb-2">How can I help you?</h4>
                                    <p className="text-slate-500 text-sm">Ask me anything about the chat app or get help with tasks.</p>
                                </div>
                            ) : (
                                wsAiMessages.map((msg: AIMessage, i: number) => (
                                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] p-3 rounded-xl ${msg.role === 'user' ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-200'}`}>
                                            {msg.content}
                                        </div>
                                    </div>
                                ))
                            )}
                            {aiLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-white/10 p-3 rounded-xl text-slate-400 flex items-center gap-2">
                                        <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10" opacity="0.3" />
                                            <path d="M12 2a10 10 0 0 1 10 10" />
                                        </svg>
                                        AI is thinking...
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <div className="p-4 border-t border-white/10">
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                if (aiInput.trim() && onSendAIMessage) {
                                    onSendAIMessage(aiInput);
                                    setAiInput('');
                                }
                            }} className="flex gap-2">
                                <input
                                    type="text"
                                    value={aiInput}
                                    onChange={(e) => setAiInput(e.target.value)}
                                    placeholder="Ask AI anything..."
                                    className="flex-1 py-3 px-4 bg-slate-800 border border-white/10 rounded-xl text-white text-sm outline-none placeholder:text-slate-500 focus:border-emerald-500/50"
                                />
                                <button type="submit" disabled={aiLoading} className="w-12 h-12 flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl transition-colors border-none cursor-pointer">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                                    </svg>
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Bot Manager Modal */}
            {isBotManagerOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-2xl bg-[#1e293b] rounded-2xl border border-white/10 shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
                        {/* Header */}
                        <div className="p-4 border-b border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                        <rect x="3" y="11" width="18" height="10" rx="2" />
                                        <circle cx="12" cy="5" r="3" /><line x1="12" y1="8" x2="12" y2="11" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-white font-semibold">Bot Manager</h3>
                                    <p className="text-blue-400 text-xs">{bots.filter(b => b.active).length} bots active</p>
                                </div>
                            </div>
                            <button onClick={() => setIsBotManagerOpen(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white bg-transparent border-none cursor-pointer rounded-lg hover:bg-white/10">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {/* Create Custom Bot Form */}
                            {isCreatingBot ? (
                                <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                                    <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                                        <span>🤖</span> Create Custom Bot
                                    </h4>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Bot Name</label>
                                            <input
                                                type="text"
                                                value={newBotName}
                                                onChange={(e) => setNewBotName(e.target.value)}
                                                placeholder="My Custom Bot"
                                                className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Trigger Command</label>
                                            <input
                                                type="text"
                                                value={newBotTrigger}
                                                onChange={(e) => setNewBotTrigger(e.target.value)}
                                                placeholder="/mycommand"
                                                className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Bot Response</label>
                                            <textarea
                                                value={newBotResponse}
                                                onChange={(e) => setNewBotResponse(e.target.value)}
                                                placeholder="Hello! I'm your custom bot 🤖"
                                                rows={3}
                                                className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm outline-none focus:border-blue-500 resize-none"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={createCustomBot}
                                                disabled={!newBotName.trim() || !newBotTrigger.trim() || !newBotResponse.trim()}
                                                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors border-none cursor-pointer"
                                            >
                                                Create Bot
                                            </button>
                                            <button
                                                onClick={() => setIsCreatingBot(false)}
                                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors border-none cursor-pointer"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            {/* Available Bots */}
                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Available Bots</h4>
                            <div className="space-y-2 mb-6">
                                {bots.map((bot) => (
                                    <div key={bot.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${bot.active ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/5'}`}>
                                        <span className="text-2xl">{bot.icon}</span>
                                        <div className="flex-1">
                                            <p className="text-white font-medium text-sm flex items-center gap-2">
                                                {bot.name}
                                                {(bot as any).isCustom && <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">Custom</span>}
                                            </p>
                                            <p className="text-slate-500 text-xs">{bot.desc}</p>
                                            <div className="flex gap-1 mt-1">
                                                {bot.commands.map((cmd, i) => (
                                                    <code key={i} className="text-[10px] px-1.5 py-0.5 bg-black/30 text-blue-400 rounded">{cmd}</code>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => toggleBot(bot.id)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border-none cursor-pointer ${bot.active ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-white/10 text-slate-400 hover:text-white hover:bg-white/20'}`}
                                            >
                                                {bot.active ? '✓ Active' : 'Enable'}
                                            </button>
                                            {(bot as any).isCustom && (
                                                <button
                                                    onClick={() => deleteBot(bot.id)}
                                                    className="w-8 h-8 flex items-center justify-center text-red-400 hover:bg-red-500/20 rounded-lg transition-colors border-none cursor-pointer"
                                                    title="Delete bot"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <polyline points="3 6 5 6 21 6" />
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Slash Commands Reference */}
                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Quick Commands Reference</h4>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { cmd: '/help', desc: 'Show all commands' },
                                    { cmd: '/dice', desc: 'Roll a dice 🎲' },
                                    { cmd: '/flip', desc: 'Flip a coin 🪙' },
                                    { cmd: '/poll', desc: 'Create a poll 📊' },
                                    { cmd: '/watch', desc: 'Watch together 📺' },
                                    { cmd: '@ai', desc: 'Ask AI assistant 🤖' },
                                ].map((item, i) => (
                                    <div key={i} className="p-2 bg-black/30 rounded-lg flex items-center justify-between">
                                        <code className="text-blue-400 font-mono text-sm">{item.cmd}</code>
                                        <span className="text-slate-500 text-xs">{item.desc}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-white/10 flex justify-between">
                            {!isCreatingBot && (
                                <button
                                    onClick={() => setIsCreatingBot(true)}
                                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors border-none cursor-pointer flex items-center gap-2"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="12" y1="5" x2="12" y2="19" />
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>
                                    Create Custom Bot
                                </button>
                            )}
                            <button onClick={() => { setIsBotManagerOpen(false); setIsCreatingBot(false); }} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm transition-colors border-none cursor-pointer ml-auto">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Blocked Users Modal */}
            <BlockedUsersModal
                isOpen={isBlockedUsersOpen}
                onClose={() => setIsBlockedUsersOpen(false)}
            />

            {/* Room Manager Modal */}
            <RoomManager
                isOpen={isRoomManagerOpen}
                onClose={() => setIsRoomManagerOpen(false)}
                onRoomSelect={onRoomSelect}
            />
        </aside>
    );
}
