const express = require('express');
const { body } = require('express-validator');
const Feedback = require('../models/Feedback');
const User = require('../models/User');
const Event = require('../models/Event');
const { auth } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// @route   POST /api/feedback
// @desc    Submit feedback for another user after an event
// @access  Private
router.post('/', [
  auth,
  body('toUser').isMongoId(),
  body('event').isMongoId(),
  body('rating').isInt({ min: 1, max: 5 }),
  body('feedbackType').isIn(['good_buddy', 'flaky_buddy', 'neutral']),
  body('comment').optional().isLength({ max: 500 }),
  body('isAnonymous').optional().isBoolean(),
  handleValidationErrors
], async (req, res) => {
  try {
    const {
      toUser, event, rating, feedbackType, comment, isAnonymous = false
    } = req.body;

    // Prevent self-feedback
    if (toUser === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot give feedback to yourself'
      });
    }

    // Check if event exists and user participated
    const eventDoc = await Event.findById(event);
    if (!eventDoc) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if both users participated in the event
    const currentUserParticipated = eventDoc.participants.some(
      p => p.user.toString() === req.user._id.toString()
    );
    const targetUserParticipated = eventDoc.participants.some(
      p => p.user.toString() === toUser
    );

    if (!currentUserParticipated || !targetUserParticipated) {
      return res.status(403).json({
        success: false,
        message: 'Both users must have participated in the event'
      });
    }

    // Check if event is completed or past
    if (eventDoc.status === 'upcoming' && new Date() < eventDoc.dateTime) {
      return res.status(400).json({
        success: false,
        message: 'Can only give feedback for completed events'
      });
    }

    // Check if feedback already exists
    const existingFeedback = await Feedback.findOne({
      fromUser: req.user._id,
      toUser,
      event
    });

    if (existingFeedback) {
      return res.status(400).json({
        success: false,
        message: 'Feedback already submitted for this event'
      });
    }

    // Calculate trust score change
    let trustScoreChange = 0;
    switch (feedbackType) {
      case 'good_buddy':
        trustScoreChange = 10;
        break;
      case 'flaky_buddy':
        trustScoreChange = -15;
        break;
      case 'neutral':
        trustScoreChange = 0;
        break;
    }

    // Create feedback
    const feedback = new Feedback({
      fromUser: req.user._id,
      toUser,
      event,
      rating,
      feedbackType,
      comment: comment?.trim() || null,
      trustScoreChange,
      isAnonymous
    });

    await feedback.save();

    // Update target user's trust score
    const targetUser = await User.findById(toUser);
    if (targetUser) {
      await targetUser.updateTrustScore(trustScoreChange);
    }

    // Populate feedback data
    await feedback.populate('fromUser', 'name');
    await feedback.populate('toUser', 'name');
    await feedback.populate('event', 'title');

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      data: {
        feedback: feedback.getPublicInfo()
      }
    });

  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting feedback'
    });
  }
});

// @route   GET /api/feedback/received
// @desc    Get feedback received by current user
// @access  Private
router.get('/received', auth, async (req, res) => {
  try {
    const feedback = await Feedback.find({
      toUser: req.user._id
    })
    .populate('fromUser', 'name photoUrl')
    .populate('event', 'title category')
    .sort({ createdAt: -1 })
    .lean();

    // Calculate summary statistics
    const totalFeedback = feedback.length;
    const averageRating = totalFeedback > 0 
      ? feedback.reduce((sum, f) => sum + f.rating, 0) / totalFeedback 
      : 0;
    
    const feedbackBreakdown = {
      good_buddy: feedback.filter(f => f.feedbackType === 'good_buddy').length,
      flaky_buddy: feedback.filter(f => f.feedbackType === 'flaky_buddy').length,
      neutral: feedback.filter(f => f.feedbackType === 'neutral').length
    };

    res.json({
      success: true,
      data: {
        feedback: feedback.map(f => ({
          ...f,
          fromUser: f.isAnonymous ? null : f.fromUser
        })),
        summary: {
          totalFeedback,
          averageRating: Math.round(averageRating * 10) / 10,
          feedbackBreakdown
        }
      }
    });

  } catch (error) {
    console.error('Get received feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting feedback'
    });
  }
});

// @route   GET /api/feedback/given
// @desc    Get feedback given by current user
// @access  Private
router.get('/given', auth, async (req, res) => {
  try {
    const feedback = await Feedback.find({
      fromUser: req.user._id
    })
    .populate('toUser', 'name photoUrl')
    .populate('event', 'title category')
    .sort({ createdAt: -1 })
    .lean();

    res.json({
      success: true,
      data: {
        feedback
      }
    });

  } catch (error) {
    console.error('Get given feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting feedback'
    });
  }
});

