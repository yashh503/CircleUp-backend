const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  age: {
    type: Number,
    required: [true, 'Age is required'],
    min: [18, 'Must be at least 18 years old'],
    max: [100, 'Age cannot exceed 100']
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true
  },
  interests: [{
    type: String,
    trim: true,
    enum: [
      'Coffee & Tea', 'Food & Dining', 'Sports & Fitness', 'Music & Concerts',
      'Art & Culture', 'Technology', 'Travel', 'Books & Reading', 'Gaming',
      'Outdoor Activities', 'Photography', 'Cooking', 'Dancing', 'Networking',
      'Volunteering', 'Language Exchange', 'Board Games', 'Movies & TV'
    ]
  }],
  bio: {
    type: String,
    required: [true, 'Bio is required'],
    trim: true,
    minlength: [10, 'Bio must be at least 10 characters long'],
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  photoUrl: {
    type: String,
    trim: true,
    default: null
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },
  idVerified: {
    type: Boolean,
    default: false
  },
  trustScore: {
    type: Number,
    default: 50,
    min: 0,
    max: 100
  },
  badges: [{
    type: String,
    enum: ['Trusted Buddy', 'Event Organizer', 'Social Butterfly', 'Newcomer']
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for better query performance
userSchema.index({ city: 1, age: 1, interests: 1 });
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to update trust score
userSchema.methods.updateTrustScore = function(points) {
  this.trustScore = Math.max(0, Math.min(100, this.trustScore + points));
  
  // Update badges based on trust score
  this.badges = this.badges.filter(badge => badge !== 'Trusted Buddy');
  if (this.trustScore >= 80) {
    this.badges.push('Trusted Buddy');
  }
  
  return this.save();
};

// Method to get public profile (without sensitive info)
userSchema.methods.getPublicProfile = function() {
  return {
    _id: this._id,
    name: this.name,
    age: this.age,
    city: this.city,
    interests: this.interests,
    bio: this.bio,
    photoUrl: this.photoUrl,
    phoneVerified: this.phoneVerified,
    idVerified: this.idVerified,
    trustScore: this.trustScore,
    badges: this.badges,
    lastActive: this.lastActive
  };
};

module.exports = mongoose.model('User', userSchema); 