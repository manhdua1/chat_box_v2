import { useState, useEffect, useRef } from 'react';

interface User {
    id: string;
    username: string;
    avatar?: string;
    online?: boolean;
    statusMessage?: string;
}

interface UserSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    users: User[];
    currentUserId?: string;
    onStartDM: (userId: string) => void;
    onInviteToRoom?: (userId: string) => void;
    onBlockUser?: (userId: string) => void;
}

export default function UserSearchModal({
    isOpen,
    onClose,
    users,
    currentUserId,
    onStartDM,
    onInviteToRoom,
    onBlockUser
}: UserSearchModalProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setSearchQuery('');
            setSelectedUser(null);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
        }
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const filteredUsers = users.filter(user =>
        user.id !== currentUserId &&
        user.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-lg bg-[var(--bg-tertiary)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                {/* Search Header */}
                <div className="p-4 border-b border-white/10">
                    <div className="relative">
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#64748b"
                            strokeWidth="2"
                            className="absolute left-4 top-1/2 -translate-y-1/2"
                        >
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Search users by name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full py-3 px-4 pl-12 bg-black/30 border border-white/10 rounded-xl text-white text-base outline-none transition-all placeholder:text-slate-500 focus:border-violet-500/50"
                        />
                        <button
                            onClick={onClose}
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors bg-transparent border-none cursor-pointer"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Results */}
                <div className="max-h-80 overflow-y-auto">
                    {searchQuery.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 text-slate-600">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                            <p className="text-sm">Type to search for users</p>
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 text-slate-600">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                            </svg>
                            <p className="text-sm">No users found matching "{searchQuery}"</p>
                        </div>
                    ) : (
                        <div className="p-2">
                            {filteredUsers.map(user => (
                                <div
                                    key={user.id}
                                    onClick={() => setSelectedUser(selectedUser?.id === user.id ? null : user)}
                                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${selectedUser?.id === user.id
                                        ? 'bg-violet-500/20 border border-violet-500/30'
                                        : 'hover:bg-white/5 border border-transparent'
                                        }`}
                                >
                                    <div className="relative">
                                        <img
                                            src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                                            alt={user.username}
                                            className="w-12 h-12 rounded-xl"
                                        />
                                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#1e293b] ${user.online ? 'bg-green-500' : 'bg-gray-500'
                                            }`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-slate-100">{user.username}</div>
                                        <div className={`text-xs ${user.online ? 'text-green-500' : 'text-slate-500'}`}>
                                            {user.statusMessage || (user.online ? 'Online' : 'Offline')}
                                        </div>
                                    </div>
                                    {selectedUser?.id === user.id && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onStartDM(user.id);
                                                    onClose();
                                                }}
                                                className="px-3 py-1.5 bg-violet-500 hover:bg-violet-600 text-white text-xs font-medium rounded-lg transition-colors border-none cursor-pointer"
                                            >
                                                Message
                                            </button>
                                            {onInviteToRoom && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onInviteToRoom(user.id);
                                                        onClose();
                                                    }}
                                                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-medium rounded-lg transition-colors border-none cursor-pointer"
                                                >
                                                    Invite
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (onBlockUser) {
                                                        onBlockUser(user.id);
                                                        onClose();
                                                    }
                                                }}
                                                className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium rounded-lg transition-colors border-none cursor-pointer"
                                            >
                                                Block
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-white/10 bg-black/20">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} found</span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px]">ESC</kbd>
                            to close
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