// @route   GET /api/feedback/user/:userId
// @desc    Get public feedback for a specific user
// @access  Public
router.get('/user/:userId', async (req, res) => {
  try {
    const feedback = await Feedback.find({
      toUser: req.params.userId,
      moderationStatus: 'approved'
    })
    .populate('event', 'title category')
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

    // Get user's average rating and trust score breakdown
    const [averageRating, trustScoreBreakdown] = await Promise.all([
      Feedback.getUserAverageRating(req.params.userId),
      Feedback.getUserTrustScoreBreakdown(req.params.userId)
    ]);

    res.json({
      success: true,
      data: {
        feedback: feedback.map(f => ({
          ...f,
          fromUser: f.isAnonymous ? null : { _id: 'anonymous', name: 'Anonymous' }
        })),
        summary: {
          averageRating: averageRating.averageRating,
          totalFeedback: averageRating.totalFeedback,
          trustScoreBreakdown
        }
      }
    });

  } catch (error) {
    console.error('Get user feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting user feedback'
    });
  }
});

// @route   GET /api/feedback/event/:eventId
// @desc    Get feedback for a specific event
// @access  Private
router.get('/event/:eventId', auth, async (req, res) => {
  try {
    // Check if user participated in the event
    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const userParticipated = event.participants.some(
      p => p.user.toString() === req.user._id.toString()
    );

    if (!userParticipated) {
      return res.status(403).json({
        success: false,
        message: 'Must have participated in event to view feedback'
      });
    }

    const feedback = await Feedback.find({
      event: req.params.eventId
    })
    .populate('fromUser', 'name photoUrl')
    .populate('toUser', 'name photoUrl')
    .sort({ createdAt: -1 })
    .lean();

    res.json({
      success: true,
      data: {
        feedback: feedback.map(f => ({
          ...f,
          fromUser: f.isAnonymous ? null : f.fromUser
        }))
      }
    });

  } catch (error) {
    console.error('Get event feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting event feedback'
    });
  }
});

// @route   PUT /api/feedback/:id
// @desc    Update feedback (only by creator within time limit)
// @access  Private
router.put('/:id', [
  auth,
  body('rating').optional().isInt({ min: 1, max: 5 }),
  body('feedbackType').optional().isIn(['good_buddy', 'flaky_buddy', 'neutral']),
  body('comment').optional().isLength({ max: 500 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    if (feedback.fromUser.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Can only update your own feedback'
      });
    }

    // Check if feedback is within editable time limit (24 hours)
    const feedbackAge = Date.now() - feedback.createdAt.getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    
    if (feedbackAge > twentyFourHours) {
      return res.status(400).json({
        success: false,
        message: 'Feedback can only be edited within 24 hours'
      });
    }

    const updates = req.body;
    const allowedUpdates = ['rating', 'feedbackType', 'comment'];
    
    // Calculate new trust score change
    let newTrustScoreChange = feedback.trustScoreChange;
    if (updates.feedbackType && updates.feedbackType !== feedback.feedbackType) {
      switch (updates.feedbackType) {
        case 'good_buddy':
          newTrustScoreChange = 10;
          break;
        case 'flaky_buddy':
          newTrustScoreChange = -15;
          break;
        case 'neutral':
          newTrustScoreChange = 0;
          break;
      }
    }

    // Update feedback
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        if (field === 'comment') {
          feedback[field] = updates[field]?.trim() || null;
        } else {
          feedback[field] = updates[field];
        }
      }
    });
    
    feedback.trustScoreChange = newTrustScoreChange;
    await feedback.save();

    // Update target user's trust score if feedback type changed
    if (updates.feedbackType && updates.feedbackType !== feedback.feedbackType) {
      const targetUser = await User.findById(feedback.toUser);
      if (targetUser) {
        // Remove old score change and add new one
        const scoreDifference = newTrustScoreChange - feedback.trustScoreChange;
        await targetUser.updateTrustScore(scoreDifference);
      }
    }

    // Populate feedback data
    await feedback.populate('fromUser', 'name');
    await feedback.populate('toUser', 'name');
    await feedback.populate('event', 'title');

    res.json({
      success: true,
      message: 'Feedback updated successfully',
      data: {
        feedback: feedback.getPublicInfo()
      }
    });

  } catch (error) {
    console.error('Update feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating feedback'
    });
  }
});

// @route   DELETE /api/feedback/:id
// @desc    Delete feedback (only by creator within time limit)
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    if (feedback.fromUser.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Can only delete your own feedback'
      });
    }

    // Check if feedback is within deletable time limit (24 hours)
    const feedbackAge = Date.now() - feedback.createdAt.getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    
    if (feedbackAge > twentyFourHours) {
      return res.status(400).json({
        success: false,
        message: 'Feedback can only be deleted within 24 hours'
      });
    }

    // Update target user's trust score
    const targetUser = await User.findById(feedback.toUser);
    if (targetUser) {
      await targetUser.updateTrustScore(-feedback.trustScoreChange);
    }

    await feedback.deleteOne();

    res.json({
      success: true,
      message: 'Feedback deleted successfully'
    });

  } catch (error) {
    console.error('Delete feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting feedback'
    });
  }
});

module.exports = router; 