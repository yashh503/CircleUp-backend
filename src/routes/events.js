const express = require('express');
const { body } = require('express-validator');
const Event = require('../models/Event');
const User = require('../models/User');
const { auth, optionalAuth } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { fetchEventbriteEvents } = require('../services/eventbrite');

const router = express.Router();

// External events from Eventbrite
// GET /api/events/external?city=San%20Francisco&q=coffee&page=1&pageSize=20
router.get('/external', optionalAuth, async (req, res) => {
  try {
    const token = process.env.EVENTBRITE_TOKEN || "TB7TDUFBM5K7T5Q2XRZ4";
    if (!token) {
      return res.status(500).json({ success: false, message: 'EVENTBRITE_TOKEN not configured on server' });
    }

    const { city, q, page = 1, pageSize = 20 } = req.query;
    const result = await fetchEventbriteEvents({
      token,
      city,
      q,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Eventbrite fetch error:', error?.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch external events' });
  }
});

// @route   GET /api/events
// @desc    Get all events with optional filters
// @access  Public (with optional auth)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      city, category, type, groupSize, date, limit = 20, page = 1
    } = req.query;

    let filterCriteria = {
      status: { $in: ['upcoming', 'ongoing'] },
      dateTime: { $gte: new Date() }
    };

    // City filter
    if (city) {
      filterCriteria['location.city'] = { $regex: city, $options: 'i' };
    }

    // Category filter
    if (category) {
      filterCriteria.category = category;
    }

    // Type filter
    if (type) {
      filterCriteria.type = type;
    }

    // Group size filter
    if (groupSize) {
      filterCriteria.groupSize = groupSize;
    }

    // Date filter
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      filterCriteria.dateTime = {
        $gte: startDate,
        $lt: endDate
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const events = await Event.find(filterCriteria)
      .populate('creator', 'name photoUrl trustScore badges')
      .sort({ dateTime: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Event.countDocuments(filterCriteria);

    // Add additional info for each event
    const eventsWithInfo = events.map(event => {
      const eventInfo = event.getPublicInfo ? event.getPublicInfo() : event;
      
      // Check if current user is interested/participating
      let userStatus = null;
      if (req.user) {
        const participant = event.participants.find(
          p => p.user.toString() === req.user._id.toString()
        );
        if (participant) {
          userStatus = participant.status;
        }
      }

      return {
        ...eventInfo,
        userStatus,
        isFull: event.currentParticipants >= event.maxParticipants,
        isPast: new Date() > event.dateTime
      };
    });

    res.json({
      success: true,
      data: {
        events: eventsWithInfo,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          hasMore: skip + events.length < total
        }
      }
    });

  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting events'
    });
  }
});

// @route   POST /api/events
// @desc    Create a new event
// @access  Private
router.post('/', [
  auth,
  body('title').isLength({ min: 5, max: 100 }),
  body('description').isLength({ min: 10, max: 1000 }),
  body('category').isIn([
    'Coffee & Tea', 'Food & Dining', 'Sports & Fitness', 'Music & Concerts',
    'Art & Culture', 'Technology', 'Travel', 'Books & Reading', 'Gaming',
    'Outdoor Activities', 'Photography', 'Cooking', 'Dancing', 'Networking',
    'Volunteering', 'Language Exchange', 'Board Games', 'Movies & TV', 'Comedy Shows', 'Garba'
  ]),
  body('location.name').isLength({ min: 2, max: 100 }),
  body('location.address').isLength({ min: 5, max: 200 }),
  body('location.city').isLength({ min: 2, max: 50 }),
  body('dateTime').isISO8601(),
  body('maxParticipants').optional().isInt({ min: 2, max: 20000000 }),
  body('duration').optional().isInt({ min: 30, max: 6000 }),
  body('groupSize').isIn(['1:1', 'small_group', 'large_group']),
  body('ageRange.min').isInt({ min: 2, max: 100 }),
  body('tags').optional().isArray(),
  handleValidationErrors
], async (req, res) => {
  try {
    const {
      title, description, category, location, dateTime, maxParticipants,
      duration, groupSize, ageRange, tags, isPrivate, requiresApproval
    } = req.body;

    // Validate age range
    if (ageRange.min > ageRange.max) {
      return res.status(400).json({
        success: false,
        message: 'Minimum age cannot be greater than maximum age'
      });
    }

    // Validate date is in the future
    if (new Date(dateTime) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Event date must be in the future'
      });
    }

    const event = new Event({
      title: title.trim(),
      description: description.trim(),
      type: 'scheduled',
      category,
      location: {
        name: location.name.trim(),
        address: location.address.trim(),
        city: location.city.trim(),
        coordinates: location.coordinates || null
      },
      dateTime: new Date(dateTime),
      maxParticipants: maxParticipants || 10,
      duration: duration || 120,
      groupSize,
      ageRange,
      creator: req.user._id,
      tags: tags || [],
      isPrivate: isPrivate || false,
      requiresApproval: requiresApproval || false
    });

    await event.save();

    // Populate creator info
    await event.populate('creator', 'name photoUrl trustScore badges');

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: {
        event: event.getPublicInfo()
      }
    });

  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating event'
    });
  }
});

