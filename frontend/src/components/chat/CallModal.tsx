import { useEffect, useRef } from 'react'
import { Phone, PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff } from 'lucide-react'
import { useCallStore } from '@/stores/callStore'
import { useWebSocket } from '@/contexts/WebSocketContext'

export function CallModal() {
    const {
        isIncoming,
        isCalling,
        status,
        remoteStream,
        localStream,
        remoteUserId,
        remoteUserName,
        callId,
        acceptCall,
        rejectCall,
        endCall,
        toggleAudio,
        toggleVideo,
        isAudioEnabled,
        isVideoEnabled
    } = useCallStore()

    const { acceptIncomingCall, rejectIncomingCall, endCurrentCall } = useWebSocket()

    const localVideoRef = useRef<HTMLVideoElement>(null)
    const remoteVideoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            console.log('🎥 Setting local video stream:', localStream.getTracks().map(t => t.kind));
            localVideoRef.current.srcObject = localStream
        }
    }, [localStream])

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            console.log('📺 Setting remote video stream:', remoteStream.getTracks().map(t => t.kind));
            remoteVideoRef.current.srcObject = remoteStream
        }
    }, [remoteStream])

    // Debug log for streams
    useEffect(() => {
        console.log('📊 CallModal streams - local:', !!localStream, 'remote:', !!remoteStream, 'status:', status);
    }, [localStream, remoteStream, status])

    const handleAccept = () => {
        if (callId && remoteUserId) {
            acceptIncomingCall(callId, remoteUserId)
            acceptCall() // Updates store state
        }
    }

    const handleReject = () => {
        if (callId && remoteUserId) {
            rejectIncomingCall(callId, remoteUserId)
            rejectCall()
        }
    }

    const handleEnd = () => {
        // For caller (status === 'calling'), callId might not be set yet
        // We still need to end the call
        if (remoteUserId) {
            endCurrentCall(callId || '', remoteUserId)
        }
        endCall()
    }

    const handleCancel = () => {
        // Cancel outgoing call before it's answered
        if (remoteUserId) {
            endCurrentCall(callId || '', remoteUserId)
        }
        endCall()
    }

    if (!isIncoming && !isCalling && status === 'idle') return null

    const displayName = remoteUserName || remoteUserId || 'Unknown'

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[80vh] relative shadow-2xl border border-slate-700">

                {/* Status Header */}
                <div className="absolute top-4 left-0 right-0 z-10 text-center">
                    <div className="inline-block bg-black/50 px-4 py-1 rounded-full text-white backdrop-blur">
                        {status === 'ringing' && `📞 Incoming call from ${displayName}`}
                        {status === 'calling' && `📞 Calling ${displayName}...`}
                        {status === 'connected' && `🟢 Connected with ${displayName}`}
                    </div>
                </div>

                {/* Video Area */}
                <div className="flex-1 relative bg-black flex items-center justify-center">
                    {/* Remote Video */}
                    {status === 'connected' && (
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-contain"
                        />
                    )}

                    {/* Local Video (PiP) */}
                    {(status === 'connected' || status === 'calling') && (
                        <div className="absolute top-4 right-4 w-48 h-36 bg-slate-800 rounded-lg overflow-hidden border-2 border-slate-700 shadow-lg">
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover transform scale-x-[-1]"
                            />
                        </div>
                    )}

                    {/* Placeholder Avatar if no video */}
                    {status !== 'connected' && (
                        <div className="flex flex-col items-center animate-pulse">
                            <div className="w-24 h-24 bg-purple-600 rounded-full flex items-center justify-center text-4xl mb-4">
                                {displayName[0]?.toUpperCase()}
                            </div>
                            <p className="text-white text-lg">{displayName}</p>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="h-20 bg-slate-800 flex items-center justify-center gap-6">
                    {status === 'ringing' ? (
                        // Incoming call - show accept/reject
                        <>
                            <button
                                onClick={handleAccept}
                                className="w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white transition animate-bounce"
                            >
                                <Phone size={24} />
                            </button>
                            <button
                                onClick={handleReject}
                                className="w-14 h-14 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition"
                            >
                                <PhoneOff size={24} />
                            </button>
                        </>
                    ) : status === 'calling' ? (
                        // Outgoing call - show cancel button
                        <button
                            onClick={handleCancel}
                            className="w-14 h-14 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center text-white transition"
                            title="Cancel Call"
                        >
                            <PhoneOff size={24} />
                        </button>
                    ) : (
                        // Connected - show all controls
                        <>
                            <button
                                onClick={toggleAudio}
                                className={`w-12 h-12 rounded-full flex items-center justify-center text-white transition ${isAudioEnabled ? 'bg-slate-700 hover:bg-slate-600' : 'bg-red-500 hover:bg-red-600'}`}
                                title={isAudioEnabled ? 'Mute' : 'Unmute'}
                            >
                                {isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                            </button>
                            <button
                                onClick={handleEnd}
                                className="w-14 h-14 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center text-white transition"
                                title="End Call"
                            >
                                <PhoneOff size={24} />
                            </button>
                            <button
                                onClick={toggleVideo}
                                className={`w-12 h-12 rounded-full flex items-center justify-center text-white transition ${isVideoEnabled ? 'bg-slate-700 hover:bg-slate-600' : 'bg-red-500 hover:bg-red-600'}`}
                                title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                            >
                                {isVideoEnabled ? <VideoIcon size={20} /> : <VideoOff size={20} />}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
