// WebSocket client for JSON protocol communication with C++ backend

// Auto-detect WebSocket URL based on current page URL
const getWebSocketUrl = (): string => {
    const { protocol, hostname } = window.location;
    
    // VS Code Port Forwarding: hostname contains devtunnels.ms
    if (hostname.includes('devtunnels.ms')) {
        const wsHost = hostname.replace(/-\d+\./, '-8080.');
        return `wss://${wsHost}`;
    }
    
    // Local/LAN: use same host with port 8080
    const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${hostname}:8080`;
};

export const WS_URL = getWebSocketUrl()

export interface Message {
    messageId: string
    roomId: string
    userId: string
    username: string
    content: string
    timestamp: number
    isHistory?: boolean
}

interface RegisterMessage {
    type: 'register'
    username: string
    password: string
    email?: string
}

interface LoginMessage {
    type: 'login'
    username: string
    password: string
}

interface ChatMessage {
    type: 'chat'
    content: string
    roomId: string
}

interface RegisterResponse {
    type: 'register_response'
    success: boolean
    message: string
}

interface LoginResponse {
    type: 'login_response'
    success: boolean
    token?: string
    userId?: string
    username?: string
    message: string
}

interface HistoryResponse {
    type: 'history'
    roomId: string
    messages: Message[]
}

interface ChatResponse {
    type: 'chat'
    messageId: string
    roomId: string
    userId: string
    username: string
    content: string
    timestamp: number
}

interface ErrorResponse {
    type: 'error'
    message: string
}

type ServerMessage = RegisterResponse | LoginResponse | HistoryResponse | ChatResponse | ErrorResponse

type MessageHandler = (data: any) => void

export class WebSocketClient {
    private ws: WebSocket | null = null
    private messageHandlers: Map<string, MessageHandler[]> = new Map()
    private reconnectAttempts = 0
    private maxReconnectAttempts = 5
    private reconnectDelay = 1000
    private isIntentionallyClosed = false

    connect() {
        if (this.ws?.readyState === WebSocket.OPEN) {
            console.log('✅ WebSocket already connected')
            return
        }

        this.isIntentionallyClosed = false
        this.ws = new WebSocket(WS_URL)

        this.ws.onopen = () => {
            console.log('✅ WebSocket connected to', WS_URL)
            this.reconnectAttempts = 0
            this.emit('connected', {})
        }

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                console.log('📥 Received:', data.type, data)
                this.handleMessage(data)
            } catch (error) {
                console.error('❌ Failed to parse message:', error)
            }
        }

        this.ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error)
            this.emit('error', { error })
        }

        this.ws.onclose = () => {
            console.log('🔌 WebSocket disconnected')
            this.emit('disconnected', {})

            if (!this.isIntentionallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++
                const delay = this.reconnectDelay * this.reconnectAttempts
                console.log(`⏳ Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts})`)

                setTimeout(() => {
                    this.connect()
                }, delay)
            }
        }
    }

    disconnect() {
        this.isIntentionallyClosed = true
        if (this.ws) {
            this.ws.close()
            this.ws = null
        }
    }

    // Send messages
    register(username: string, password: string, email?: string) {
        const message: RegisterMessage = {
            type: 'register',
            username,
            password,
            email: email || `${username}@chatbox.local`
        }
        return this.send(message)
    }

    login(username: string, password: string) {
        const message: LoginMessage = {
            type: 'login',
            username,
            password
        }
        return this.send(message)
    }

    sendChat(content: string, roomId: string = 'global') {
        const message: ChatMessage = {
            type: 'chat',
            content,
            roomId
        }
        return this.send(message)
    }

    private send(message: any): boolean {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('❌ WebSocket not connected')
            return false
        }

        try {
            const json = JSON.stringify(message)
            this.ws.send(json)
            console.log('📤 Sent:', message.type, message)
            return true
        } catch (error) {
            console.error('❌ Failed to send message:', error)
            return false
        }
    }

    // Event handlers
    on(messageType: string, handler: MessageHandler) {
        if (!this.messageHandlers.has(messageType)) {
            this.messageHandlers.set(messageType, [])
        }
        this.messageHandlers.get(messageType)!.push(handler)
    }

    off(messageType: string, handler: MessageHandler) {
        const handlers = this.messageHandlers.get(messageType)
        if (handlers) {
            const index = handlers.indexOf(handler)
            if (index > -1) {
                handlers.splice(index, 1)
            }
        }
    }

    private emit(messageType: string, data: any) {
        const handlers = this.messageHandlers.get(messageType)
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data)
                } catch (error) {
                    console.error('❌ Error in message handler:', error)
                }
            })
        }
    }

    private handleMessage(data: ServerMessage) {
        const { type } = data
        this.emit(type, data)
    }

    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN
    }

    getConnectionState(): 'connected' | 'connecting' | 'disconnected' {
        if (!this.ws) return 'disconnected'

        switch (this.ws.readyState) {
            case WebSocket.OPEN:
                return 'connected'
            case WebSocket.CONNECTING:
                return 'connecting'
            default:
                return 'disconnected'
        }
    }
}

// Singleton instance
export const wsClient = new WebSocketClient()