// @route   POST /api/events/instant
// @desc    Create an instant meetup
// @access  Private
router.post('/instant', [
  auth,
  body('title').isLength({ min: 5, max: 100 }),
  body('description').isLength({ min: 10, max: 1000 }),
  body('category').isIn([
    'Coffee & Tea', 'Food & Dining', 'Sports & Fitness', 'Music & Concerts',
    'Art & Culture', 'Technology', 'Travel', 'Books & Reading', 'Gaming',
    'Outdoor Activities', 'Photography', 'Cooking', 'Dancing', 'Networking',
    'Volunteering', 'Language Exchange', 'Board Games', 'Movies & TV'
  ]),
  body('location.name').isLength({ min: 2, max: 100 }),
  body('location.address').isLength({ min: 5, max: 200 }),
  body('location.city').isLength({ min: 2, max: 50 }),
  body('dateTime').isISO8601(),
  body('groupSize').isIn(['1:1', 'small_group', 'large_group']),
  body('maxParticipants').optional().isInt({ min: 2, max: 20 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const {
      title, description, category, location, dateTime, groupSize, maxParticipants
    } = req.body;

    // For instant meetups, date should be within next 4 hours
    const eventTime = new Date(dateTime);
    const now = new Date();
    const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);

    if (eventTime < now || eventTime > fourHoursFromNow) {
      return res.status(400).json({
        success: false,
        message: 'Instant meetup must be scheduled within the next 4 hours'
      });
    }

    const event = new Event({
      title: title.trim(),
      description: description.trim(),
      type: 'instant',
      category,
      location: {
        name: location.name.trim(),
        address: location.address.trim(),
        city: location.city.trim(),
        coordinates: location.coordinates || null
      },
      dateTime: eventTime,
      maxParticipants: maxParticipants || 8,
      duration: 120, // Default 2 hours for instant meetups
      groupSize,
      ageRange: {
        min: 18,
        max: 100
      },
      creator: req.user._id,
      tags: ['instant-meetup'],
      isPrivate: false,
      requiresApproval: false
    });

    await event.save();

    // Populate creator info
    await event.populate('creator', 'name photoUrl trustScore badges');

    res.status(201).json({
      success: true,
      message: 'Instant meetup created successfully',
      data: {
        event: event.getPublicInfo()
      }
    });

  } catch (error) {
    console.error('Create instant meetup error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating instant meetup'
    });
  }
});

// @route   GET /api/events/:id
// @desc    Get event by ID
// @access  Public (with optional auth)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('creator', 'name photoUrl trustScore badges')
      .populate('participants.user', 'name photoUrl trustScore badges');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const eventInfo = event.getPublicInfo();
    
    // Add user status if authenticated
    let userStatus = null;
    if (req.user) {
      const participant = event.participants.find(
        p => p.user._id.toString() === req.user._id.toString()
      );
      if (participant) {
        userStatus = participant.status;
      }
    }

    res.json({
      success: true,
      data: {
        event: {
          ...eventInfo,
          userStatus,
          participants: event.participants.map(p => ({
            user: p.user,
            status: p.status,
            joinedAt: p.joinedAt
          }))
        }
      }
    });

  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting event'
    });
  }
});

// @route   POST /api/events/:id/join
// @desc    Join an event
// @access  Private
router.post('/:id/join', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (event.status !== 'upcoming') {
      return res.status(400).json({
        success: false,
        message: 'Cannot join event that is not upcoming'
      });
    }

    if (event.isFull) {
      return res.status(400).json({
        success: false,
        message: 'Event is full'
      });
    }

    // Check if user is already a participant
    const existingParticipant = event.participants.find(
      p => p.user.toString() === req.user._id.toString()
    );

    if (existingParticipant) {
      return res.status(400).json({
        success: false,
        message: 'Already participating in this event'
      });
    }

    await event.addParticipant(req.user._id, 'interested');

    res.json({
      success: true,
      message: 'Successfully joined event',
      data: {
        event: event.getPublicInfo()
      }
    });

  } catch (error) {
    console.error('Join event error:', error);
    res.status(500).json({
      success: false,
      message: 'Error joining event'
    });
  }
});

// @route   DELETE /api/events/:id/leave
// @desc    Leave an event
// @access  Private
router.delete('/:id/leave', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (event.status !== 'upcoming') {
      return res.status(400).json({
        success: false,
        message: 'Cannot leave event that is not upcoming'
      });
    }

    await event.removeParticipant(req.user._id);

    res.json({
      success: true,
      message: 'Successfully left event',
      data: {
        event: event.getPublicInfo()
      }
    });

  } catch (error) {
    console.error('Leave event error:', error);
    res.status(500).json({
      success: false,
      message: 'Error leaving event'
    });
  }
});

// @route   PUT /api/events/:id
// @desc    Update event (only by creator)
// @access  Private
router.put('/:id', [
  auth,
  body('title').optional().isLength({ min: 5, max: 100 }),
  body('description').optional().isLength({ min: 10, max: 1000 }),
  body('maxParticipants').optional().isInt({ min: 2, max: 50 }),
  body('duration').optional().isInt({ min: 30, max: 480 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (event.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only event creator can update event'
      });
    }

    if (event.status !== 'upcoming') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update event that is not upcoming'
      });
    }

    const updates = req.body;
    const allowedUpdates = ['title', 'description', 'maxParticipants', 'duration'];
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        if (field === 'title' || field === 'description') {
          event[field] = updates[field].trim();
        } else {
          event[field] = updates[field];
        }
      }
    });

    await event.save();

    res.json({
      success: true,
      message: 'Event updated successfully',
      data: {
        event: event.getPublicInfo()
      }
    });

  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating event'
    });
  }
});

// @route   DELETE /api/events/:id
// @desc    Cancel event (only by creator)
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (event.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only event creator can cancel event'
      });
    }

    if (event.status !== 'upcoming') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel event that is not upcoming'
      });
    }

    event.status = 'cancelled';
    await event.save();

    res.json({
      success: true,
      message: 'Event cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel event error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling event'
    });
  }
});

module.exports = router; 