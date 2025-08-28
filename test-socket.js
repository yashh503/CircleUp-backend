const { io } = require('socket.io-client');

// Test WebSocket connection
async function testSocket() {
  console.log('🧪 Testing WebSocket connection...');
  
  const socket = io('http://localhost:5000', {
    auth: {
      token: 'test-token' // This will fail auth, but we can test connection
    },
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    console.log('✅ Connected to WebSocket server');
  });

  socket.on('connect_error', (error) => {
    console.log('❌ Connection error (expected due to invalid token):', error.message);
  });

  socket.on('error', (error) => {
    console.log('❌ Socket error:', error);
  });

  // Cleanup after 5 seconds
  setTimeout(() => {
    socket.disconnect();
    console.log('🧹 Test completed');
    process.exit(0);
  }, 5000);
}

// Run test
testSocket().catch(console.error); 