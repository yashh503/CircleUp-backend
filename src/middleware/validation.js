const { validationResult } = require('express-validator');

// Middleware to check for validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors)
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// Common validation rules
const commonValidations = {
  name: {
    in: ['body'],
    isLength: {
      options: { min: 2, max: 50 },
      errorMessage: 'Name must be between 2 and 50 characters'
    },
    trim: true,
    escape: true
  },
  
  email: {
    in: ['body'],
    isEmail: {
      errorMessage: 'Please provide a valid email address'
    },
    normalizeEmail: true
  },
  
  phone: {
    in: ['body'],
    isMobilePhone: {
      errorMessage: 'Please provide a valid phone number'
    }
  },
  
  password: {
    in: ['body'],
    isLength: {
      options: { min: 6 },
      errorMessage: 'Password must be at least 6 characters long'
    }
  },
  
  age: {
    in: ['body'],
    isInt: {
      options: { min: 18, max: 100 },
      errorMessage: 'Age must be between 18 and 100'
    }
  },
  
  city: {
    in: ['body'],
    isLength: {
      options: { min: 2, max: 50 },
      errorMessage: 'City must be between 2 and 50 characters'
    },
    trim: true
  },
  
  bio: {
    in: ['body'],
    isLength: {
      options: { min: 10, max: 500 },
      errorMessage: 'Bio must be between 10 and 500 characters'
    },
    trim: true
  },
  
  photoUrl: {
    in: ['body'],
    optional: true,
    isURL: {
      errorMessage: 'Please provide a valid image URL'
    }
  },
  
  interests: {
    in: ['body'],
    isArray: {
      options: { min: 1, max: 10 },
      errorMessage: 'Please select between 1 and 10 interests'
    }
  },
  
  eventTitle: {
    in: ['body'],
    isLength: {
      options: { min: 5, max: 100 },
      errorMessage: 'Event title must be between 5 and 100 characters'
    },
    trim: true
  },
  
  eventDescription: {
    in: ['body'],
    isLength: {
      options: { min: 10, max: 1000 },
      errorMessage: 'Event description must be between 10 and 1000 characters'
    },
    trim: true
  },
  
  eventDateTime: {
    in: ['body'],
    isISO8601: {
      errorMessage: 'Please provide a valid date and time'
    },
    custom: {
      options: (value) => {
        const date = new Date(value);
        const now = new Date();
        return date > now;
      },
      errorMessage: 'Event date must be in the future'
    }
  },
  
  locationName: {
    in: ['body'],
    isLength: {
      options: { min: 2, max: 100 },
      errorMessage: 'Location name must be between 2 and 100 characters'
    },
    trim: true
  },
  
  locationAddress: {
    in: ['body'],
    isLength: {
      options: { min: 5, max: 200 },
      errorMessage: 'Address must be between 5 and 200 characters'
    },
    trim: true
  },
  
  maxParticipants: {
    in: ['body'],
    optional: true,
    isInt: {
      options: { min: 2, max: 50 },
      errorMessage: 'Maximum participants must be between 2 and 50'
    }
  },
  
  duration: {
    in: ['body'],
    optional: true,
    isInt: {
      options: { min: 30, max: 480 },
      errorMessage: 'Duration must be between 30 minutes and 8 hours'
    }
  },
  
  messageContent: {
    in: ['body'],
    isLength: {
      options: { min: 1, max: 1000 },
      errorMessage: 'Message must be between 1 and 1000 characters'
    },
    trim: true
  },
  
  rating: {
    in: ['body'],
    isInt: {
      options: { min: 1, max: 5 },
      errorMessage: 'Rating must be between 1 and 5'
    }
  },
  
  feedbackType: {
    in: ['body'],
    isIn: {
      options: [['good_buddy', 'flaky_buddy', 'neutral']],
      errorMessage: 'Invalid feedback type'
    }
  },
  
  comment: {
    in: ['body'],
    optional: true,
    isLength: {
      options: { max: 500 },
      errorMessage: 'Comment cannot exceed 500 characters'
    },
    trim: true
  }
};

module.exports = {
  handleValidationErrors,
  commonValidations
}; 