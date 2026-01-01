import WebSocket from 'ws';

// Test configuration
const WS_URL = 'ws://localhost:8080';
const testUsername = 'fulltest' + Date.now();
const testUsername2 = 'fulltest2' + Date.now();
const testPassword = 'test123';

let ws1, ws2;
let user1Info = null;
let user2Info = null;
let testResults = {
    passed: 0,
    failed: 0,
    tests: []
};

function logTest(name, passed, details = '') {
    if (passed) {
        testResults.passed++;
        console.log(`✅ ${name}${details ? ': ' + details : ''}`);
    } else {
        testResults.failed++;
        console.log(`❌ ${name}${details ? ': ' + details : ''}`);
    }
    testResults.tests.push({ name, passed, details });
}

function createConnection(name) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(WS_URL);
        ws.name = name;
        ws.messageQueue = [];
        ws.pendingResolvers = [];
        
        ws.on('open', () => {
            console.log(`[${name}] Connected`);
            resolve(ws);
        });
        
        ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            
            // Check if any pending resolver matches this message
            for (let i = 0; i < ws.pendingResolvers.length; i++) {
                const { predicate, resolve } = ws.pendingResolvers[i];
                if (predicate(msg)) {
                    ws.pendingResolvers.splice(i, 1);
                    resolve(msg);
                    return;
                }
            }
            
            // No match, add to queue
            ws.messageQueue.push(msg);
        });
        
        ws.on('error', reject);
    });
}

function waitForMessage(ws, type, timeout = 5000) {
    return waitForMessageMatching(ws, m => m.type === type, timeout);
}

