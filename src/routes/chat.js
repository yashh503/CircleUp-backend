const express = require('express');
const { body } = require('express-validator');
const Chat = require('../models/Chat');
const User = require('../models/User');
const Event = require('../models/Event');
const { auth } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/chat
// @desc    Get user's chat conversations
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const chats = await Chat.find({
      'participants.user': req.user._id,
      isActive: true
    })
    .populate('participants.user', 'name photoUrl trustScore badges')
    .populate('event', 'title category')
    .populate('lastMessage.sender', 'name photoUrl')
    .sort({ lastActivity: -1 })
    .lean();

    // Add unread count for current user
    const chatsWithUnread = chats.map(chat => {
      const unreadCount = chat.unreadCount?.[req.user._id.toString()] || 0;
      return {
        ...chat,
        unreadCount,
        chatName: chat.title || `Chat with ${chat.participants.length} people`
      };
    });    

    res.json({
      success: true,
      data: {
        chats: chatsWithUnread
      }
    });

  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting chats'
    });
  }
});

// @route   POST /api/chat
// @desc    Create a new chat or get existing chat
// @access  Private
router.post('/', [
  auth,
  body('participants').isArray({ min: 1 }),
  body('eventId').optional().isMongoId(),
  body('title').optional().isLength({ max: 100 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const { participants, eventId, title } = req.body;
    
    // Add current user to participants if not already included
    const allParticipants = [...new Set([...participants, req.user._id.toString()])];
    
    // Check if chat already exists
    let existingChat = await Chat.findOne({
      'participants.user': { $all: allParticipants },
      type: allParticipants.length === 2 ? 'direct' : 'group',
      isActive: true
    });

    if (existingChat) {
      // Return existing chat
      await existingChat.populate('participants.user', 'name photoUrl trustScore badges');
      await existingChat.populate('event', 'title category');
      
      return res.json({
        success: true,
        message: 'Chat already exists',
        data: {
          chat: existingChat.getPublicInfo()
        }
      });
    }

    // Create new chat
    const chat = new Chat({
      type: allParticipants.length === 2 ? 'direct' : 'group',
      participants: allParticipants.map(userId => ({
        user: userId,
        role: userId === req.user._id.toString() ? 'admin' : 'member'
      })),
      event: eventId || null,
      title: title || null
    });

    await chat.save();

    // Populate chat data
    await chat.populate('participants.user', 'name photoUrl trustScore badges');
    await chat.populate('event', 'title category');

    res.status(201).json({
      success: true,
      message: 'Chat created successfully',
      data: {
        chat: chat.getPublicInfo()
      }
    });

  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating chat'
    });
  }
});

// @route   GET /api/chat/:id
// @desc    Get chat messages
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      'participants.user': req.user._id,
      isActive: true
    }).populate({
      path: 'messages.sender',
      select: '_id name photoUrl' // only get what you need
    })
    .populate({
      path: 'lastMessage.sender',
      select: '_id name photoUrl'
    });;

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Mark messages as read for current user
    await chat.markAsRead(req.user._id);

    // Get messages from chat document
    const messages = chat.messages || [];

    res.json({
      success: true,
      data: {
        chat: chat.getPublicInfo(),
        messages
      }
    });

  } catch (error) {
    console.error('Get chat messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting chat messages'
    });
  }
});

// @route   POST /api/chat/:id/messages
// @desc    Send a message to chat
// @access  Private
router.post('/:id/messages', [
  auth,
  body('content').isLength({ min: 1, max: 1000 }),
  body('messageType').optional().isIn(['text', 'image', 'location']),
  body('mediaUrl').optional().isURL(),
  body('location').optional().isObject(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { content, messageType = 'text', mediaUrl, location } = req.body;

    // Find chat (but don’t load full doc, just verify existence + participants)
    const chat = await Chat.findOne({
      _id: req.params.id,
      'participants.user': req.user._id,
      isActive: true
    }).lean(); // lean because we don’t need mongoose doc

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Build new message object
    const message = {
      sender: req.user._id,
      content: content.trim(),
      messageType,
      mediaUrl: mediaUrl?.trim() || null,
      location: location || null,
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Prepare $inc for unread counts
    const incFields = {};
    chat.participants.forEach(p => {
      if (p.user.toString() !== req.user._id.toString()) {
        incFields[`unreadCount.${p.user.toString()}`] = 1;
      }
    });

    // Atomic update: push msg, update lastMessage + lastActivity, increment unread counts
    await Chat.findByIdAndUpdate(chat._id, {
      $push: { messages: message },
      $set: {
        lastMessage: message,
        lastActivity: new Date()
      },
      ...(Object.keys(incFields).length ? { $inc: incFields } : {})
    });

    // Broadcast message via WebSocket for real-time delivery
    const socketServer = req.app.get('socketServer');
    if (socketServer) {
      await socketServer.broadcastMessage(chat._id, {
        ...message,
        sender: {
          _id: req.user._id,
          name: req.user.name,
          photoUrl: req.user.photoUrl
        }
      }, req.user._id);
    }

    // Build populated response message
    const populatedMessage = {
      ...message,
      sender: {
        _id: req.user._id,
        name: req.user.name,
        photoUrl: req.user.photoUrl
      }
    };

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        message: populatedMessage
      }
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending message'
    });
  }
});


// @route   POST /api/chat/event/:eventId
// @desc    Create or get event-specific chat
// @access  Private
router.post('/event/:eventId', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if user is participating in the event
    const isParticipant = event.participants.some(
      p => p.user.toString() === req.user._id.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Must be participating in event to access chat'
      });
    }

    // Check if event chat already exists
    let eventChat = await Chat.findOne({
      event: req.params.eventId,
      type: 'group',
      isActive: true
    });

    if (!eventChat) {
      // Create new event chat
      const participantIds = event.participants.map(p => p.user);
      
      eventChat = new Chat({
        type: 'group',
        participants: participantIds.map(userId => ({
          user: userId,
          role: userId.toString() === event.creator.toString() ? 'admin' : 'member'
        })),
        event: req.params.eventId,
        title: `Event: ${event.title}`
      });

      await eventChat.save();
    }

    // Add current user if not already in chat
    await eventChat.addParticipant(req.user._id);

    // Populate chat data
    await eventChat.populate('participants.user', 'name photoUrl trustScore badges');
    await eventChat.populate('event', 'title category');

    res.json({
      success: true,
      data: {
        chat: eventChat.getPublicInfo()
      }
    });

  } catch (error) {
    console.error('Event chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Error accessing event chat'
    });
  }
});

// @route   PUT /api/chat/:id/read
// @desc    Mark chat as read
// @access  Private
router.put('/:id/read', auth, async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      'participants.user': req.user._id,
      isActive: true
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    await chat.markAsRead(req.user._id);

    res.json({
      success: true,
      message: 'Chat marked as read'
    });

  } catch (error) {
    console.error('Mark chat read error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking chat as read'
    });
  }
});

// @route   DELETE /api/chat/:id
// @desc    Leave chat
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      'participants.user': req.user._id,
      isActive: true
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Remove user from chat
    await chat.removeParticipant(req.user._id);

    // If no participants left, deactivate chat
    if (chat.participants.length === 0) {
      chat.isActive = false;
      await chat.save();
    }

    res.json({
      success: true,
      message: 'Left chat successfully'
    });

  } catch (error) {
    console.error('Leave chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Error leaving chat'
    });
  }
});

module.exports = router; 