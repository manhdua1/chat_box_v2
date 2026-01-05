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
        createPoll,
        votePoll,
        activeGames,
        inviteGame,
        acceptGame,
        rejectGame,
        makeGameMove,
        watchSession,
        createWatchSession,
        syncWatch,
        endWatchSession,
        myPresence,
        updatePresence,
        updateProfile,
        profileUpdate,
        clearProfileUpdate,
        roomMembers,
        // AI Chat
        aiMessages,
        aiLoading,
        sendAIMessage,
        clearAIMessages,
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

    // Update currentUser when profile is updated
    useEffect(() => {
        if (profileUpdate && currentUser && profileUpdate.userId === currentUser.id) {
            const updatedUser = {
                ...currentUser,
                username: profileUpdate.displayName || currentUser.username,
                avatar: profileUpdate.avatar || currentUser.avatar
            };
            setCurrentUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
            console.log('✅ Updated currentUser after profile change:', updatedUser);
            clearProfileUpdate();
        }
    }, [profileUpdate, currentUser, clearProfileUpdate]);

    // Debug: log messages state
    useEffect(() => {
        console.log('📊 App Messages state updated:', messages);
        console.log('📊 Current room:', currentRoom);
        console.log('📊 Messages for current room:', currentRoom ? messages[currentRoom] : 'no room');
        console.log('📊 All room keys:', Object.keys(messages));
    }, [messages, currentRoom]);

    // Debug: log polls state
    useEffect(() => {
        console.log('🗳️ App Polls state updated:', polls);
        console.log('🗳️ Polls count:', Object.keys(polls).length);
        console.log('🗳️ Poll roomIds:', Object.values(polls).map((p: any) => p.roomId));
    }, [polls]);

    // Force re-render when messages change for current room
    const currentMessages = currentRoom ? messages[currentRoom] || [] : [];
    console.log('🔄 currentMessages computed:', currentMessages.length);

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
        console.log('🚪 Room select:', { from: currentRoom, to: roomId });
        if (currentRoom) {
            leaveRoom(currentRoom);
        }
        setCurrentRoom(roomId);
        setCurrentRoomId(roomId); // Sync with hook state
        joinRoom(roomId);
        console.log('🚪 Room changed to:', roomId);
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
        <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-primary)]">
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
                onStartCall={(userId, username, type) => startCall(userId, username, type)}
                onBlockUser={blockUser}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                aiMessages={aiMessages}
                aiLoading={aiLoading}
                onSendAIMessage={sendAIMessage}
                onClearAIMessages={clearAIMessages}
            />

            <ChatArea
                currentRoom={currentRoom}
                currentUser={currentUser}
                messages={currentMessages}
                rooms={rooms}
                onSendMessage={(content) => {
                    console.log('📨 ChatArea onSendMessage:', { currentRoom, content });
                    sendMessage(currentRoom!, content);
                }}
                onToggleRightPanel={() => setShowRightPanel(!showRightPanel)}
                onEditMessage={(messageId, newContent) => editMessage(messageId, newContent)}
                onDeleteMessage={(messageId) => deleteMessage(messageId)}
                onAddReaction={addReaction}
                onStartCall={currentRoom?.startsWith('dm_') ? (type) => {
                    // Extract user ID from DM room ID (format: dm_userId)
                    const targetUserId = currentRoom.replace('dm_', '');
                    const targetUser = users.find(u => u.id === targetUserId);
                    startCall(targetUserId, targetUser?.username || 'Unknown', type);
                } : undefined}
                // New feature props
                typingUsers={typingUsers.filter(u => u.roomId === currentRoom)}
                onCreatePoll={createPoll}
                onVotePoll={votePoll}
                polls={polls}
                activeGames={activeGames}
                onInviteGame={inviteGame}
                onAcceptGame={acceptGame}
                onRejectGame={rejectGame}
                onMakeGameMove={makeGameMove}
                watchSession={watchSession}
                onCreateWatchSession={createWatchSession}
                onSyncWatch={syncWatch}
                onEndWatchSession={endWatchSession}
                users={users}
                // Message actions
                onPinMessage={(messageId) => currentRoom && pinMessage(messageId, currentRoom)}
                onReplyMessage={(content, replyToId) => currentRoom && replyMessage(content, replyToId, currentRoom)}
                onForwardMessage={forwardMessage}
                // AI Chat
                aiMessages={aiMessages}
                aiLoading={aiLoading}
                onSendAIMessage={sendAIMessage}
                onClearAIMessages={clearAIMessages}
            />

            {showRightPanel && currentRoom && activeTab === 'rooms' && (
                <RightPanel
                    roomId={currentRoom}
                    users={users}
                    roomMembers={roomMembers[currentRoom] || []}
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
