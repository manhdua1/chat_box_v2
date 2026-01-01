import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8080');
const testUsername = 'quicktest' + Date.now();
const testPassword = 'test123';

ws.on('open', () => {
    console.log('Connected to server');
    
    // First register a new user
    const registerMsg = JSON.stringify({
        type: 'register',
        username: testUsername,
        password: testPassword,
        email: testUsername + '@test.com'
    });
    console.log('Sending register:', registerMsg);
    ws.send(registerMsg);
});

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('Received:', JSON.stringify(msg, null, 2));
    
    if (msg.type === 'register_response' && msg.success) {
        console.log('\n=== Register successful, now testing login ===');
        // Wait a bit then login with the username we just registered
        setTimeout(() => {
            const loginMsg = JSON.stringify({
                type: 'login',
                username: testUsername,
                password: testPassword
            });
            console.log('Sending login:', loginMsg);
            ws.send(loginMsg);
        }, 500);
    } else if (msg.type === 'login_response') {
        console.log('\n=== Login result ===');
        console.log('Success:', msg.success);
        console.log('UserId:', msg.userId);
        console.log('Token:', msg.token ? msg.token.substring(0, 30) + '...' : 'none');
        
        if (msg.success && msg.userId) {
            // Test block feature
            console.log('\n=== Testing block feature ===');
            ws.send(JSON.stringify({
                type: 'user_block',
                targetUserId: 'some-other-user-id'
            }));
        } else {
            console.log('\n!!! Login failed or userId is missing !!!');
            ws.close();
        }
    } else if (msg.type === 'user_block_response') {
        console.log('\n=== Block result ===');
        console.log('Success:', msg.success);
        console.log('Full response:', msg);
        
        // Test get blocked users
        console.log('\n=== Testing get blocked users ===');
        ws.send(JSON.stringify({
            type: 'get_blocked_users'
        }));
    } else if (msg.type === 'blocked_users_list') {
        console.log('\n=== Blocked users list ===');
        console.log('Full response:', msg);
        ws.close();
    }
});

ws.on('error', (err) => {
    console.error('Error:', err.message);
});

ws.on('close', () => {
    console.log('\nConnection closed');
    process.exit(0);
});

setTimeout(() => {
    console.log('\nTimeout - closing connection');
    ws.close();
    process.exit(1);
}, 15000);
