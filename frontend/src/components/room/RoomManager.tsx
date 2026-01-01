import { useState, useEffect } from 'react'
import { X, Plus, Hash, Lock, Users, Loader2, Trash2, LogOut, Settings } from 'lucide-react'
import { useWebSocket } from '@/contexts/WebSocketContext'

interface RoomManagerProps {
    isOpen: boolean
    onClose: () => void
    onRoomSelect?: (roomId: string) => void
}

export function RoomManager({ isOpen, onClose, onRoomSelect }: RoomManagerProps) {
    const { ws, rooms, createRoom, joinRoom, leaveRoom, deleteRoom, currentRoomId, setCurrentRoomId } = useWebSocket()
    
    const [activeTab, setActiveTab] = useState<'my-rooms' | 'create'>('my-rooms')
    const [loading, setLoading] = useState(false)
    
    // Create room state
    const [newRoomName, setNewRoomName] = useState('')
    const [newRoomType, setNewRoomType] = useState<'public' | 'private' | 'group'>('public')
    const [creating, setCreating] = useState(false)

    // Join room state
    const [joinRoomId, setJoinRoomId] = useState('')
    const [joining, setJoining] = useState(false)

    useEffect(() => {
        if (isOpen && ws) {
            // Fetch rooms when modal opens
            fetchRooms()

            // Listen for room responses
            const handleMessage = (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data)
                    if (data.type === 'room_created') {
                        setCreating(false)
                        setNewRoomName('')
                        setActiveTab('my-rooms')
                    } else if (data.type === 'room_joined') {
                        setJoining(false)
                        setJoinRoomId('')
                    } else if (data.type === 'room_left') {
                        // Room left successfully
                    } else if (data.type === 'room_list') {
                        setLoading(false)
                    }
                } catch (e) {
                    console.error('Failed to parse message:', e)
                }
            }

            ws.addEventListener('message', handleMessage)
            return () => ws.removeEventListener('message', handleMessage)
        }
    }, [isOpen, ws])

    const fetchRooms = () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            setLoading(true)
            ws.send(JSON.stringify({ type: 'get_rooms' }))
        }
    }

    const handleCreateRoom = (e: React.FormEvent) => {
        e.preventDefault()
        if (!newRoomName.trim()) return

        setCreating(true)
        createRoom(newRoomName.trim(), newRoomType)
    }

    const handleJoinRoom = (e: React.FormEvent) => {
        e.preventDefault()
        if (!joinRoomId.trim()) return

        setJoining(true)
        joinRoom(joinRoomId.trim())
    }

    const handleLeaveRoom = (roomId: string) => {
        if (roomId === 'global') return // Can't leave global room
        leaveRoom(roomId)
        if (currentRoomId === roomId) {
            setCurrentRoomId('global')
        }
    }

    const handleDeleteRoom = (roomId: string) => {
        if (roomId === 'global') return
        if (confirm('Are you sure you want to delete this room?')) {
            deleteRoom(roomId)
            if (currentRoomId === roomId) {
                setCurrentRoomId('global')
            }
        }
    }

    const handleSelectRoom = (roomId: string) => {
        if (onRoomSelect) {
            onRoomSelect(roomId)
        } else {
            setCurrentRoomId(roomId)
        }
        onClose()
    }

    const getRoomIcon = (type?: string) => {
        switch (type) {
            case 'private':
                return <Lock className="w-4 h-4" />
            case 'group':
                return <Users className="w-4 h-4" />
            default:
                return <Hash className="w-4 h-4" />
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl w-full max-w-lg m-4 max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-purple-400" />
                        <h3 className="font-semibold text-white">Room Manager</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-700 flex-shrink-0">
                    <button
                        onClick={() => setActiveTab('my-rooms')}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                            activeTab === 'my-rooms'
                                ? 'text-purple-400 border-b-2 border-purple-400'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        My Rooms
                    </button>
                    <button
                        onClick={() => setActiveTab('create')}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                            activeTab === 'create'
                                ? 'text-purple-400 border-b-2 border-purple-400'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        Create / Join
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {activeTab === 'my-rooms' ? (
                        <div className="space-y-2">
                            {loading ? (
                                <div className="flex items-center justify-center py-8 text-slate-400">
                                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                                    <span>Loading rooms...</span>
                                </div>
                            ) : rooms.length === 0 ? (
                                <div className="text-center py-8 text-slate-400">
                                    <Hash className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>No rooms yet</p>
                                    <p className="text-sm">Create or join a room to get started</p>
                                </div>
                            ) : (
                                rooms.map((room) => (
                                    <div
                                        key={room.id}
                                        className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                                            currentRoomId === room.id
                                                ? 'bg-purple-500/20 border border-purple-500/50'
                                                : 'bg-slate-900 hover:bg-slate-700'
                                        }`}
                                    >
                                        <button
                                            onClick={() => handleSelectRoom(room.id)}
                                            className="flex items-center gap-3 flex-1 text-left"
                                        >
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                                room.id === 'global' 
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : 'bg-purple-500/20 text-purple-400'
                                            }`}>
                                                {getRoomIcon(room.id === 'global' ? 'public' : 'group')}
                                            </div>
                                            <div>
                                                <p className="font-medium text-white">{room.name}</p>
                                                <p className="text-xs text-slate-500">
                                                    {room.id === 'global' ? 'Public' : 'Room ID: ' + room.id.slice(0, 8)}
                                                </p>
                                            </div>
                                        </button>
                                        
                                        {room.id !== 'global' && (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleLeaveRoom(room.id)}
                                                    className="p-2 text-slate-400 hover:text-yellow-400 hover:bg-yellow-400/10 rounded-lg transition-colors"
                                                    title="Leave room"
                                                >
                                                    <LogOut className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteRoom(room.id)}
                                                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                                    title="Delete room"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Create Room */}
                            <div>
                                <h4 className="text-sm font-medium text-slate-300 mb-3">Create New Room</h4>
                                <form onSubmit={handleCreateRoom} className="space-y-3">
                                    <input
                                        type="text"
                                        value={newRoomName}
                                        onChange={(e) => setNewRoomName(e.target.value)}
                                        placeholder="Room name"
                                        className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none"
                                    />
                                    <div className="flex gap-2">
                                        {(['public', 'private', 'group'] as const).map((type) => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setNewRoomType(type)}
                                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                                                    newRoomType === type
                                                        ? 'bg-purple-500 text-white'
                                                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                                }`}
                                            >
                                                {type === 'public' && <Hash className="w-4 h-4" />}
                                                {type === 'private' && <Lock className="w-4 h-4" />}
                                                {type === 'group' && <Users className="w-4 h-4" />}
                                                <span className="capitalize text-sm">{type}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={!newRoomName.trim() || creating}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/50 text-white rounded-lg transition-colors"
                                    >
                                        {creating ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Plus className="w-4 h-4" />
                                        )}
                                        <span>Create Room</span>
                                    </button>
                                </form>
                            </div>

                            {/* Divider */}
                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-px bg-slate-700"></div>
                                <span className="text-slate-500 text-sm">or</span>
                                <div className="flex-1 h-px bg-slate-700"></div>
                            </div>

                            {/* Join Room */}
                            <div>
                                <h4 className="text-sm font-medium text-slate-300 mb-3">Join Existing Room</h4>
                                <form onSubmit={handleJoinRoom} className="space-y-3">
                                    <input
                                        type="text"
                                        value={joinRoomId}
                                        onChange={(e) => setJoinRoomId(e.target.value)}
                                        placeholder="Enter room ID"
                                        className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!joinRoomId.trim() || joining}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-500/50 text-white rounded-lg transition-colors"
                                    >
                                        {joining ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Users className="w-4 h-4" />
                                        )}
                                        <span>Join Room</span>
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
