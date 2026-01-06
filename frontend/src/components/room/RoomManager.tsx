import { useState, useEffect } from 'react'
import { X, Plus, Hash, Lock, Users, Loader2, LogOut, Settings, MessageCircle } from 'lucide-react'
import { useWebSocket } from '@/contexts/WebSocketContext'
import { useChatStore } from '@/stores/chatStore'

interface RoomManagerProps {
    isOpen: boolean
    onClose: () => void
    onRoomSelect?: (roomId: string) => void
}

export function RoomManager({ isOpen, onClose, onRoomSelect }: RoomManagerProps) {
    console.log('🔍 RoomManager render, isOpen:', isOpen)
    
    let ws, rooms, createRoom, joinRoom, leaveRoom, currentRoomId, setCurrentRoomId
    let onlineUsers
    
    try {
        const wsContext = useWebSocket()
        ws = wsContext.ws
        rooms = wsContext.rooms
        createRoom = wsContext.createRoom
        joinRoom = wsContext.joinRoom
        leaveRoom = wsContext.leaveRoom
        currentRoomId = wsContext.currentRoomId
        setCurrentRoomId = wsContext.setCurrentRoomId
        
        const chatStore = useChatStore()
        onlineUsers = chatStore.onlineUsers
    } catch (error) {
        console.error('❌ Error in RoomManager hooks:', error)
        // Return early if hooks fail
        if (!isOpen) return null
        return (
            <div 
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
                onClick={onClose}
            >
                <div 
                    className="bg-red-900 rounded-xl border border-red-700 shadow-xl w-full max-w-lg m-4 p-6"
                    onClick={(e) => e.stopPropagation()}
                >
                    <h3 className="text-white text-xl font-bold mb-4">Error Loading Room Manager</h3>
                    <p className="text-red-200">{String(error)}</p>
                    <button 
                        onClick={onClose}
                        className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg"
                    >
                        Close
                    </button>
                </div>
            </div>
        )
    }
    
    const [activeTab, setActiveTab] = useState<'my-rooms' | 'create'>('my-rooms')
    const [loading, setLoading] = useState(false)
    
    // Create room state
    const [newRoomName, setNewRoomName] = useState('')
    const [newRoomType, setNewRoomType] = useState<'public' | 'private' | 'group'>('public')
    const [creating, setCreating] = useState(false)

    // Join room state
    const [joinRoomId, setJoinRoomId] = useState('')
    const [joining, setJoining] = useState(false)
    
    // Helper to get display name for DM rooms
    const getRoomDisplayName = (room: { roomId?: string; id?: string; roomName?: string; name?: string }) => {
        const id = room.roomId || room.id
        const name = room.roomName || room.name
        
        if (!room || !id) return 'Unknown Room'
        if (id.startsWith('dm_')) {
            const targetUserId = id.replace('dm_', '')
            const targetUser = onlineUsers?.find(u => u.userId === targetUserId)
            return targetUser?.username || `User ${targetUserId.slice(0, 8)}`
        }
        return name || 'Unnamed Room'
    }
    
    // Check if room is DM
    const isDmRoom = (roomId: string) => {
        if (!roomId) return false
        return roomId.startsWith('dm_')
    }

    useEffect(() => {
        if (isOpen && ws) {
            // Fetch rooms when modal opens
            fetchRooms()

            // Listen for room responses
            const handleMessage = (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data)
                    console.log('📨 RoomManager received message:', data.type, data)
                    
                    if (data.type === 'room_created') {
                        console.log('✅ Room created successfully')
                        setCreating(false)
                        setNewRoomName('')
                        setActiveTab('my-rooms')
                        fetchRooms() // Refresh room list
                    } else if (data.type === 'room_joined') {
                        console.log('✅ Room joined successfully')
                        setJoining(false)
                        setJoinRoomId('')
                        setActiveTab('my-rooms')
                        fetchRooms() // Refresh room list
                    } else if (data.type === 'room_left') {
                        console.log('✅ Room left successfully')
                        fetchRooms() // Refresh room list
                    } else if (data.type === 'room_list') {
                        console.log('📋 Room list received:', data.rooms?.length || 0, 'rooms')
                        setLoading(false)
                    } else if (data.type === 'error') {
                        console.error('❌ Room error:', data.message)
                        setCreating(false)
                        setJoining(false)
                        alert('Error: ' + data.message)
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

        console.log('🏗️ Creating room:', newRoomName.trim(), 'Type:', newRoomType)
        setCreating(true)
        createRoom(newRoomName.trim(), newRoomType)
        
        // Auto reset after 5 seconds if no response
        setTimeout(() => {
            setCreating(false)
        }, 5000)
    }

    const handleJoinRoom = (e: React.FormEvent) => {
        e.preventDefault()
        if (!joinRoomId.trim()) return

        console.log('🚪 Joining room:', joinRoomId.trim())
        setJoining(true)
        joinRoom(joinRoomId.trim())
        
        // Auto reset after 5 seconds if no response
        setTimeout(() => {
            setJoining(false)
        }, 5000)
    }

    const handleLeaveRoom = (roomId: string) => {
        if (roomId === 'global') return // Can't leave global room
        leaveRoom(roomId)
        if (currentRoomId === roomId) {
            setCurrentRoomId('global')
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
        <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={onClose}
        >
            <div 
                className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl w-full max-w-lg m-4 max-h-[80vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
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
                                rooms.filter(room => room && ((room as any).roomId || (room as any).id)).map((room) => {
                                    const roomId = (room as any).roomId || (room as any).id || ''
                                    const roomName = (room as any).roomName || (room as any).name || ''
                                    
                                    return (
                                    <div
                                        key={roomId}
                                        className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                                            currentRoomId === roomId
                                                ? 'bg-purple-500/20 border border-purple-500/50'
                                                : 'bg-slate-900 hover:bg-slate-700'
                                        }`}
                                    >
                                        <button
                                            onClick={() => handleSelectRoom(roomId)}
                                            className="flex items-center gap-3 flex-1 text-left"
                                        >
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                                roomId === 'global' 
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : isDmRoom(roomId)
                                                        ? 'bg-pink-500/20 text-pink-400'
                                                        : 'bg-purple-500/20 text-purple-400'
                                            }`}>
                                                {isDmRoom(roomId) ? <MessageCircle className="w-4 h-4" /> : getRoomIcon(roomId === 'global' ? 'public' : 'group')}
                                            </div>
                                            <div>
                                                <p className="font-medium text-white">{roomName || getRoomDisplayName(room)}</p>
                                                <p className="text-xs text-slate-500">
                                                    {roomId === 'global' ? 'Public' : isDmRoom(roomId) ? 'Direct Message' : 'Room ID: ' + roomId.slice(0, 8)}
                                                </p>
                                            </div>
                                        </button>
                                        
                                        {roomId !== 'global' && (
                                            <button
                                                onClick={() => handleLeaveRoom(roomId)}
                                                className="p-2 text-slate-400 hover:text-yellow-400 hover:bg-yellow-400/10 rounded-lg transition-colors"
                                                title="Leave room"
                                            >
                                                <LogOut className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                )})
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
                                        {(['public', 'private'] as const).map((type) => (
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
