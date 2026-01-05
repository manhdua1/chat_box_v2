import { useEffect, useRef, useCallback } from 'react'
import { useWebSocket } from '@/contexts/WebSocketContext'
import { useCallStore } from '@/stores/callStore'

export function CallManager() {
    const {
        callId,
        remoteUserId,
        status,
        callType,
        setRemoteStream,
        setLocalStream,
        endCall
    } = useCallStore()

    const { sendSignal } = useWebSocket()

    const peerConnection = useRef<RTCPeerConnection | null>(null)
    const localStreamRef = useRef<MediaStream | null>(null)
    const isNegotiating = useRef(false)

    // Cleanup function
    const cleanup = useCallback(() => {
        console.log('🧹 Cleaning up WebRTC resources...')
        
        // Close peer connection
        if (peerConnection.current) {
            peerConnection.current.close()
            peerConnection.current = null
        }

        // Stop all tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                track.stop()
                console.log('Stopped track:', track.kind)
            })
            localStreamRef.current = null
        }

        // Clear streams from store
        setLocalStream(null)
        setRemoteStream(null)
        isNegotiating.current = false
    }, [setLocalStream, setRemoteStream])

    // Get local media stream (for callee before offer arrives)
    const getLocalStream = useCallback(async () => {
        if (localStreamRef.current) {
            console.log('⚠️ Local stream already exists')
            return localStreamRef.current
        }

        try {
            const constraints = {
                video: callType === 'video' || callType === undefined,
                audio: true
            }

            console.log('🎥 Requesting user media (pre-offer):', constraints)
            const stream = await navigator.mediaDevices.getUserMedia(constraints)
            
            localStreamRef.current = stream
            setLocalStream(stream)
            console.log('✅ Got local stream with tracks:', stream.getTracks().map(t => t.kind))
            return stream
        } catch (err) {
            console.error('❌ Failed to get local stream:', err)
            if (err instanceof Error) {
                if (err.name === 'NotAllowedError') {
                    alert('Camera/microphone access denied. Please allow access to continue.')
                } else if (err.name === 'NotFoundError') {
                    alert('No camera/microphone found. Please check your devices.')
                }
            }
            return null
        }
    }, [callType, setLocalStream])

    // Setup PeerConnection with proper error handling
    const setupPeerConnection = useCallback(async (isInitiator: boolean) => {
        if (peerConnection.current) {
            console.log('⚠️ PeerConnection already exists')
            return
        }

        if (isNegotiating.current) {
            console.log('⚠️ Already negotiating')
            return
        }

        isNegotiating.current = true
        console.log(`🔧 Setting up PeerConnection (initiator: ${isInitiator})`)

        try {
            const pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            })

            // Handle ICE candidates
            pc.onicecandidate = (event) => {
                if (event.candidate && remoteUserId && callId) {
                    console.log('🧊 Sending ICE candidate')
                    sendSignal(remoteUserId, 'webrtc_ice', {
                        callId,
                        candidate: JSON.stringify(event.candidate)
                    })
                }
            }

            // Handle incoming tracks
            pc.ontrack = (event) => {
                console.log('📺 Received remote track:', event.track.kind)
                setRemoteStream(event.streams[0])
            }

            // Handle connection state changes
            pc.onconnectionstatechange = () => {
                console.log('🔌 Connection state:', pc.connectionState)
                if (pc.connectionState === 'failed') {
                    console.error('❌ Connection failed')
                    endCall()
                }
            }

            // Handle ICE connection state
            pc.oniceconnectionstatechange = () => {
                console.log('🧊 ICE connection state:', pc.iceConnectionState)
                if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
                    console.error('❌ ICE connection failed')
                    endCall()
                }
            }

            // Get user media - reuse existing stream if available
            let stream = localStreamRef.current
            if (!stream) {
                const constraints = {
                    video: callType === 'video' || callType === undefined,
                    audio: true
                }

                console.log('🎥 Requesting user media:', constraints)
                stream = await navigator.mediaDevices.getUserMedia(constraints)
                
                localStreamRef.current = stream
                setLocalStream(stream)
                console.log('✅ Got local stream with tracks:', stream.getTracks().map(t => t.kind))
            } else {
                console.log('✅ Reusing existing local stream')
            }

            // Add tracks to peer connection
            stream.getTracks().forEach(track => {
                pc.addTrack(track, stream!)
                console.log('➕ Added track:', track.kind)
            })

            peerConnection.current = pc

            // If initiator, create and send offer
            if (isInitiator && remoteUserId && callId) {
                console.log('📤 Creating offer...')
                const offer = await pc.createOffer()
                await pc.setLocalDescription(offer)
                console.log('📤 Sending offer')
                
                sendSignal(remoteUserId, 'webrtc_offer', {
                    callId,
                    sdp: offer.sdp
                })
            }

            isNegotiating.current = false
            console.log('✅ PeerConnection setup complete')

        } catch (err) {
            console.error('❌ Failed to setup peer connection:', err)
            isNegotiating.current = false
            
            // Show user-friendly error
            if (err instanceof Error) {
                if (err.name === 'NotAllowedError') {
                    alert('Camera/microphone access denied. Please allow access to continue.')
                } else if (err.name === 'NotFoundError') {
                    alert('No camera/microphone found. Please check your devices.')
                } else {
                    alert('Failed to start call: ' + err.message)
                }
            }
            
            endCall()
        }
    }, [callId, remoteUserId, callType, sendSignal, setLocalStream, setRemoteStream, endCall])

    // Signal Listener with improved error handling
    useEffect(() => {
        const handleSignal = async (e: Event) => {
            const message = (e as CustomEvent).detail
            // Message format: { type: "webrtc_xxx", data: {...} }
            const signalType = message.type
            const data = message.data || message  // Extract nested data, fallback to message itself
            console.log('📨 Received WebRTC signal:', signalType, data)

            try {
                switch (signalType) {
                    case 'call_accepted':
                        // Caller receives this. Start negotiation.
                        console.log('✅ Call accepted, setting up connection...')
                        useCallStore.setState({ status: 'connected' })
                        await setupPeerConnection(true)
                        break

                    case 'call_incoming':
                        // Callee receives this
                        console.log('📞 Incoming call from:', data.callerId)
                        useCallStore.setState({
                            callId: data.callId,
                            remoteUserId: data.callerId,
                            status: 'ringing'
                        })
                        break

                    case 'call_rejected':
                        console.log('❌ Call rejected')
                        useCallStore.setState({ status: 'ended' })
                        cleanup()
                        break

                    case 'call_ended':
                        console.log('📴 Call ended')
                        useCallStore.setState({ status: 'ended' })
                        cleanup()
                        break

                    case 'webrtc_offer':
                        console.log('📥 Received offer')
                        if (!peerConnection.current) {
                            await setupPeerConnection(false)
                        }
                        if (peerConnection.current) {
                            await peerConnection.current.setRemoteDescription(
                                new RTCSessionDescription({ type: 'offer', sdp: data.sdp })
                            )
                            const answer = await peerConnection.current.createAnswer()
                            await peerConnection.current.setLocalDescription(answer)
                            console.log('📤 Sending answer')
                            sendSignal(data.from, 'webrtc_answer', { 
                                callId: data.callId, 
                                sdp: answer.sdp 
                            })
                        }
                        break

                    case 'webrtc_answer':
                        console.log('📥 Received answer')
                        if (peerConnection.current) {
                            await peerConnection.current.setRemoteDescription(
                                new RTCSessionDescription({ type: 'answer', sdp: data.sdp })
                            )
                        }
                        break

                    case 'webrtc_ice':
                        console.log('🧊 Received ICE candidate')
                        if (data.candidate && peerConnection.current) {
                            try {
                                await peerConnection.current.addIceCandidate(
                                    new RTCIceCandidate(JSON.parse(data.candidate))
                                )
                            } catch (err) {
                                console.error('Failed to add ICE candidate:', err)
                            }
                        }
                        break
                }
            } catch (err) {
                console.error('❌ WebRTC Error:', err)
                if (err instanceof Error) {
                    console.error('Error details:', err.message, err.stack)
                }
            }
        }

        window.addEventListener('webrtc-signal', handleSignal)
        console.log('👂 Started listening for WebRTC signals')
        
        return () => {
            window.removeEventListener('webrtc-signal', handleSignal)
            console.log('🔇 Stopped listening for WebRTC signals')
        }
    }, [sendSignal, setupPeerConnection, cleanup])

    // When callee accepts the call (status changes to connected), get local stream immediately
    // This ensures the local video shows before the offer arrives
    useEffect(() => {
        if (status === 'connected' && !localStreamRef.current) {
            console.log('📹 Status connected, getting local stream for callee...')
            getLocalStream()
        }
    }, [status, getLocalStream])

    // Cleanup on unmount or when call ends
    useEffect(() => {
        if (status === 'ended' || status === 'idle') {
            cleanup()
        }
    }, [status, cleanup])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup()
        }
    }, [cleanup])

    return null // Invisible component
}
