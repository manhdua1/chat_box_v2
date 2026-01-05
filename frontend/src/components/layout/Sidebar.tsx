import { useState, useRef, useEffect } from 'react';
import UserSearchModal from '../chat/UserSearchModal';
import { useTheme } from '../providers/ThemeProvider';

type PresenceStatus = 'online' | 'away' | 'dnd' | 'invisible';

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
    // Call
    onStartCall?: (userId: string, username: string, type: 'audio' | 'video') => void;
    // Block user
    onBlockUser?: (userId: string) => void;
    // Tab control from parent
    activeTab?: 'rooms' | 'users';
    onTabChange?: (tab: 'rooms' | 'users') => void;
    // AI Chat
    aiMessages?: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>;
    aiLoading?: boolean;
    onSendAIMessage?: (message: string) => void;
    onClearAIMessages?: () => void;
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
    onStartCall,
    onBlockUser,
    activeTab: controlledActiveTab,
    onTabChange,
    aiMessages = [],
    aiLoading = false,
    onSendAIMessage,
    onClearAIMessages
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
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
    const [isAIChatOpen, setIsAIChatOpen] = useState(false);
    const statusDropdownRef = useRef<HTMLDivElement>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    // Profile form state
    const [profileDisplayName, setProfileDisplayName] = useState('');
    const [profileStatusMessage, setProfileStatusMessage] = useState('');
    const [profileAvatar, setProfileAvatar] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Change password state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    // Reset profile form when modal opens
    useEffect(() => {
        if (isSettingsOpen) {
            setProfileDisplayName(currentUser?.username || '');
            setProfileStatusMessage(currentUser?.statusMessage || '');
            setProfileAvatar(currentUser?.avatar || '');
            setSaveMessage(null);
        }
    }, [isSettingsOpen, currentUser]);

    // Listen for password change result
    useEffect(() => {
        const handlePasswordResult = (event: CustomEvent) => {
            const { success, message } = event.detail;
            setIsChangingPassword(false);
            if (success) {
                setPasswordSuccess(true);
                setPasswordError('');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                // Auto close after 2s
                setTimeout(() => {
                    setIsChangePasswordOpen(false);
                }, 2000);
            } else {
                setPasswordError(message || 'Failed to change password');
                setPasswordSuccess(false);
            }
        };
        
        window.addEventListener('password-change-result', handlePasswordResult as EventListener);
        return () => {
            window.removeEventListener('password-change-result', handlePasswordResult as EventListener);
        };
    }, []);

    const handleSaveProfile = async () => {
        setIsSaving(true);
        setSaveMessage(null);
        
        try {
            onUpdateProfile?.({
                displayName: profileDisplayName,
                statusMessage: profileStatusMessage,
                avatar: profileAvatar
            });
            
            setSaveMessage({ type: 'success', text: 'Profile updated successfully!' });
            
            // Auto close after 1.5s
            setTimeout(() => {
                setIsSettingsOpen(false);
                setSaveMessage(null);
            }, 1500);
        } catch (error) {
            setSaveMessage({ type: 'error', text: 'Failed to update profile' });
        } finally {
            setIsSaving(false);
        }
    };

    // Handle avatar file selection
    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Check file size (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                setSaveMessage({ type: 'error', text: 'Image must be less than 2MB' });
                return;
            }
            
            // Convert to base64
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target?.result as string;
                setProfileAvatar(base64);
            };
            reader.readAsDataURL(file);
        }
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

                    {/* Theme Toggle Button */}
                    {/* AI Chat Button */}
                    <button
                        onClick={() => setIsAIChatOpen(true)}
                        className="w-9 h-9 flex items-center justify-center bg-violet-500/10 border-none rounded-lg text-violet-400 cursor-pointer hover:bg-violet-500/20 hover:text-violet-300 transition-colors"
                        title="AI Assistant"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" />
                            <path d="M2 17l10 5 10-5" />
                            <path d="M2 12l10 5 10-5" />
                        </svg>
                    </button>

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
                                                    console.log('📞 Voice call button clicked for user:', user.id, user.username);
                                                    onStartCall?.(user.id, user.username, 'audio');
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
                                                    console.log('📹 Video call button clicked for user:', user.id, user.username);
                                                    onStartCall?.(user.id, user.username, 'video');
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
                    <div className="w-full max-w-sm p-6 bg-[var(--bg-tertiary)] rounded-2xl border border-[var(--border)] shadow-xl">
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
                    <div className="w-full max-w-md p-6 bg-[var(--bg-tertiary)] rounded-2xl border border-[var(--border)] shadow-xl">
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
                                    src={profileAvatar || currentUser?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.username || 'user'}`}
                                    alt="Avatar"
                                    className="w-24 h-24 rounded-2xl border-4 border-violet-500/30 mb-2 object-cover"
                                />
                                <input
                                    type="file"
                                    ref={avatarInputRef}
                                    onChange={handleAvatarChange}
                                    accept="image/*"
                                    className="hidden"
                                />
                                <button
                                    onClick={() => avatarInputRef.current?.click()}
                                    className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                    title="Change avatar"
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                        <circle cx="12" cy="13" r="4" />
                                    </svg>
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Click to change avatar</p>
                        </div>

                        {/* Save Message */}
                        {saveMessage && (
                            <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${
                                saveMessage.type === 'success' 
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}>
                                {saveMessage.type === 'success' ? '✓ ' : '✗ '}{saveMessage.text}
                            </div>
                        )}

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

                        {/* Danger Zone */}
                        <div className="border-t border-white/10 pt-4 mb-6">
                            <p className="text-xs font-medium text-red-400 uppercase tracking-wider mb-3">Danger Zone</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setIsSettingsOpen(false);
                                        setIsChangePasswordOpen(true);
                                        setCurrentPassword('');
                                        setNewPassword('');
                                        setConfirmPassword('');
                                        setPasswordError('');
                                        setPasswordSuccess(false);
                                    }}
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
                                onClick={() => {
                                    setIsSettingsOpen(false);
                                    setSaveMessage(null);
                                }}
                                disabled={isSaving}
                                className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveProfile}
                                disabled={isSaving}
                                className="px-6 py-2 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isSaving ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Saving...
                                    </>
                                ) : (
                                    'Save Changes'
                                )}
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
                onBlockUser={onBlockUser}
            />

            {/* Change Password Modal */}
            {isChangePasswordOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-md p-6 bg-[var(--bg-tertiary)] rounded-2xl border border-[var(--border)] shadow-xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-semibold text-white">Change Password</h3>
                            <button
                                onClick={() => setIsChangePasswordOpen(false)}
                                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        {/* Success Message */}
                        {passwordSuccess && (
                            <div className="mb-4 p-3 rounded-xl text-sm font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                                ✓ Password changed successfully!
                            </div>
                        )}

                        {/* Error Message */}
                        {passwordError && (
                            <div className="mb-4 p-3 rounded-xl text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                                ✗ {passwordError}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                                    Current Password
                                </label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Enter current password"
                                    className="w-full p-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:border-violet-500 outline-none transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                                    New Password
                                </label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Enter new password"
                                    className="w-full p-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:border-violet-500 outline-none transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                                    Confirm New Password
                                </label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                    className="w-full p-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:border-violet-500 outline-none transition-colors"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setIsChangePasswordOpen(false)}
                                disabled={isChangingPassword}
                                className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    setPasswordError('');
                                    setPasswordSuccess(false);
                                    
                                    if (!currentPassword || !newPassword || !confirmPassword) {
                                        setPasswordError('All fields are required');
                                        return;
                                    }
                                    
                                    if (newPassword !== confirmPassword) {
                                        setPasswordError('New passwords do not match');
                                        return;
                                    }
                                    
                                    if (newPassword.length < 6) {
                                        setPasswordError('Password must be at least 6 characters');
                                        return;
                                    }
                                    
                                    setIsChangingPassword(true);
                                    
                                    try {
                                        // Send change password request via WebSocket
                                        const ws = (window as any).__chatbox_ws;
                                        if (ws && ws.readyState === WebSocket.OPEN) {
                                            ws.send(JSON.stringify({
                                                type: 'change_password',
                                                currentPassword,
                                                newPassword
                                            }));
                                        }
                                        
                                        setPasswordSuccess(true);
                                        setCurrentPassword('');
                                        setNewPassword('');
                                        setConfirmPassword('');
                                        
                                        // Auto close after 2s
                                        setTimeout(() => {
                                            setIsChangePasswordOpen(false);
                                        }, 2000);
                                    } catch (error) {
                                        setPasswordError('Failed to change password');
                                    } finally {
                                        setIsChangingPassword(false);
                                    }
                                }}
                                disabled={isChangingPassword}
                                className="px-6 py-2 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isChangingPassword ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Changing...
                                    </>
                                ) : (
                                    'Change Password'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Chat Panel - Slide in from right */}
            {isAIChatOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setIsAIChatOpen(false)}>
                    <div 
                        className="bg-[var(--bg-tertiary)] rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                        <path d="M2 17l10 5 10-5" />
                                        <path d="M2 12l10 5 10-5" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-white font-semibold m-0">AI Assistant</h3>
                                    <p className="text-xs text-slate-400 m-0">Powered by Gemini</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsAIChatOpen(false)}
                                className="w-8 h-8 flex items-center justify-center bg-transparent border-none rounded-lg text-slate-400 cursor-pointer hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[50vh]">
                            {aiMessages.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-violet-500/20 flex items-center justify-center">
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-400">
                                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                        </svg>
                                    </div>
                                    <p className="text-slate-400">Ask me anything!</p>
                                    <p className="text-xs text-slate-500 mt-2">I can help with coding, explanations, and more</p>
                                </div>
                            ) : (
                                aiMessages.map((msg, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                            msg.role === 'assistant'
                                                ? 'bg-gradient-to-br from-violet-500 to-purple-600'
                                                : 'bg-gradient-to-br from-blue-500 to-cyan-500'
                                        }`}>
                                            {msg.role === 'assistant' ? (
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                                    <path d="M2 17l10 5 10-5" />
                                                </svg>
                                            ) : (
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                    <circle cx="12" cy="7" r="4" />
                                                </svg>
                                            )}
                                        </div>
                                        <div className={`max-w-[80%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                                            <div className={`inline-block p-3 rounded-2xl text-sm ${
                                                msg.role === 'assistant'
                                                    ? 'bg-slate-800 text-slate-100 rounded-tl-sm'
                                                    : 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white rounded-tr-sm'
                                            }`}>
                                                <p className="whitespace-pre-wrap m-0">{msg.content}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                            {aiLoading && (
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                            <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                        </svg>
                                    </div>
                                    <div className="bg-slate-800 p-3 rounded-2xl rounded-tl-sm">
                                        <div className="flex gap-1">
                                            <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <form 
                            onSubmit={(e) => {
                                e.preventDefault();
                                const input = (e.target as HTMLFormElement).elements.namedItem('aiInput') as HTMLInputElement;
                                if (input.value.trim() && !aiLoading && onSendAIMessage) {
                                    onSendAIMessage(input.value.trim());
                                    input.value = '';
                                }
                            }} 
                            className="p-4 border-t border-white/10"
                        >
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    name="aiInput"
                                    placeholder="Type your message..."
                                    disabled={aiLoading}
                                    className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                {aiMessages.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={onClearAIMessages}
                                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-xl border-none cursor-pointer transition-colors"
                                    >
                                        Clear
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={aiLoading}
                                    className={`px-4 py-2 rounded-xl text-white text-sm border-none cursor-pointer transition-all ${
                                        !aiLoading
                                            ? 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700'
                                            : 'bg-slate-700 opacity-50 cursor-not-allowed'
                                    }`}
                                >
                                    Send
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </aside>
    );
}
