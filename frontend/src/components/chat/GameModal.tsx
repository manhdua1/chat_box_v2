import { useState } from 'react';

interface GameModalProps {
    isOpen: boolean;
    onClose: () => void;
    onInviteGame: (gameType: 'tictactoe' | 'chess', targetUserId: string) => void;
    users: Array<{ id: string; username: string; online: boolean }>;
    currentUserId: string;
}

export function GameModal({ isOpen, onClose, onInviteGame, users, currentUserId }: GameModalProps) {
    const [selectedUser, setSelectedUser] = useState('');
    const [selectedGame, setSelectedGame] = useState<'tictactoe' | 'chess'>('tictactoe');

    const onlineUsers = users.filter(u => u.online && u.id !== currentUserId);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedUser) {
            onInviteGame(selectedGame, selectedUser);
            onClose();
            setSelectedUser('');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-[var(--bg-tertiary)] rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                <rect x="3" y="3" width="7" height="7" />
                                <rect x="14" y="3" width="7" height="7" />
                                <rect x="14" y="14" width="7" height="7" />
                                <rect x="3" y="14" width="7" height="7" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-white font-semibold">Start a Game</h3>
                            <p className="text-xs text-slate-400">Challenge a friend</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center bg-transparent border-none rounded-lg text-slate-400 cursor-pointer hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {/* Game Selection */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Select Game
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setSelectedGame('tictactoe')}
                                className={`p-4 rounded-xl border-2 transition-all ${selectedGame === 'tictactoe'
                                        ? 'border-orange-500 bg-orange-500/10'
                                        : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                                    }`}
                            >
                                <div className="text-2xl mb-2">⭕❌</div>
                                <div className="text-white font-medium text-sm">Tic-Tac-Toe</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedGame('chess')}
                                className={`p-4 rounded-xl border-2 transition-all ${selectedGame === 'chess'
                                        ? 'border-orange-500 bg-orange-500/10'
                                        : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                                    }`}
                            >
                                <div className="text-2xl mb-2">♟️</div>
                                <div className="text-white font-medium text-sm">Chess</div>
                                <div className="text-xs text-slate-500 mt-1">Coming soon</div>
                            </button>
                        </div>
                    </div>

                    {/* Player Selection */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Select Opponent
                        </label>
                        {onlineUsers.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                <p>No online users available</p>
                            </div>
                        ) : (
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                                {onlineUsers.map((user) => (
                                    <button
                                        key={user.id}
                                        type="button"
                                        onClick={() => setSelectedUser(user.id)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${selectedUser === user.id
                                                ? 'border-orange-500 bg-orange-500/10'
                                                : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                                            }`}
                                    >
                                        <img
                                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                                            alt={user.username}
                                            className="w-8 h-8 rounded-full"
                                        />
                                        <span className="text-white font-medium">{user.username}</span>
                                        <div className="ml-auto w-2 h-2 bg-emerald-500 rounded-full" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-xl border-none cursor-pointer transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!selectedUser || (selectedGame === 'chess')}
                            className={`flex-1 px-4 py-2 text-white text-sm rounded-xl border-none cursor-pointer transition-all ${selectedUser && selectedGame !== 'chess'
                                    ? 'bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700'
                                    : 'bg-slate-700 opacity-50 cursor-not-allowed'
                                }`}
                        >
                            Send Invite
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
