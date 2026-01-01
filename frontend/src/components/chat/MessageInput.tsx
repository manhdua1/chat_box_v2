import { useState, useRef, useEffect } from 'react'
import { Send, Smile, Paperclip, Sticker, MapPin } from 'lucide-react'
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react'
import { useWebSocket } from '@/contexts/WebSocketContext'
import { useFileUpload } from '@/hooks/useFileUpload'
import { CommandMenu } from './CommandMenu'
import { UploadProgressBar } from './UploadProgressBar'
import { VoiceRecorder } from './VoiceRecorder'
import { StickerPicker } from './StickerPicker'
import { LocationPicker } from './LocationPicker'

interface MessageInputProps {
    onSend?: (content: string, metadata?: any) => void
}

export function MessageInput({ onSend }: MessageInputProps) {
    const [message, setMessage] = useState('')
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)
    const [showStickerPicker, setShowStickerPicker] = useState(false)
    const [showLocationPicker, setShowLocationPicker] = useState(false)
    const [showCommandMenu, setShowCommandMenu] = useState(false)
    const [commandFilter, setCommandFilter] = useState('')
    const [isRecording, setIsRecording] = useState(false)

    const { sendMessage, isConnected, sendTypingStatus, currentRoomId, ws, sendSticker, sendLocation } = useWebSocket()
    const {
        filePreview,
        uploadProgress,
        isUploading,
        uploadError,
        handleFileSelect,
        cancelPreview,
        uploadFile
    } = useFileUpload(ws || undefined, currentRoomId)

    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
    const inputRef = useRef<HTMLInputElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const uploadTriggeredRef = useRef(false)

    // Auto-upload file when selected
    useEffect(() => {
        if (filePreview && !isUploading && !uploadTriggeredRef.current) {
            uploadTriggeredRef.current = true
            console.log('🔥 Triggering upload for:', filePreview.file.name)
            uploadFile((content, metadata) => {
                // Send file message via WebSocket
                console.log('📨 Sending file message:', content, metadata)
                sendMessage(currentRoomId, content, metadata)
                // Reset file input
                if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                }
            })
        }
        // Reset when filePreview is cleared
        if (!filePreview) {
            uploadTriggeredRef.current = false
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }, [filePreview, isUploading, uploadFile, sendMessage, currentRoomId])

    const handleChange = (value: string) => {
        setMessage(value)

        // Command Menu Logic
        if (value.startsWith('/')) {
            setShowCommandMenu(true)
            setCommandFilter(value)
        } else {
            setShowCommandMenu(false)
        }

        // Start typing
        if (value && isConnected) {
            sendTypingStatus(true)

            // Clear previous timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current)
            }

            // Stop typing after 2 seconds of inactivity
            typingTimeoutRef.current = setTimeout(() => {
                sendTypingStatus(false)
            }, 2000)
        } else if (!value) {
            sendTypingStatus(false)
        }
    }

    const handleCommandSelect = (template: string) => {
        setMessage(template)
        setShowCommandMenu(false)
        inputRef.current?.focus()
    }

    const handleEmojiClick = (emojiData: EmojiClickData) => {
        const newMessage = message + emojiData.emoji
        setMessage(newMessage)
        setShowEmojiPicker(false)
        inputRef.current?.focus()
    }

    const handleStickerSelect = (sticker: string) => {
        sendSticker(sticker, currentRoomId)
        setShowStickerPicker(false)
    }

    const handleLocationSelect = (latitude: number, longitude: number, _locationName?: string) => {
        sendLocation(latitude, longitude, currentRoomId)
        setShowLocationPicker(false)
    }

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current)
            }
        }
    }, [])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        if (!message.trim() || !isConnected) return

        // Stop typing indicator
        sendTypingStatus(false)

        sendMessage(currentRoomId, message.trim())
        setMessage('')

        if (onSend) {
            onSend(message.trim())
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit(e)
        }
    }

    return (
        <div className="p-4 border-t border-slate-700 bg-slate-800">
            {isRecording ? (
                <VoiceRecorder
                    onRecordingComplete={(audioBlob, duration) => {
                        // Create URL for potential future use
                        URL.createObjectURL(audioBlob);
                        // Auto-upload voice or just send blob?
                        // For now we assume handler exists or we upload
                        // If we need upload, we should use useFileUpload logic or specialized voice upload
                        // Simulating send for now as per ChatArea logic

                        if (onSend) {
                            onSend(`🎤 Voice message (${duration}s)`, {
                                type: 'voice',
                                blob: audioBlob,
                                duration
                            })
                        } else {
                            // Fallback if no onSend, but usually ChatArea handles it
                            // Actually useFileUpload has onComplete. 
                            // We might need to upload here manually if useFileUpload doesn't support blob directly
                        }
                        setIsRecording(false)
                    }}
                    onCancel={() => setIsRecording(false)}
                />
            ) : (
                <>
                    {/* Upload Progress Bar */}
                    <UploadProgressBar
                        fileName={filePreview?.file.name || ''}
                        fileSize={filePreview?.file.size || 0}
                        progress={uploadProgress}
                        isUploading={isUploading}
                        error={uploadError}
                        onCancel={cancelPreview}
                    />

                    <form onSubmit={handleSubmit} className="flex items-center gap-3">
                        <div className="flex-1 relative">
                            {/* Command Menu */}
                            <CommandMenu
                                isOpen={showCommandMenu}
                                filter={commandFilter}
                                onSelect={handleCommandSelect}
                                onClose={() => setShowCommandMenu(false)}
                                position="top"
                            />

                            <input
                                ref={inputRef}
                                type="text"
                                value={message}
                                onChange={(e) => handleChange(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={isConnected ? "Type a message... (Try / for commands)" : "Connecting..."}
                                disabled={!isConnected}
                                className="w-full pl-12 pr-12 py-3 bg-slate-900 text-white rounded-xl border border-slate-700 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            />

                            {/* File Upload Button */}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-400 transition-colors"
                                title="Attach file"
                                disabled={!isConnected}
                            >
                                <Paperclip className="w-5 h-5" />
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                className="hidden"
                                accept="*/*"
                            />

                            {/* Action buttons row */}
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                {/* Sticker button */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowStickerPicker(!showStickerPicker)
                                        setShowEmojiPicker(false)
                                        setShowLocationPicker(false)
                                    }}
                                    className="text-slate-400 hover:text-purple-400 transition-colors p-1"
                                    title="Send sticker"
                                >
                                    <Sticker className="w-4 h-4" />
                                </button>

                                {/* Location button */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowLocationPicker(!showLocationPicker)
                                        setShowEmojiPicker(false)
                                        setShowStickerPicker(false)
                                    }}
                                    className="text-slate-400 hover:text-purple-400 transition-colors p-1"
                                    title="Share location"
                                >
                                    <MapPin className="w-4 h-4" />
                                </button>

                                {/* Emoji button */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowEmojiPicker(!showEmojiPicker)
                                        setShowStickerPicker(false)
                                        setShowLocationPicker(false)
                                    }}
                                    className="text-slate-400 hover:text-purple-400 transition-colors p-1"
                                    title="Add emoji"
                                >
                                    <Smile className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Emoji picker popup */}
                            {showEmojiPicker && (
                                <div className="absolute bottom-full right-0 mb-2 z-50">
                                    <EmojiPicker
                                        onEmojiClick={handleEmojiClick}
                                        theme={Theme.DARK}
                                        width={350}
                                        height={400}
                                    />
                                </div>
                            )}

                            {/* Sticker picker popup */}
                            {showStickerPicker && (
                                <div className="absolute bottom-full right-0 mb-2 z-50">
                                    <StickerPicker
                                        isOpen={showStickerPicker}
                                        onSelectSticker={handleStickerSelect}
                                        onClose={() => setShowStickerPicker(false)}
                                    />
                                </div>
                            )}

                            {/* Location picker popup */}
                            {showLocationPicker && (
                                <div className="absolute bottom-full right-0 mb-2 z-50">
                                    <LocationPicker
                                        isOpen={showLocationPicker}
                                        onSelectLocation={handleLocationSelect}
                                        onClose={() => setShowLocationPicker(false)}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Voice Button */}
                        <button
                            type="button"
                            onClick={() => setIsRecording(true)}
                            className="p-3 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                            title="Record Voice"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                            </svg>
                        </button>

                        <button
                            type="submit"
                            disabled={!message.trim() || !isConnected}
                            className="px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg"
                        >
                            <Send className="w-5 h-5" />
                            <span className="font-medium">Send</span>
                        </button>
                    </form>

                    <div className="mt-2 text-xs text-slate-500">
                        Press <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300">Enter</kbd> to send
                    </div>
                </>
            )}
        </div>
    )
}
