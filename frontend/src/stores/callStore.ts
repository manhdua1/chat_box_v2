import { create } from 'zustand'

interface CallState {
    isCalling: boolean
    isIncoming: boolean
    isVideoEnabled: boolean
    isAudioEnabled: boolean
    callId: string | null
    remoteUserId: string | null
    remoteUserName: string | null
    callType: 'audio' | 'video' | null
    remoteStream: MediaStream | null
    localStream: MediaStream | null
    status: 'idle' | 'calling' | 'ringing' | 'connected' | 'ended'

    // Actions
    startCall: (targetId: string, targetName: string, type: 'audio' | 'video') => void
    receiveCall: (callId: string, callerId: string, callerName?: string, type?: 'audio' | 'video') => void
    callAccepted: (callId: string) => void
    acceptCall: () => void
    rejectCall: () => void
    endCall: () => void
    toggleVideo: () => void
    toggleAudio: () => void
    setRemoteStream: (stream: MediaStream | null) => void
    setLocalStream: (stream: MediaStream | null) => void
    reset: () => void
}

export const useCallStore = create<CallState>((set, get) => ({
    isCalling: false,
    isIncoming: false,
    isVideoEnabled: true,
    isAudioEnabled: true,
    callId: null,
    remoteUserId: null,
    remoteUserName: null,
    callType: null,
    remoteStream: null,
    localStream: null,
    status: 'idle',

    startCall: (targetId, targetName, type = 'video') => set({
        isCalling: true,
        remoteUserId: targetId,
        remoteUserName: targetName || 'Unknown',
        callType: type,
        isVideoEnabled: type === 'video',
        status: 'calling'
    }),

    receiveCall: (callId, callerId, callerName = 'Unknown', type = 'video') => set({
        isIncoming: true,
        callId,
        remoteUserId: callerId,
        remoteUserName: callerName,
        callType: type,
        isVideoEnabled: type === 'video',
        status: 'ringing'
    }),

    callAccepted: (callId) => set({
        callId,
        status: 'connected'
    }),

    acceptCall: () => set({
        isIncoming: false,
        status: 'connected'
    }),

    rejectCall: () => set({
        isIncoming: false,
        callId: null,
        remoteUserId: null,
        status: 'idle'
    }),

    endCall: () => {
        const { localStream, remoteStream: _remoteStream } = get()
        // Stop tracks
        localStream?.getTracks().forEach(track => track.stop())
        // Remote stream tracks are stopped by peer usually, but good practice to clear ref

        set({
            isCalling: false,
            isIncoming: false,
            callId: null,
            remoteUserId: null,
            localStream: null,
            remoteStream: null,
            status: 'ended'
        })

        // Reset to idle after short delay/animation
        setTimeout(() => get().reset(), 1000)
    },

    toggleVideo: () => {
        const { isVideoEnabled, localStream } = get()
        if (localStream) {
            localStream.getVideoTracks().forEach(track => track.enabled = !isVideoEnabled)
        }
        set({ isVideoEnabled: !isVideoEnabled })
    },

    toggleAudio: () => {
        const { isAudioEnabled, localStream } = get()
        if (localStream) {
            localStream.getAudioTracks().forEach(track => track.enabled = !isAudioEnabled)
        }
        set({ isAudioEnabled: !isAudioEnabled })
    },

    setRemoteStream: (stream) => set({ remoteStream: stream }),
    setLocalStream: (stream) => set({ localStream: stream }),

    reset: () => set({
        isCalling: false,
        isIncoming: false,
        callId: null,
        remoteUserId: null,
        remoteUserName: null,
        callType: null,
        localStream: null,
        remoteStream: null,
        status: 'idle',
        isVideoEnabled: true,
        isAudioEnabled: true
    })
}))
