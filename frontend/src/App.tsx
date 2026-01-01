import { useState, useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import ChatArea from './components/layout/ChatArea';
import RightPanel from './components/layout/RightPanel';
import LoginPage from './components/auth/LoginPage';
import { useWebSocket } from './contexts/WebSocketContext';
import { CallManager } from './components/chat/CallManager';
import { CallModal } from './components/chat/CallModal';

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [currentRoom, setCurrentRoom] = useState<string | null>(null);
    const [showRightPanel, setShowRightPanel] = useState(true);
    const [activeTab, setActiveTab] = useState<'rooms' | 'users'>('rooms');

    const {
        connected,
        messages,
        rooms,
        users,
        polls,
        sendMessage,
        joinRoom,
        leaveRoom,
        deleteRoom,
        createRoom,
        editMessage,
        deleteMessage,
        addReaction,
        login,
        register,
        startCall,
        // New feature hooks
        typingUsers,
        aiMessages,
        aiLoading,
        sendAIMessage,
        clearAIMessages,
        createPoll,
        votePoll,
        inviteGame,
        watchSession,
        createWatchSession,
        syncWatch,
        endWatchSession,
        myPresence,
        updatePresence,
        updateProfile,
        // Message actions
        pinMessage,
        replyMessage,
        forwardMessage,
        // User management
        blockUser,
        kickUser,
        // Special message types
        sendSticker: _sendSticker,
        sendLocation: _sendLocation,
        setCurrentRoomId,
        unpinMessage
    } = useWebSocket();

    useEffect(() => {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        if (token && user) {
            setIsAuthenticated(true);
            setCurrentUser(JSON.parse(user));
            // Don't auto-select any room - let user choose
            setCurrentRoom(null);
        }
    }, []);

    // Debug: log messages state
    useEffect(() => {
        console.log('📊 Messages state updated:', messages);
        console.log('📊 Current room:', currentRoom);
        console.log('📊 Messages for current room:', messages[currentRoom || '']);
    }, [messages, currentRoom]);

    const handleLogin = async (username: string, password: string) => {
        try {
            const result = await login(username, password);
            if (result.success) {
                setIsAuthenticated(true);
                setCurrentUser(result.user);
                localStorage.setItem('token', result.token);
                localStorage.setItem('user', JSON.stringify(result.user));
                // Don't auto-select any room - let user create/join one
                setCurrentRoom(null);
                setCurrentRoomId('');
            }
            return result;
        } catch (error) {
            return { success: false, error: 'Login failed' };
        }
    };

    const handleRegister = async (username: string, password: string) => {
        try {
            const result = await register(username, password);
            return result;
        } catch (error) {
            return { success: false, error: 'Registration failed' };
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setIsAuthenticated(false);
        setCurrentUser(null);
        setCurrentRoom(null);
    };

    const handleRoomSelect = (roomId: string) => {
        if (currentRoom) {
            leaveRoom(currentRoom);
        }
        setCurrentRoom(roomId);
        setCurrentRoomId(roomId); // Sync with hook state
        joinRoom(roomId);
    };

    if (!isAuthenticated) {
        return (
            <LoginPage
                onLogin={handleLogin}
                onRegister={handleRegister}
            />
        );
    }

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-[#0a0f1a]">
            <Sidebar
                currentUser={currentUser}
                rooms={rooms}
                users={users}
                currentRoom={currentRoom}
                onRoomSelect={handleRoomSelect}
                onCreateRoom={createRoom}
                onLogout={handleLogout}
                connected={connected}
                myPresence={myPresence}
                onUpdatePresence={updatePresence}
                onUpdateProfile={updateProfile}
                aiMessages={aiMessages}
                aiLoading={aiLoading}
                onSendAIMessage={sendAIMessage}
                onClearAIMessages={clearAIMessages}
                onStartCall={(userId, type) => startCall(userId, type)}
                activeTab={activeTab}
                onTabChange={setActiveTab}
            />

            <ChatArea
                currentRoom={currentRoom}
                currentUser={currentUser}
                messages={messages[currentRoom || ''] || []}
                rooms={rooms}
                onSendMessage={(content) => sendMessage(currentRoom!, content)}
                onToggleRightPanel={() => setShowRightPanel(!showRightPanel)}
                onEditMessage={(messageId, newContent) => editMessage(messageId, newContent)}
                onDeleteMessage={(messageId) => deleteMessage(messageId)}
                onAddReaction={addReaction}
                onStartCall={currentRoom?.startsWith('dm_') ? (type) => {
                    // Extract user ID from DM room ID (format: dm_userId)
                    const targetUserId = currentRoom.replace('dm_', '');
                    startCall(targetUserId, type);
                } : undefined}
                // New feature props
                typingUsers={typingUsers.filter(u => u.roomId === currentRoom)}
                aiMessages={aiMessages}
                aiLoading={aiLoading}
                onSendAIMessage={sendAIMessage}
                onClearAIMessages={clearAIMessages}
                onCreatePoll={createPoll}
                onVotePoll={votePoll}
                polls={polls}
                onInviteGame={inviteGame}
                watchSession={watchSession}
                onCreateWatchSession={createWatchSession}
                onSyncWatch={syncWatch}
                onEndWatchSession={endWatchSession}
                users={users}
                // Message actions
                onPinMessage={(messageId) => currentRoom && pinMessage(messageId, currentRoom)}
                onReplyMessage={(content, replyToId) => currentRoom && replyMessage(content, replyToId, currentRoom)}
                onForwardMessage={forwardMessage}
            />

            {showRightPanel && currentRoom && activeTab === 'rooms' && (
                <RightPanel
                    roomId={currentRoom}
                    users={users}
                    messages={messages[currentRoom] || []}
                    onClose={() => setShowRightPanel(false)}
                    onLeaveRoom={currentRoom !== 'global' ? () => {
                        const roomToLeave = currentRoom;
                        // Leave the room on server
                        leaveRoom(roomToLeave);
                        // Remove room from local list
                        deleteRoom(roomToLeave);
                        // Clear current room (no auto-switch)
                        setCurrentRoom(null);
                        setCurrentRoomId('');
                    } : undefined}
                    onKickUser={(userId) => kickUser(userId, currentRoom)}
                    onBlockUser={blockUser}
                    onUnpinMessage={(messageId) => unpinMessage(messageId, currentRoom)}
                />
            )}

            <CallManager />
            <CallModal />
        </div>
    );
}

export default App;
