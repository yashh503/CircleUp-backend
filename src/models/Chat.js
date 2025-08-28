const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: [true, 'Message content is required'],
    trim: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'location'],
    default: 'text'
  },
  mediaUrl: {
    type: String,
    trim: true
  },
  location: {
    lat: Number,
    lng: Number,
    name: String
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  }
}, {
  timestamps: true
});

const chatSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['direct', 'group'],
    required: true
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['member', 'admin'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    lastRead: {
      type: Date,
      default: Date.now
    }
  }],
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  title: {
    type: String,
    trim: true,
    maxlength: [100, 'Chat title cannot exceed 100 characters']
  },
  lastMessage: {
    type: messageSchema
  },
  messages: [{
    type: messageSchema
  }],
  unreadCount: {
    type: Map,
    of: Number,
    default: new Map()
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
chatSchema.index({ participants: 1 });
chatSchema.index({ event: 1 });
chatSchema.index({ lastActivity: -1 });
chatSchema.index({ 'participants.user': 1, lastActivity: -1 });

// Virtual for getting chat name
chatSchema.virtual('chatName').get(function() {
  if (this.title) return this.title;
  if (this.type === 'direct' && this.participants.length === 2) {
    // For direct chats, return the other person's name
    return 'Direct Chat'; // This would be populated in the API
  }
  return 'Group Chat';
});

// Method to add participant
chatSchema.methods.addParticipant = function(userId, role = 'member') {
  const existingParticipant = this.participants.find(
    p => p.user.toString() === userId.toString()
  );
  
  if (!existingParticipant) {
    this.participants.push({
      user: userId,
      role: role
    });
    this.unreadCount.set(userId.toString(), 0);
  }
  
  return this.save();
};

// Method to remove participant
chatSchema.methods.removeParticipant = function(userId) {
  const participantIndex = this.participants.findIndex(
    p => p.user.toString() === userId.toString()
  );
  
  if (participantIndex > -1) {
    this.participants.splice(participantIndex, 1);
    this.unreadCount.delete(userId.toString());
    return this.save();
  }
  
  return this;
};

// Method to mark message as read
chatSchema.methods.markAsRead = function(userId) {
  const participant = this.participants.find(
    p => p.user.toString() === userId.toString()
  );
  
  if (participant) {
    participant.lastRead = new Date();
    this.unreadCount.set(userId.toString(), 0);
    return this.save();
  }
  
  return this;
};

// Method to increment unread count
chatSchema.methods.incrementUnreadCount = function(userId) {
  const currentCount = this.unreadCount.get(userId.toString()) || 0;
  this.unreadCount.set(userId.toString(), currentCount + 1);
  return this.save();
};

// Method to get public chat info
chatSchema.methods.getPublicInfo = function() {
  return {
    _id: this._id,
    type: this.type,
    participants: this.participants.length,
    event: this.event,
    title: this.title,
    lastMessage: this.lastMessage,
    lastActivity: this.lastActivity,
    messagesCount: this.messages ? this.messages.length : 0,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model('Chat', chatSchema);
module.exports.MessageSchema = messageSchema; 