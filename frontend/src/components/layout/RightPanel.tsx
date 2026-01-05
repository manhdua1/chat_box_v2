import { useState, useMemo } from 'react';

interface Message {
    id: string;
    content: string;
    senderId: string;
    senderName: string;
    timestamp: number;
    roomId: string;
    isPinned?: boolean;
    metadata?: {
        type?: 'file' | 'image' | 'voice';
        url?: string;
        fileName?: string;
        fileSize?: number;
        mimeType?: string;
    };
}

interface RightPanelProps {
    roomId: string;
    users: any[];
    roomMembers?: any[];  // Actual room members from backend
    messages?: Message[];
    onClose: () => void;
    onLeaveRoom?: () => void;
    onKickUser?: (userId: string) => void;
    onUnpinMessage?: (messageId: string) => void;
    onBlockUser?: (userId: string) => void;
}

export default function RightPanel({
    roomId,
    users,
    roomMembers: roomMembersFromBackend = [],
    messages = [],
    onClose,
    onLeaveRoom,
    onKickUser,
    onUnpinMessage,
    onBlockUser: _onBlockUser
}: RightPanelProps) {
    const [activeTab, setActiveTab] = useState<'members' | 'pinned' | 'files'>('members');
    const [isMuted, setIsMuted] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);

    // Extract files from messages
    const files = useMemo(() => {
        return messages
            .filter(msg => msg.metadata?.url)
            .map(msg => ({
                id: msg.id,
                name: msg.metadata?.fileName || 'Unknown file',
                url: msg.metadata?.url || '',
                size: msg.metadata?.fileSize || 0,
                type: msg.metadata?.type || 'file',
                mimeType: msg.metadata?.mimeType || '',
                timestamp: msg.timestamp,
                sender: msg.senderName
            }));
    }, [messages]);

    const imageFiles = files.filter(f => f.type === 'image' || f.mimeType?.startsWith('image/'));
    const documentFiles = files.filter(f => f.type !== 'image' && !f.mimeType?.startsWith('image/'));

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const getFileIcon = (mimeType: string, fileName: string) => {
        if (mimeType?.includes('pdf') || fileName?.endsWith('.pdf')) return '📄';
        if (mimeType?.includes('word') || fileName?.endsWith('.docx') || fileName?.endsWith('.doc')) return '📝';
        if (mimeType?.includes('excel') || mimeType?.includes('spreadsheet') || fileName?.endsWith('.xlsx') || fileName?.endsWith('.xls')) return '📊';
        if (mimeType?.includes('powerpoint') || fileName?.endsWith('.pptx') || fileName?.endsWith('.ppt')) return '📽️';
        if (mimeType?.includes('zip') || mimeType?.includes('rar') || mimeType?.includes('7z')) return '📦';
        if (mimeType?.includes('audio')) return '🎵';
        if (mimeType?.includes('video')) return '🎬';
        return '📎';
    };

    const handleCopyId = () => {
        navigator.clipboard.writeText(roomId);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    // Use room members from backend if available, otherwise fall back to all online users
    const roomMembers = roomMembersFromBackend.length > 0 
        ? roomMembersFromBackend.map((member: any) => ({
            id: member.userId,
            username: member.username,
            avatar: member.avatar,
            online: true,  // Members are online by definition
            role: member.role || 'member'
        }))
        : users.filter(user => user.online).map(user => ({
            ...user,
            role: user.role || 'member'
        }));

    // Get pinned messages
    const pinnedMessages = useMemo(() => {
        return messages.filter(msg => msg.isPinned);
    }, [messages]);

    // Format time ago
    const formatTimeAgo = (timestamp: number) => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };

    return (
        <aside className="w-80 h-full flex flex-col bg-gray-900 border-l border-white/10 shrink-0">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <h3 className="m-0 text-slate-100 text-base font-semibold">
                    Room Info
                </h3>
                <button
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center bg-white/5 border-none rounded-lg text-slate-400 cursor-pointer hover:bg-white/10 transition-colors"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>

            {/* Room Info Card */}
            <div className="p-6 text-center border-b border-white/10">
                <div className="w-[72px] h-[72px] mx-auto mb-3 flex items-center justify-center bg-gradient-to-br from-violet-500 to-indigo-500 rounded-2xl text-3xl font-bold text-white">
                    #
                </div>
                <h4 className="m-0 mb-2 text-slate-100 text-lg font-semibold">
                    {roomId}
                </h4>
                <p className="m-0 mb-4 text-slate-500 text-xs">
                    A space for team discussions and collaboration
                </p>
                <div className="flex justify-center gap-5 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        {roomMembers.length} online
                    </span>
                    <span className="flex items-center gap-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                        {pinnedMessages.length} pinned
                    </span>
                </div>
            </div>

            {/* Actions */}
            <div className="p-2 border-b border-white/10">
                <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 bg-transparent border-none rounded-xl text-slate-400 text-[13px] cursor-pointer text-left hover:bg-white/5 transition-colors"
                >
                    {isMuted ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                    ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                    )}
                    {isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
                </button>

                <button
                    onClick={() => setShowInviteModal(true)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 bg-transparent border-none rounded-xl text-slate-400 text-[13px] cursor-pointer text-left hover:bg-white/5 transition-colors"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>
                    Invite Members
                </button>

                <button
                    onClick={() => setShowSettingsModal(true)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 bg-transparent border-none rounded-xl text-slate-400 text-[13px] cursor-pointer text-left hover:bg-white/5 transition-colors"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                    Room Settings
                </button>

                {onLeaveRoom && (
                    <button
                        onClick={onLeaveRoom}
                        className="w-full flex items-center gap-3 px-3 py-2.5 bg-transparent border-none rounded-xl text-red-400 text-[13px] cursor-pointer text-left hover:bg-red-500/10 transition-colors mt-1"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        Leave Room
                    </button>
                )}
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowInviteModal(false)}>
                    <div className="w-full max-w-md p-6 bg-[var(--bg-tertiary)] rounded-2xl border border-[var(--border)] shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-semibold text-white mb-2">Invite Members</h3>
                        <p className="text-slate-400 text-sm mb-6">Share this Room ID to invite others to join.</p>

                        {/* Room ID Display */}
                        <div className="mb-6">
                            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                                Room ID
                            </label>
                            <div className="flex gap-2 items-center bg-black/30 p-3 rounded-xl border border-white/10">
                                <code className="bg-transparent text-violet-400 font-mono text-sm flex-1 truncate select-all">
                                    {roomId}
                                </code>
                                <button
                                    onClick={handleCopyId}
                                    className="p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-colors flex-shrink-0"
                                    title={copySuccess ? "Copied!" : "Copy Room ID"}
                                >
                                    {copySuccess ? (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-500">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    ) : (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Instructions */}
                        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 mb-6">
                            <div className="flex gap-2 items-start mb-2">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-400 mt-0.5 flex-shrink-0">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="16" x2="12" y2="12" />
                                    <line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                                <div>
                                    <p className="text-violet-300 text-sm font-medium mb-1">How to join:</p>
                                    <ol className="text-slate-400 text-xs space-y-1 list-decimal list-inside">
                                        <li>Click "Room Manager" in sidebar</li>
                                        <li>Go to "Create / Join" tab</li>
                                        <li>Enter this Room ID and click "Join Room"</li>
                                    </ol>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={() => setShowInviteModal(false)}
                                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors"
                            >
                                Got it!
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettingsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowSettingsModal(false)}>
                    <div className="w-full max-w-sm p-6 bg-[var(--bg-tertiary)] rounded-2xl border border-[var(--border)] shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-semibold text-white mb-4">Room Settings</h3>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                                    Room Name
                                </label>
                                <div className="text-white text-sm font-medium p-3 bg-black/20 rounded-xl border border-white/10">
                                    {roomId}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                                    Created At
                                </label>
                                <div className="text-slate-300 text-sm p-3 bg-black/20 rounded-xl border border-white/10">
                                    {new Date().toLocaleDateString()} {/* Mock date */}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                                    Room Type
                                </label>
                                <div className="text-slate-300 text-sm p-3 bg-black/20 rounded-xl border border-white/10">
                                    Public Channel
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={() => setShowSettingsModal(false)}
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex p-2 gap-1 border-b border-white/10">
                {(['members', 'pinned', 'files'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 p-2 flex items-center justify-center gap-1.5 border-none rounded-lg text-xs font-medium cursor-pointer capitalize transition-colors ${activeTab === tab
                            ? 'bg-violet-500/15 text-violet-400'
                            : 'bg-transparent text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        {tab === 'members' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>}
                        {tab === 'pinned' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>}
                        {tab === 'files' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>}
                        {tab}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3">
                {activeTab === 'members' && (
                    <div className="flex flex-col gap-1">
                        {roomMembers.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 opacity-50">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                </svg>
                                <p className="text-sm">No users online</p>
                            </div>
                        ) : (
                            roomMembers.map(user => (
                                <div
                                    key={user.id}
                                    className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-white/5 transition-colors group"
                                >
                                    <div className="relative">
                                        <img
                                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                                            alt={user.username}
                                            className="w-9 h-9 rounded-[10px]"
                                        />
                                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-900 ${user.online ? 'bg-green-500' : 'bg-gray-500'
                                            }`} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium text-slate-100 text-[13px] flex items-center gap-1.5">
                                            {user.username}
                                            {user.role === 'owner' && (
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="2">
                                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                                </svg>
                                            )}
                                            {user.role === 'admin' && (
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                                </svg>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-slate-500 capitalize">
                                            {user.role || 'member'}
                                        </div>
                                    </div>
                                    {user.role !== 'owner' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (confirm(`Kick ${user.username} from this room?`)) {
                                                    onKickUser?.(user.id);
                                                }
                                            }}
                                            className="w-7 h-7 flex items-center justify-center bg-transparent border-none rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                            title="Kick user"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                                <circle cx="8.5" cy="7" r="4" />
                                                <line x1="18" y1="8" x2="23" y2="13" />
                                                <line x1="23" y1="8" x2="18" y2="13" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'pinned' && (
                    <div className="flex flex-col gap-2">
                        {pinnedMessages.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 opacity-50">
                                    <path d="M12 17v5" />
                                    <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a1 1 0 0 0-1-1H10a1 1 0 0 0-1 1v4.76z" />
                                </svg>
                                <p className="text-sm">No pinned messages</p>
                                <p className="text-xs mt-1 text-slate-600">Pin important messages to find them easily</p>
                            </div>
                        ) : (
                            pinnedMessages.map(msg => (
                                <div
                                    key={msg.id}
                                    className="relative p-3 bg-white/5 rounded-xl border border-white/5 hover:border-violet-500/30 transition-colors cursor-pointer group"
                                >
                                    <div className="flex items-start gap-2 mb-2">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="2" className="shrink-0 mt-0.5">
                                            <path d="M12 17v5" />
                                            <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a1 1 0 0 0-1-1H10a1 1 0 0 0-1 1v4.76z" />
                                        </svg>
                                        <p className="m-0 text-sm text-slate-200 leading-relaxed flex-1">{msg.content}</p>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-slate-500">
                                        <span className="flex items-center gap-1">
                                            <img
                                                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderName}`}
                                                alt={msg.senderName}
                                                className="w-4 h-4 rounded"
                                            />
                                            {msg.senderName}
                                        </span>
                                        <span>{formatTimeAgo(msg.timestamp)}</span>
                                    </div>
                                    {onUnpinMessage && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onUnpinMessage(msg.id);
                                            }}
                                            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center bg-transparent border-none rounded text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                            title="Unpin message"
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'files' && (
                    <div className="space-y-4">
                        {files.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 opacity-50">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                    <circle cx="8.5" cy="8.5" r="1.5" />
                                    <polyline points="21 15 16 10 5 21" />
                                </svg>
                                <p className="text-sm">No files shared yet</p>
                            </div>
                        ) : (
                            <>
                                {/* Images Section */}
                                {imageFiles.length > 0 && (
                                    <div>
                                        <h5 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                                            Images ({imageFiles.length})
                                        </h5>
                                        <div className="grid grid-cols-3 gap-2">
                                            {imageFiles.map((file) => (
                                                <a
                                                    key={file.id}
                                                    href={file.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="aspect-square rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-white/10 overflow-hidden cursor-pointer hover:border-violet-500/50 transition-colors group"
                                                >
                                                    <img
                                                        src={file.url}
                                                        alt={file.name}
                                                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                    />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Documents Section */}
                                {documentFiles.length > 0 && (
                                    <div>
                                        <h5 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                                            Documents ({documentFiles.length})
                                        </h5>
                                        <div className="space-y-1">
                                            {documentFiles.map((file) => (
                                                <a
                                                    key={file.id}
                                                    href={file.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group no-underline"
                                                >
                                                    <span className="text-xl">{getFileIcon(file.mimeType, file.name)}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="m-0 text-sm text-slate-200 truncate">{file.name}</p>
                                                        <p className="m-0 text-xs text-slate-500">{formatFileSize(file.size)}</p>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            window.open(file.url, '_blank');
                                                        }}
                                                        className="w-7 h-7 flex items-center justify-center bg-transparent border-none rounded-lg text-slate-500 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                            <polyline points="7 10 12 15 17 10" />
                                                            <line x1="12" y1="15" x2="12" y2="3" />
                                                        </svg>
                                                    </button>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </aside>
    );
}
