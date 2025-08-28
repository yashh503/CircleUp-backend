const express = require('express');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const User = require('../models/User');
const { handleValidationErrors, commonValidations } = require('../middleware/validation');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'fallback-secret',
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', [
  body('name').custom(value => {
    if (!value || value.trim().length < 2 || value.trim().length > 50) {
      throw new Error('Name must be between 2 and 50 characters');
    }
    return true;
  }),
  body('email').isEmail().normalizeEmail(),
  body('phone').isMobilePhone(),
  body('password').isLength({ min: 6 }),
  body('age').isInt({ min: 18, max: 100 }),
  body('city').isLength({ min: 2, max: 50 }),
  body('bio').isLength({ min: 10, max: 500 }),
  body('interests').isArray({ min: 1, max: 10 }),
  body('photoUrl').optional().isURL(),
  handleValidationErrors
], async (req, res) => {
  try {
    const {
      name, email, phone, password, age, city, interests, bio, photoUrl
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email 
          ? 'Email already registered' 
          : 'Phone number already registered'
      });
    }

    // Create new user
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password,
      age,
      city: city.trim(),
      interests: interests.map(interest => interest.trim()),
      bio: bio.trim(),
      photoUrl: photoUrl?.trim() || null
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Return user data (without password)
    const userResponse = user.getPublicProfile();
    userResponse.email = user.email; // Include email for new registrations

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: userResponse,
        token
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last active
    user.lastActive = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.getPublicProfile(),
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during login',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   POST /api/auth/verify-phone
// @desc    Verify phone number (stub for MVP)
// @access  Private
router.post('/verify-phone', async (req, res) => {
  try {
    // For MVP, just mark phone as verified
    // In production, this would integrate with SMS verification service
    
    res.json({
      success: true,
      message: 'Phone verification successful (stub)',
      data: {
        phoneVerified: true
      }
    });
  } catch (error) {
    console.error('Phone verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during phone verification'
    });
  }
});

// @route   POST /api/auth/verify-id
// @desc    Verify ID (stub for MVP)
// @access  Private
router.post('/verify-id', async (req, res) => {
  try {
    // For MVP, just mark ID as verified
    // In production, this would integrate with ID verification service
    
    res.json({
      success: true,
      message: 'ID verification successful (stub)',
      data: {
        idVerified: true
      }
    });
  } catch (error) {
    console.error('ID verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during ID verification'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', async (req, res) => {
  try {
    // This route would typically use auth middleware
    // For now, we'll return a message indicating it needs auth
    
    res.json({
      success: true,
      message: 'Use this route with Authorization header',
      note: 'This endpoint requires authentication middleware'
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting profile'
    });
  }
});

module.exports = router; 