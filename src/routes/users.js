const express = require('express');
const { body } = require('express-validator');
const User = require('../models/User');
const Event = require('../models/Event');
const { auth } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    res.json({
      success: true,
      data: {
        user: user.getPublicProfile()
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting profile'
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', [
  auth,
  body('name').optional().isLength({ min: 2, max: 50 }),
  body('age').optional().isInt({ min: 18, max: 100 }),
  body('city').optional().isLength({ min: 2, max: 50 }),
  body('bio').optional().isLength({ min: 10, max: 500 }),
  body('interests').optional().isArray({ min: 1, max: 10 }),
  body('photoUrl').optional().isURL(),
  handleValidationErrors
], async (req, res) => {
  try {
    const updates = req.body;
    const allowedUpdates = ['name', 'age', 'city', 'bio', 'interests', 'photoUrl'];
    
    // Filter out invalid fields
    const validUpdates = {};
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        if (field === 'interests') {
          validUpdates[field] = updates[field].map(interest => interest.trim());
        } else if (field === 'name' || field === 'city' || field === 'bio') {
          validUpdates[field] = updates[field].trim();
        } else {
          validUpdates[field] = updates[field];
        }
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      validUpdates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: user.getPublicProfile()
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
});

// @route   GET /api/users/matches
// @desc    Get potential matches for an event
// @access  Private
router.get('/matches', auth, async (req, res) => {
  try {
    const { city, ageRange, interests } = req.query;

    let matchCriteria = {
      _id: { $ne: req.user._id }, // Exclude current user
      isActive: true
    };

    // 🔹 Filter by city if provided
    if (city) {
      matchCriteria.city = { $regex: city, $options: 'i' };
    }

    // 🔹 Filter by age range if provided
    if (ageRange) {
      const [minAge, maxAge] = ageRange.split('-').map(Number);
      if (!isNaN(minAge) && !isNaN(maxAge)) {
        matchCriteria.age = { $gte: minAge, $lte: maxAge };
      }
    }

    // 🔹 Filter by interests if provided
    if (interests && Array.isArray(interests)) {
      matchCriteria.interests = { $in: interests };
    }

    // 🔹 STEP 1: Fetch all events where current user is interested
    const myInterestedEvents = await Event.find({
      'participants.user': req.user._id,
      'participants.status': 'interested'
    }).select('_id title category dateTime location participants');

    // 🔹 STEP 2: Build a Map<userId, [events]> for shared interests
    const sharedEventMap = new Map();

    myInterestedEvents.forEach(event => {
      event.participants.forEach(p => {
        console.log(event, "event")
        if (
          p.status === 'interested' &&
          p.user.toString() !== req.user._id.toString()
        ) {
          if (!sharedEventMap.has(p.user.toString())) {
            sharedEventMap.set(p.user.toString(), []);
          }
          sharedEventMap.get(p.user.toString()).push({
            _id: event._id,
            title: event.title,
            category: event.category,
            dateTime: event?.dateTime,
            city: event.location?.city
          });
        }
      });
    });

    // 🔹 STEP 3: Fetch possible matches
    const users = await User.find(matchCriteria)
      .select(
        'name age city interests bio photoUrl trustScore badges phoneVerified idVerified lastActive'
      )
      .limit(50)
      .sort({ trustScore: -1, lastActive: -1 });

    // 🔹 STEP 4: Calculate match score + attach shared events
    const usersWithScore = users.map(user => {
      let matchScore = 0;
      const userInterests = user.interests || [];
      const currentUserInterests = req.user.interests || [];

      // +10 per overlapping interest
      currentUserInterests.forEach(interest => {
        if (userInterests.includes(interest)) {
          matchScore += 10;
        }
      });

      // +20 if sharing events
      let sharedEvents = [];
      if (sharedEventMap.has(user._id.toString())) {
        sharedEvents = sharedEventMap.get(user._id.toString());
        matchScore += 20;
      }

      // Verification & trust bonuses
      if (user.phoneVerified) matchScore += 5;
      if (user.idVerified) matchScore += 10;
      if (user.trustScore >= 80) matchScore += 15;
      else if (user.trustScore >= 60) matchScore += 10;

      return {
        ...user.toObject(),
        matchScore,
        sharedEvents // ✅ list of events both are interested in
      };
    });

    // 🔹 STEP 5: Sort by match score
    usersWithScore.sort((a, b) => b.matchScore - a.matchScore);

    res.json({
      success: true,
      data: {
        matches: usersWithScore,
        total: usersWithScore.length
      }
    });
  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting matches'
    });
  }
});



// @route   GET /api/users/:id
// @desc    Get public profile of another user
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('name age city interests bio photoUrl trustScore badges phoneVerified idVerified lastActive')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting user'
    });
  }
});

// @route   GET /api/users/search
// @desc    Search users by various criteria
// @access  Private
router.get('/search', auth, async (req, res) => {
  try {
    const { q, city, interests, minTrustScore } = req.query;
    
    let searchCriteria = {
      _id: { $ne: req.user._id },
      isActive: true
    };

    // Text search
    if (q) {
      searchCriteria.$or = [
        { name: { $regex: q, $options: 'i' } },
        { bio: { $regex: q, $options: 'i' } }
      ];
    }

    // City filter
    if (city) {
      searchCriteria.city = { $regex: city, $options: 'i' };
    }

    // Interests filter
    if (interests && Array.isArray(interests)) {
      searchCriteria.interests = { $in: interests };
    }

    // Trust score filter
    if (minTrustScore) {
      searchCriteria.trustScore = { $gte: parseInt(minTrustScore) };
    }

    const users = await User.find(searchCriteria)
      .select('name age city interests bio photoUrl trustScore badges')
      .limit(50)
      .sort({ trustScore: -1, lastActive: -1 });

    res.json({
      success: true,
      data: {
        users,
        total: users.length
      }
    });

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching users'
    });
  }
});

// @route   DELETE /api/users/profile
// @desc    Deactivate user account
// @access  Private
router.delete('/profile', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isActive: false });
    
    res.json({
      success: true,
      message: 'Account deactivated successfully'
    });
  } catch (error) {
    console.error('Deactivate account error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deactivating account'
    });
  }
});

module.exports = router; 