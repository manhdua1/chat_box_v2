/**
 * Test script for new features
 * Run: node test/test-new-features.js
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:8080';

let ws1, ws2;
let user1Token, user2Token;
let user1Id, user2Id;
let testMessageId;

// Helper to send message and wait for response
function sendAndWait(ws, msg, expectedType, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timeout waiting for ${expectedType}`));
        }, timeout);
        
        const handler = (data) => {
            const response = JSON.parse(data.toString());
            if (response.type === expectedType || response.type === 'error') {
                clearTimeout(timer);
                ws.off('message', handler);
                resolve(response);
            }
        };
        
        ws.on('message', handler);
        ws.send(JSON.stringify(msg));
    });
}

// Connect and login
async function connectAndLogin(username, password) {
    const ws = new WebSocket(WS_URL);
    
    await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
    });
    
    // Login
    const loginResp = await sendAndWait(ws, {
        type: 'login',
        username,
        password
    }, 'login_response');
    
    if (loginResp.type === 'error' || !loginResp.success) {
        // Try register if login fails
        const regResp = await sendAndWait(ws, {
            type: 'register',
            username,
            password,
            email: `${username}@test.com`
        }, 'register_response');
        
        // Login again after register
        const loginResp2 = await sendAndWait(ws, {
            type: 'login',
            username,
            password
        }, 'login_response');
        
        return { ws, token: loginResp2.token, userId: loginResp2.userId };
    }
    
    return { ws, token: loginResp.token, userId: loginResp.userId };
}

// Test cases
async function runTests() {
    console.log('🧪 Testing New Features...\n');
    
    try {
        // Connect two users
        console.log('1️⃣ Connecting users...');
        const conn1 = await connectAndLogin('testuser1', 'password123');
        ws1 = conn1.ws;
        user1Token = conn1.token;
        user1Id = conn1.userId;
        console.log(`   ✅ User1 connected: ${user1Id}`);
        
        const conn2 = await connectAndLogin('testuser2', 'password123');
        ws2 = conn2.ws;
        user2Token = conn2.token;
        user2Id = conn2.userId;
        console.log(`   ✅ User2 connected: ${user2Id}`);
        
        // Test Block User
        console.log('\n2️⃣ Testing Block User...');
        const blockResp = await sendAndWait(ws1, {
            type: 'user_block',
            targetUserId: user2Id
        }, 'user_blocked');
        console.log(`   ✅ Block response:`, blockResp.type === 'user_blocked' ? 'SUCCESS' : 'FAILED');
        
        // Test Get Blocked Users
        console.log('\n3️⃣ Testing Get Blocked Users...');
        const blockedResp = await sendAndWait(ws1, {
            type: 'get_blocked_users'
        }, 'blocked_users_list');
        console.log(`   ✅ Blocked users:`, blockedResp.blockedUsers);
        
        // Test Unblock User
        console.log('\n4️⃣ Testing Unblock User...');
        const unblockResp = await sendAndWait(ws1, {
            type: 'user_unblock',
            targetUserId: user2Id
        }, 'user_unblocked');
        console.log(`   ✅ Unblock response:`, unblockResp.type === 'user_unblocked' ? 'SUCCESS' : 'FAILED');
        
        // Test Send Sticker
        console.log('\n5️⃣ Testing Sticker Message...');
        ws2.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.messageType === 'sticker') {
                console.log(`   📥 User2 received sticker: ${msg.sticker}`);
            }
        });
        
        const stickerResp = await sendAndWait(ws1, {
            type: 'chat_sticker',
            sticker: '😀',
            roomId: 'global'
        }, 'chat');
        console.log(`   ✅ Sticker sent:`, stickerResp.messageType === 'sticker' ? 'SUCCESS' : 'FAILED');
        
        // Test Send Location
        console.log('\n6️⃣ Testing Location Message...');
        const locResp = await sendAndWait(ws1, {
            type: 'chat_location',
            latitude: 10.762622,
            longitude: 106.660172,
            roomId: 'global'
        }, 'chat');
        console.log(`   ✅ Location sent:`, locResp.messageType === 'location' ? 'SUCCESS' : 'FAILED');
        
        // Test Get Rooms
        console.log('\n7️⃣ Testing Get Rooms...');
        const roomsResp = await sendAndWait(ws1, {
            type: 'get_rooms'
        }, 'room_list');
        console.log(`   ✅ Rooms count:`, roomsResp.count);
        console.log(`   📋 Rooms:`, roomsResp.rooms);
        
        // Test Create Room
        console.log('\n8️⃣ Testing Create Room...');
        const createRoomResp = await sendAndWait(ws1, {
            type: 'create_room',
            roomName: 'Test Room ' + Date.now(),
            roomType: 'group'
        }, 'room_created');
        const testRoomId = createRoomResp.roomId;
        console.log(`   ✅ Room created:`, testRoomId);
        
        // Test Join Room (user2)
        console.log('\n9️⃣ Testing Join Room...');
        const joinResp = await sendAndWait(ws2, {
            type: 'join_room',
            roomId: testRoomId
        }, 'room_joined');
        console.log(`   ✅ Join response - memberCount:`, joinResp.memberCount);
        console.log(`   📜 History messages:`, joinResp.history?.length || 0);
        
        // Test Mark Read
        console.log('\n🔟 Testing Mark Read...');
        const markReadResp = await sendAndWait(ws2, {
            type: 'mark_read',
            messageId: stickerResp.messageId,
            roomId: 'global'
        }, 'message_read');
        console.log(`   ✅ Mark read:`, markReadResp.type === 'message_read' ? 'SUCCESS' : 'FAILED');
        
        // Test Presence Update
        console.log('\n1️⃣1️⃣ Testing Presence Update...');
        const presenceResp = await sendAndWait(ws1, {
            type: 'presence_update',
            status: 'away'
        }, 'presence_update');
        console.log(`   ✅ Presence update:`, presenceResp.status);
        
        // Test Profile Update
        console.log('\n1️⃣2️⃣ Testing Profile Update...');
        const profileResp = await sendAndWait(ws1, {
            type: 'profile_update',
            displayName: 'Test User 1',
            statusMessage: 'Testing profile update'
        }, 'profile_update_response');
        console.log(`   ✅ Profile update:`, profileResp.success ? 'SUCCESS' : 'FAILED');
        
        console.log('\n✅ ALL TESTS COMPLETED!\n');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        // Cleanup
        if (ws1 && ws1.readyState === WebSocket.OPEN) ws1.close();
        if (ws2 && ws2.readyState === WebSocket.OPEN) ws2.close();
    }
}

// Run tests
runTests().then(() => {
    setTimeout(() => process.exit(0), 1000);
}).catch(console.error);
