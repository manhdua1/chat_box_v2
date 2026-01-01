import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8080');
const testUsername = 'roomtest' + Date.now();

ws.on('open', () => {
    console.log('Connected');
    ws.send(JSON.stringify({ type: 'register', username: testUsername, password: 'test123', email: testUsername + '@test.com' }));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('Received:', msg.type, JSON.stringify(msg).substring(0, 200));
    
    if (msg.type === 'register_response' && msg.success) {
        console.log('\nLogging in...');
        ws.send(JSON.stringify({ type: 'login', username: testUsername, password: 'test123' }));
    }
    
    if (msg.type === 'login_response' && msg.success) {
        console.log('\nLogged in! Waiting then creating room...');
        setTimeout(() => {
            console.log('\nSending create_room...');
            ws.send(JSON.stringify({ type: 'create_room', roomName: 'My Test Room', roomType: 'group' }));
        }, 1000);
    }
    
    if (msg.type === 'room_created') {
        console.log('\n✅ Room created:', msg.roomId);
        ws.close();
        process.exit(0);
    }
    
    if (msg.type === 'error') {
        console.log('\n❌ Error:', msg.message);
    }
});

ws.on('error', (err) => console.error('Error:', err.message));

setTimeout(() => {
    console.log('\nTimeout');
    ws.close();
    process.exit(1);
}, 15000);
