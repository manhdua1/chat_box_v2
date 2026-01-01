import { useState, useEffect } from 'react'
import { X, UserMinus, RefreshCw, Loader2, AlertCircle, Shield } from 'lucide-react'
import { useWebSocket } from '@/contexts/WebSocketContext'

interface BlockedUser {
    id: string
    username: string
    blockedAt?: number
}

interface BlockedUsersModalProps {
    isOpen: boolean
    onClose: () => void
}

export function BlockedUsersModal({ isOpen, onClose }: BlockedUsersModalProps) {
    const { ws, unblockUser } = useWebSocket()
    const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [unblocking, setUnblocking] = useState<string | null>(null)

    // Fetch blocked users when modal opens
    useEffect(() => {
        if (isOpen && ws) {
            fetchBlockedUsers()

            // Listen for blocked users list response
            const handleMessage = (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data)
                    if (data.type === 'blocked_users_list') {
                        setBlockedUsers(data.blockedUsers || [])
                        setLoading(false)
                    } else if (data.type === 'user_unblocked' && data.success) {
                        // Remove unblocked user from list
                        setBlockedUsers(prev => prev.filter(u => u.id !== data.targetUserId))
                        setUnblocking(null)
                    } else if (data.type === 'error') {
                        setError(data.message)
                        setLoading(false)
                        setUnblocking(null)
                    }
                } catch (e) {
                    console.error('Failed to parse message:', e)
                }
            }

            ws.addEventListener('message', handleMessage)
            return () => ws.removeEventListener('message', handleMessage)
        }
    }, [isOpen, ws])

    const fetchBlockedUsers = () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            setLoading(true)
            setError(null)
            ws.send(JSON.stringify({ type: 'get_blocked_users' }))
        }
    }

    const handleUnblock = (userId: string) => {
        setUnblocking(userId)
        unblockUser(userId)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl w-full max-w-md m-4 max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-red-400" />
                        <h3 className="font-semibold text-white">Blocked Users</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchBlockedUsers}
                            disabled={loading}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin mb-2" />
                            <span>Loading blocked users...</span>
                        </div>
                    ) : error ? (
                        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    ) : blockedUsers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <Shield className="w-12 h-12 mb-3 opacity-50" />
                            <p className="text-lg font-medium">No blocked users</p>
                            <p className="text-sm">Users you block will appear here</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {blockedUsers.map((user) => (
                                <div
                                    key={user.id}
                                    className="flex items-center justify-between p-3 bg-slate-900 rounded-lg"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-semibold">
                                            {user.username.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-medium text-white">{user.username}</p>
                                            {user.blockedAt && (
                                                <p className="text-xs text-slate-500">
                                                    Blocked {new Date(user.blockedAt).toLocaleDateString()}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleUnblock(user.id)}
                                        disabled={unblocking === user.id}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {unblocking === user.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <UserMinus className="w-4 h-4" />
                                        )}
                                        <span className="text-sm">Unblock</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-700 flex-shrink-0">
                    <p className="text-xs text-slate-500 text-center">
                        Blocked users cannot send you messages or see your online status
                    </p>
                </div>
            </div>
        </div>
    )
}