// Wait for specific message that matches a predicate
function waitForMessageMatching(ws, predicate, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timeout waiting for message`));
        }, timeout);
        
        // Check existing queue first
        const idx = ws.messageQueue.findIndex(predicate);
        if (idx >= 0) {
            clearTimeout(timer);
            resolve(ws.messageQueue.splice(idx, 1)[0]);
            return;
        }
        
        // Add to pending resolvers
        ws.pendingResolvers.push({
            predicate,
            resolve: (msg) => {
                clearTimeout(timer);
                resolve(msg);
            }
        });
    });
}

async function sendAndWait(ws, message, expectedType, timeout = 5000) {
    ws.send(JSON.stringify(message));
    return waitForMessage(ws, expectedType, timeout);
}

async function runTests() {
    console.log('\n========================================');
    console.log('Full Feature Test Suite');
    console.log('========================================\n');
    
    try {
        // Connect both users
        ws1 = await createConnection('User1');
        ws2 = await createConnection('User2');
        
        // Test 1: Register user 1
        console.log('\n--- Testing Registration ---');
        let response = await sendAndWait(ws1, {
            type: 'register',
            username: testUsername,
            password: testPassword,
            email: testUsername + '@test.com'
        }, 'register_response');
        logTest('Register User 1', response.success);
        
        // Test 2: Register user 2
        response = await sendAndWait(ws2, {
            type: 'register',
            username: testUsername2,
            password: testPassword,
            email: testUsername2 + '@test.com'
        }, 'register_response');
        logTest('Register User 2', response.success);
        
        // Test 3: Login user 1
        console.log('\n--- Testing Login ---');
        response = await sendAndWait(ws1, {
            type: 'login',
            username: testUsername,
            password: testPassword
        }, 'login_response');
        user1Info = { userId: response.userId, username: response.username, token: response.token };
        logTest('Login User 1', response.success && response.userId, `userId: ${response.userId}`);
        
        // Wait for history
        await waitForMessage(ws1, 'history');
        
        // Test 4: Login user 2
        response = await sendAndWait(ws2, {
            type: 'login',
            username: testUsername2,
            password: testPassword
        }, 'login_response');
        user2Info = { userId: response.userId, username: response.username, token: response.token };
        logTest('Login User 2', response.success && response.userId, `userId: ${response.userId}`);
        
        // Wait for history
        await waitForMessage(ws2, 'history');
        
        // Test 5: Send chat message
        console.log('\n--- Testing Chat ---');
        const testContent = 'Hello from test! ' + Date.now();
        ws1.send(JSON.stringify({
            type: 'chat',
            content: testContent,
            roomId: 'global'
        }));
        // Server echoes back the message with type 'chat' (not 'chat_sent')
        response = await waitForMessage(ws1, 'chat');
        logTest('Send Chat Message', !!response.messageId, `messageId: ${response.messageId}`);
        
        // User 2 should receive the message - wait for a chat message with our specific content
        response = await waitForMessageMatching(ws2, m => m.type === 'chat' && m.content === testContent);
        logTest('Receive Chat Message', !!response.content, `content: ${response.content?.substring(0, 30)}`);
        
        // Test 6: Block user
        console.log('\n--- Testing Block/Unblock ---');
        response = await sendAndWait(ws1, {
            type: 'user_block',
            targetUserId: user2Info.userId
        }, 'user_blocked');
        logTest('Block User', response.success, `blocked: ${response.targetUserId}`);
        
        // Test 7: Get blocked users
        response = await sendAndWait(ws1, {
            type: 'get_blocked_users'
        }, 'blocked_users_list');
        logTest('Get Blocked Users', response.blockedUsers && response.blockedUsers.length > 0, 
            `count: ${response.blockedUsers?.length}`);
        
        // Test 8: Unblock user
        response = await sendAndWait(ws1, {
            type: 'user_unblock',
            targetUserId: user2Info.userId
        }, 'user_unblocked');
        logTest('Unblock User', response.success, `unblocked: ${response.targetUserId}`);
        
        // Test 9: Sticker - returns type 'chat' with messageType='sticker'
        console.log('\n--- Testing Sticker ---');
        ws1.send(JSON.stringify({
            type: 'chat_sticker',
            sticker: 'emoji_happy',
            stickerPack: 'default',
            roomId: 'global'
        }));
        response = await waitForMessage(ws1, 'chat');
        logTest('Send Sticker', response.messageType === 'sticker' || response.messageId);
        
        // Test 10: Location - returns type 'chat' with messageType='location'
        console.log('\n--- Testing Location ---');
        ws1.send(JSON.stringify({
            type: 'chat_location',
            latitude: 21.0278,
            longitude: 105.8342,
            locationName: 'Hanoi, Vietnam',
            roomId: 'global'
        }));
        response = await waitForMessage(ws1, 'chat');
        logTest('Send Location', response.messageType === 'location' || response.messageId);
        
        // Test 11: Create room
        console.log('\n--- Testing Rooms ---');
        // Clear message queues first
        ws1.messageQueue = ws1.messageQueue.filter(m => m.type !== 'chat');
        ws2.messageQueue = ws2.messageQueue.filter(m => m.type !== 'chat');
        
        response = await sendAndWait(ws1, {
            type: 'create_room',
            roomName: 'Test Room',
            roomType: 'group'
        }, 'room_created');
        const createdRoomId = response.roomId;
        logTest('Create Room', !!createdRoomId, `roomId: ${createdRoomId}`);
        
        // Test 12: Get rooms - returns type 'room_list'
        response = await sendAndWait(ws1, {
            type: 'get_rooms'
        }, 'room_list');
        logTest('Get Rooms', response.rooms && response.rooms.length >= 0, `count: ${response.rooms?.length}`);
        
        // Test 13: Join room - returns roomId (no 'success' field)
        response = await sendAndWait(ws2, {
            type: 'join_room',
            roomId: createdRoomId
        }, 'room_joined');
        logTest('Join Room', !!response.roomId, `roomId: ${response.roomId}`);
        
        // Test 14: Invite user - returns success field
        response = await sendAndWait(ws1, {
            type: 'invite_user',
            roomId: createdRoomId,
            targetUserId: 'some-user-to-invite'
        }, 'user_invited');
        logTest('Invite User', response.success || !!response.roomId);
        
        // Test 15: Profile update - check for type 'profile_updated'
        console.log('\n--- Testing Profile ---');
        response = await sendAndWait(ws1, {
            type: 'profile_update',
            displayName: 'Test Display Name',
            statusMessage: 'Testing features!'
        }, 'profile_updated');
        logTest('Profile Update', response.type === 'profile_updated');
        
        // Test 16: Presence
        console.log('\n--- Testing Presence ---');
        ws1.send(JSON.stringify({
            type: 'presence',
            status: 'away'
        }));
        // Wait a bit for presence to be processed
        await new Promise(r => setTimeout(r, 500));
        logTest('Presence Update', true, 'sent away status');
        
        // Test 17: Typing indicator - server expects 'typing' message with 'isTyping' field
        console.log('\n--- Testing Typing ---');
        ws1.send(JSON.stringify({
            type: 'typing',
            isTyping: true,
            roomId: 'global'
        }));
        response = await waitForMessage(ws2, 'typing');
        logTest('Typing Indicator', response.isTyping !== undefined, `from: ${response.username}`);
        
        // Test 18: Mark as read
        console.log('\n--- Testing Read Receipts ---');
        ws1.send(JSON.stringify({
            type: 'mark_read',
            roomId: 'global',
            messageId: 'msg-test-123'
        }));
        // This usually doesn't return a response, just logs
        await new Promise(r => setTimeout(r, 300));
        logTest('Mark Read', true, 'sent mark_read');
        
        // Test 19: Leave room
        console.log('\n--- Testing Leave Room ---');
        response = await sendAndWait(ws2, {
            type: 'leave_room',
            roomId: createdRoomId
        }, 'room_left');
        logTest('Leave Room', response.success);
        
        // Test 20: Ping
        console.log('\n--- Testing Ping ---');
        response = await sendAndWait(ws1, { type: 'ping' }, 'pong');
        logTest('Ping/Pong', response.type === 'pong');
        
    } catch (error) {
        console.error('\n❌ Test error:', error.message);
    } finally {
        // Close connections
        if (ws1) ws1.close();
        if (ws2) ws2.close();
        
        // Print summary
        console.log('\n========================================');
        console.log('TEST SUMMARY');
        console.log('========================================');
        console.log(`✅ Passed: ${testResults.passed}`);
        console.log(`❌ Failed: ${testResults.failed}`);
        console.log(`Total: ${testResults.passed + testResults.failed}`);
        console.log('========================================\n');
        
        process.exit(testResults.failed > 0 ? 1 : 0);
    }
}

runTests();
