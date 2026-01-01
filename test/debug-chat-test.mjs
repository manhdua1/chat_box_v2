import WebSocket from 'ws';

const WS_URL = 'ws://localhost:8080';
const testUsername = 'debug' + Date.now();
const testUsername2 = 'debug2' + Date.now();
const testPassword = 'test123';

console.log('=== Debug Test: Two User Chat ===\n');

// Create two connections
const ws1 = new WebSocket(WS_URL);
const ws2 = new WebSocket(WS_URL);

ws1.on('open', async () => {
    console.log('[User1] Connected');
    
    // Register and login user 1
    ws1.send(JSON.stringify({ type: 'register', username: testUsername, password: testPassword, email: testUsername + '@test.com' }));
});

ws2.on('open', async () => {
    console.log('[User2] Connected');
    
    // Register and login user 2
    ws2.send(JSON.stringify({ type: 'register', username: testUsername2, password: testPassword, email: testUsername2 + '@test.com' }));
});

let user1LoggedIn = false;
let user2LoggedIn = false;

ws1.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('[User1] Received:', msg.type, '-', JSON.stringify(msg).substring(0, 100));
    
    if (msg.type === 'register_response' && msg.success) {
        console.log('[User1] Registered, logging in...');
        ws1.send(JSON.stringify({ type: 'login', username: testUsername, password: testPassword }));
    }
    
    if (msg.type === 'login_response' && msg.success) {
        console.log('[User1] Logged in! UserId:', msg.userId);
        user1LoggedIn = true;
        
        // Wait for user2 to login, then send chat
        const interval = setInterval(() => {
            if (user2LoggedIn) {
                clearInterval(interval);
                console.log('\n[User1] Both users logged in, sending chat message...');
                const chatMsg = { type: 'chat', content: 'Hello User2! ' + Date.now(), roomId: 'global' };
                console.log('[User1] Sending:', JSON.stringify(chatMsg));
                ws1.send(JSON.stringify(chatMsg));
            }
        }, 500);
    }
    
    if (msg.type === 'chat' && user1LoggedIn) {
        console.log('[User1] Got chat echo:', msg.content);
    }
});

ws2.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('[User2] Received:', msg.type, '-', JSON.stringify(msg).substring(0, 100));
    
    if (msg.type === 'register_response' && msg.success) {
        console.log('[User2] Registered, logging in...');
        ws2.send(JSON.stringify({ type: 'login', username: testUsername2, password: testPassword }));
    }
    
    if (msg.type === 'login_response' && msg.success) {
        console.log('[User2] Logged in! UserId:', msg.userId);
        user2LoggedIn = true;
    }
    
    if (msg.type === 'chat' && user2LoggedIn) {
        console.log('\n✅ [User2] RECEIVED CHAT MESSAGE FROM USER1:', msg.content);
        console.log('\nTest PASSED!');
        setTimeout(() => {
            ws1.close();
            ws2.close();
            process.exit(0);
        }, 1000);
    }
});

ws1.on('error', (err) => console.error('[User1] Error:', err.message));
ws2.on('error', (err) => console.error('[User2] Error:', err.message));

setTimeout(() => {
    console.log('\n❌ Timeout - User2 did not receive chat message');
    ws1.close();
    ws2.close();
    process.exit(1);
}, 20000);
