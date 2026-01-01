/**
 * ChatBox Automated Test Suite
 * Tests all major features: Auth, Chat, Rooms, AI, File upload
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:8080';
const TEST_TIMEOUT = 5000;

// Test results tracking
const results = {
    passed: 0,
    failed: 0,
    tests: []
};

function log(emoji, message) {
    console.log(`${emoji} ${message}`);
}

function addResult(name, passed, error = null) {
    results.tests.push({ name, passed, error });
    if (passed) {
        results.passed++;
        log('✅', `PASS: ${name}`);
    } else {
        results.failed++;
        log('❌', `FAIL: ${name} - ${error}`);
    }
}

class TestClient {
    constructor(name) {
        this.name = name;
        this.ws = null;
        this.userId = null;
        this.token = null;
        this.messageQueue = [];
        this.resolvers = {};
    }

    connect() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Connection timeout')), TEST_TIMEOUT);
            
            this.ws = new WebSocket(WS_URL);
            
            this.ws.on('open', () => {
                clearTimeout(timeout);
                this.setupHandlers();
                resolve();
            });
            
            this.ws.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }

    setupHandlers() {
        this.ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                this.messageQueue.push(msg);
                
                // Resolve waiting promises
                if (this.resolvers[msg.type]) {
                    this.resolvers[msg.type](msg);
                    delete this.resolvers[msg.type];
                }
            } catch (e) {
                console.error('Parse error:', e);
            }
        });
    }

    send(data) {
        this.ws.send(JSON.stringify(data));
    }

    waitFor(type, timeout = TEST_TIMEOUT) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                delete this.resolvers[type];
                reject(new Error(`Timeout waiting for ${type}`));
            }, timeout);

            this.resolvers[type] = (msg) => {
                clearTimeout(timer);
                resolve(msg);
            };

            // Check if already received
            const existing = this.messageQueue.find(m => m.type === type);
            if (existing) {
                clearTimeout(timer);
                delete this.resolvers[type];
                resolve(existing);
            }
        });
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

async function testConnection() {
    const client = new TestClient('connection-test');
    try {
        await client.connect();
        addResult('WebSocket Connection', true);
        client.close();
        return true;
    } catch (e) {
        addResult('WebSocket Connection', false, e.message);
        return false;
    }
}

async function testRegister() {
    const client = new TestClient('register-test');
    const username = `testuser_${Date.now()}`;
    
    try {
        await client.connect();
        
        client.send({
            type: 'register',
            username: username,
            password: 'Test123456',
            email: `${username}@test.com`
        });

        const response = await client.waitFor('register_response');
        
        if (response.success) {
            addResult('User Registration', true);
            client.close();
            return { username, password: 'Test123456' };
        } else {
            addResult('User Registration', false, response.message);
            client.close();
            return null;
        }
    } catch (e) {
        addResult('User Registration', false, e.message);
        client.close();
        return null;
    }
}

async function testLogin(username, password) {
    const client = new TestClient('login-test');
    
    try {
        await client.connect();
        
        client.send({
            type: 'login',
            username: username,
            password: password
        });

        const response = await client.waitFor('login_response');
        
        if (response.success && response.token) {
            addResult('User Login', true);
            client.userId = response.userId;
            client.token = response.token;
            return client; // Return connected client for further tests
        } else {
            addResult('User Login', false, response.message);
            client.close();
            return null;
        }
    } catch (e) {
        addResult('User Login', false, e.message);
        client.close();
        return null;
    }
}

async function testSendMessage(client) {
    try {
        const testMessage = `Test message ${Date.now()}`;
        
        client.send({
            type: 'chat',
            roomId: 'global',
            content: testMessage
        });

        const response = await client.waitFor('chat');
        
        if (response.content === testMessage) {
            addResult('Send Message', true);
            return true;
        } else {
            addResult('Send Message', false, 'Message mismatch');
            return false;
        }
    } catch (e) {
        addResult('Send Message', false, e.message);
        return false;
    }
}

async function testCreateRoom(client) {
    try {
        const roomName = `TestRoom_${Date.now()}`;
        
        client.send({
            type: 'create_room',
            roomName: roomName
        });

        const response = await client.waitFor('room_created');
        
        if (response.roomId) {
            addResult('Create Room', true);
            log('🏠', `Created room: ${response.roomId}`);
            return response.roomId;
        } else {
            addResult('Create Room', false, 'Invalid response');
            return null;
        }
    } catch (e) {
        addResult('Create Room', false, e.message);
        return null;
    }
}

async function testJoinRoom(client, roomId) {
    try {
        client.send({
            type: 'join_room',
            roomId: roomId
        });

        const response = await client.waitFor('room_joined');
        
        if (response.roomId === roomId) {
            addResult('Join Room', true);
            return true;
        } else {
            addResult('Join Room', false, 'Room ID mismatch');
            return false;
        }
    } catch (e) {
        addResult('Join Room', false, e.message);
        return false;
    }
}

async function testTypingIndicator(client) {
    try {
        client.send({
            type: 'typing',
            roomId: 'global',
            isTyping: true
        });

        // Just verify no error, typing doesn't always echo back
        await new Promise(r => setTimeout(r, 500));
        addResult('Typing Indicator', true);
        return true;
    } catch (e) {
        addResult('Typing Indicator', false, e.message);
        return false;
    }
}

async function testAIChat(client) {
    try {
        client.send({
            type: 'ai_request',
            content: 'Say hello in 3 words'
        });

        const response = await client.waitFor('ai_response', 15000); // AI may take longer
        
        if (response.content && response.content.length > 0) {
            addResult('AI Chat (Gemini)', true);
            log('🤖', `AI Response: "${response.content.substring(0, 50)}..."`);
            return true;
        } else {
            addResult('AI Chat (Gemini)', false, 'Empty response');
            return false;
        }
    } catch (e) {
        // Check for ai_error
        const errorMsg = client.messageQueue.find(m => m.type === 'ai_error');
        if (errorMsg) {
            addResult('AI Chat (Gemini)', false, errorMsg.error);
        } else {
            addResult('AI Chat (Gemini)', false, e.message);
        }
        return false;
    }
}

async function testPresenceUpdate(client) {
    try {
        client.send({
            type: 'presence_update',
            status: 'away'
        });

        await new Promise(r => setTimeout(r, 500));
        addResult('Presence Update', true);
        return true;
    } catch (e) {
        addResult('Presence Update', false, e.message);
        return false;
    }
}

async function testReaction(client) {
    try {
        client.send({
            type: 'add_reaction',
            messageId: 'test-msg-1',
            roomId: 'global',
            emoji: '👍'
        });

        const response = await client.waitFor('reaction_added');
        
        if (response.emoji === '👍') {
            addResult('Add Reaction', true);
            return true;
        } else {
            addResult('Add Reaction', false, 'Invalid response');
            return false;
        }
    } catch (e) {
        addResult('Add Reaction', false, e.message);
        return false;
    }
}

async function testPinMessage(client) {
    try {
        client.send({
            type: 'pin_message',
            messageId: 'test-msg-1',
            roomId: 'global'
        });

        const response = await client.waitFor('message_pinned');
        
        if (response.messageId) {
            addResult('Pin Message', true);
            return true;
        } else {
            addResult('Pin Message', false, 'Invalid response');
            return false;
        }
    } catch (e) {
        addResult('Pin Message', false, e.message);
        return false;
    }
}

async function testGetRooms(client) {
    try {
        client.send({
            type: 'get_rooms'
        });

        const response = await client.waitFor('room_list');
        
        if (Array.isArray(response.rooms)) {
            addResult('Get Rooms List', true);
            log('📋', `Found ${response.rooms.length} rooms`);
            return true;
        } else {
            addResult('Get Rooms List', false, 'Invalid response');
            return false;
        }
    } catch (e) {
        addResult('Get Rooms List', false, e.message);
        return false;
    }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function testEditMessage(client) {
    try {
        client.send({
            type: 'edit_message',
            messageId: 'test-msg-1',
            roomId: 'global',
            newContent: 'Edited message'
        });

        const response = await client.waitFor('message_edited');
        
        if (response.messageId) {
            addResult('Edit Message', true);
            return true;
        } else {
            addResult('Edit Message', false, 'Invalid response');
            return false;
        }
    } catch (e) {
        addResult('Edit Message', false, e.message);
        return false;
    }
}

async function testDeleteMessage(client) {
    try {
        client.send({
            type: 'delete_message',
            messageId: 'test-msg-1',
            roomId: 'global'
        });

        const response = await client.waitFor('message_deleted');
        
        if (response.messageId) {
            addResult('Delete Message', true);
            return true;
        } else {
            addResult('Delete Message', false, 'Invalid response');
            return false;
        }
    } catch (e) {
        addResult('Delete Message', false, e.message);
        return false;
    }
}

async function testLeaveRoom(client, roomId) {
    try {
        client.send({
            type: 'leave_room',
            roomId: roomId
        });

        const response = await client.waitFor('room_left');
        
        if (response.roomId === roomId) {
            addResult('Leave Room', true);
            return true;
        } else {
            addResult('Leave Room', false, 'Room ID mismatch');
            return false;
        }
    } catch (e) {
        addResult('Leave Room', false, e.message);
        return false;
    }
}

async function testPing(client) {
    try {
        client.send({
            type: 'ping'
        });

        const response = await client.waitFor('pong');
        
        if (response.timestamp) {
            addResult('Ping/Pong', true);
            return true;
        } else {
            addResult('Ping/Pong', false, 'No timestamp');
            return false;
        }
    } catch (e) {
        addResult('Ping/Pong', false, e.message);
        return false;
    }
}

async function runAllTests() {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 CHATBOX AUTOMATED TEST SUITE');
    console.log('='.repeat(60) + '\n');

    // Test 1: Connection
    log('🔌', 'Testing WebSocket Connection...');
    const connected = await testConnection();
    if (!connected) {
        console.log('\n❌ Cannot connect to server. Make sure backend is running on port 8080');
        return;
    }

    // Test 2: Registration
    log('📝', 'Testing User Registration...');
    const credentials = await testRegister();
    if (!credentials) {
        console.log('\n⚠️  Registration failed, trying with existing user...');
    }

    // Test 3: Login
    log('🔑', 'Testing User Login...');
    const client = await testLogin(
        credentials?.username || 'testuser',
        credentials?.password || 'Test123456'
    );
    
    if (!client) {
        console.log('\n❌ Login failed. Cannot continue with authenticated tests.');
        printResults();
        return;
    }

    // Wait for initial messages
    await new Promise(r => setTimeout(r, 1000));

    // Test 4: Ping/Pong
    log('🏓', 'Testing Ping/Pong...');
    await testPing(client);

    // Test 5: Send Message
    log('💬', 'Testing Send Message...');
    await testSendMessage(client);

    // Test 6: Typing Indicator
    log('⌨️', 'Testing Typing Indicator...');
    await testTypingIndicator(client);

    // Test 7: Presence Update
    log('👤', 'Testing Presence Update...');
    await testPresenceUpdate(client);

    // Test 8: Reaction
    log('👍', 'Testing Add Reaction...');
    await testReaction(client);

    // Test 9: Pin Message
    log('📌', 'Testing Pin Message...');
    await testPinMessage(client);

    // Test 10: Edit Message
    log('✏️', 'Testing Edit Message...');
    await testEditMessage(client);

    // Test 11: Delete Message
    log('🗑️', 'Testing Delete Message...');
    await testDeleteMessage(client);

    // Test 12: Get Rooms
    log('🏠', 'Testing Get Rooms...');
    await testGetRooms(client);

    // Test 13: Create Room
    log('➕', 'Testing Create Room...');
    const roomId = await testCreateRoom(client);

    // Test 14: Join Room
    if (roomId) {
        log('🚪', 'Testing Join Room...');
        await testJoinRoom(client, roomId);

        // Test 15: Leave Room  
        log('🚶', 'Testing Leave Room...');
        await testLeaveRoom(client, roomId);
    }

    // Test 16: AI Chat (may take longer) - Skip if no API key
    log('🤖', 'Testing AI Chat (Gemini)...');
    await testAIChat(client);

    // Cleanup
    client.close();
    
    // Print results
    printResults();
}

function printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`\n✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📝 Total:  ${results.passed + results.failed}`);
    
    const passRate = ((results.passed / (results.passed + results.failed)) * 100).toFixed(1);
    console.log(`\n📈 Pass Rate: ${passRate}%`);
    
    if (results.failed > 0) {
        console.log('\n❌ Failed Tests:');
        results.tests.filter(t => !t.passed).forEach(t => {
            console.log(`   - ${t.name}: ${t.error}`);
        });
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
}

// Run tests
runAllTests().catch(console.error);
