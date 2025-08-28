const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Chat = require('./models/Chat');
const User = require('./models/User');

class SocketServer {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.connectedUsers = new Map(); // userId -> socketId
    this.userSockets = new Map(); // socketId -> userId
    
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
        
        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        // Remove 'Bearer ' prefix if present
        const cleanToken = token.replace('Bearer ', '');
        
        // Verify JWT token
        const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET || 'fallback-secret');
        
        // Get user from database
        const user = await User.findById(decoded.userId).select('_id name photoUrl isActive');
        
        if (!user || !user.isActive) {
          return next(new Error('Authentication error: Invalid user'));
        }

        // Attach user info to socket
        socket.userId = user._id.toString();
        socket.userName = user.name;
        socket.userPhoto = user.photoUrl;
        
        next();
      } catch (error) {
        console.error('Socket auth error:', error.message);
        next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.userName} (${socket.userId})`);
      
      this.handleConnection(socket);
      this.handleDisconnection(socket);
      this.handleJoinChat(socket);
      this.handleLeaveChat(socket);
      this.handleTyping(socket);
      this.handleStopTyping(socket);
    });
  }

  handleConnection(socket) {
    const userId = socket.userId;
    
    // Store user connection
    this.connectedUsers.set(userId, socket.id);
    this.userSockets.set(socket.id, userId);
    
    // Join user's personal room for notifications
    socket.join(`user:${userId}`);
    
    // Emit connection success
    socket.emit('connected', {
      userId: userId,
      message: 'Successfully connected to chat server'
    });
  }

  handleDisconnection(socket) {
    const userId = socket.userId;
    const socketId = socket.id;
    
    console.log(`User disconnected: ${socket.userName} (${userId})`);
    
    // Clean up connection maps
    this.connectedUsers.delete(userId);
    this.userSockets.delete(socketId);
    
    // Leave all rooms
    socket.leaveAll();
  }

  handleJoinChat(socket) {
    socket.on('join_chat', async (chatId) => {
      try {
        // Verify user is participant in chat
        const chat = await Chat.findOne({
          _id: chatId,
          'participants.user': socket.userId,
          isActive: true
        });

        if (!chat) {
          socket.emit('error', { message: 'Chat not found or access denied' });
          return;
        }

        // Join chat room
        socket.join(`chat:${chatId}`);
        socket.currentChatId = chatId;
        
        console.log(`User ${socket.userName} joined chat: ${chatId}`);
        
        socket.emit('joined_chat', { chatId, message: 'Successfully joined chat' });
        
      } catch (error) {
        console.error('Join chat error:', error);
        socket.emit('error', { message: 'Failed to join chat' });
      }
    });
  }

  handleLeaveChat(socket) {
    socket.on('leave_chat', (chatId) => {
      if (socket.currentChatId === chatId) {
        socket.leave(`chat:${chatId}`);
        socket.currentChatId = null;
        console.log(`User ${socket.userName} left chat: ${chatId}`);
        socket.emit('left_chat', { chatId, message: 'Successfully left chat' });
      }
    });
  }

  handleTyping(socket) {
    socket.on('typing', (data) => {
      const { chatId } = data;
      if (socket.currentChatId === chatId) {
        socket.to(`chat:${chatId}`).emit('user_typing', {
          chatId,
          userId: socket.userId,
          userName: socket.userName
        });
      }
    });
  }

  handleStopTyping(socket) {
    socket.on('stop_typing', (data) => {
      const { chatId } = data;
      if (socket.currentChatId === chatId) {
        socket.to(`chat:${chatId}`).emit('user_stop_typing', {
          chatId,
          userId: socket.userId,
          userName: socket.userName
        });
      }
    });
  }

  // Method to broadcast message to chat participants
  async broadcastMessage(chatId, message, senderId) {
    try {
      const chat = await Chat.findById(chatId).populate('participants.user', 'name photoUrl');
      
      if (!chat) return;

      const messageData = {
        chatId,
        message: {
          _id: message._id,
          content: message.content,
          messageType: message.messageType,
          sender: {
            _id: senderId,
            name: message.sender.name,
            photoUrl: message.sender.photoUrl
          },
          createdAt: message.createdAt,
          isRead: false
        }
      };

      // Broadcast to all users in the chat room
      this.io.to(`chat:${chatId}`).emit('new_message', messageData);
      
      // Send notification to offline participants
      const offlineParticipants = chat.participants.filter(p => 
        !this.connectedUsers.has(p.user._id.toString())
      );
      
      // Store notifications for offline users (could be saved to DB)
      console.log(`Message sent to ${this.io.sockets.adapter.rooms.get(`chat:${chatId}`)?.size || 0} online participants`);
      
    } catch (error) {
      console.error('Broadcast message error:', error);
    }
  }

  // Method to send notification to specific user
  sendNotification(userId, notification) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit('notification', notification);
    }
  }

  // Method to get online status
  isUserOnline(userId) {
    return this.connectedUsers.has(userId);
  }

  // Method to get connected users count
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }
}

module.exports = SocketServer; 