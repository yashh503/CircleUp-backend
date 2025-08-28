const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    minlength: [5, 'Title must be at least 5 characters long'],
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Event description is required'],
    trim: true,
    minlength: [10, 'Description must be at least 10 characters long'],
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  type: {
    type: String,
    required: true,
    enum: ['scheduled', 'instant'],
    default: 'scheduled'
  },
  category: {
    type: String,
    required: true,
  },
  location: {
    name: {
      type: String,
      required: [true, 'Location name is required'],
      trim: true
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  dateTime: {
    type: Date,
    required: [true, 'Event date and time is required']
  },
  duration: {
    type: Number, // in minutes
    default: 120
  },
  maxParticipants: {
    type: Number,
    default: 10,
    min: [2, 'Must allow at least 2 participants'],
    max: [20000000, 'Cannot exceed 50 participants']
  },
  currentParticipants: {
    type: Number,
    default: 0
  },
  groupSize: {
    type: String,
    required: true,
    enum: ['1:1', 'small_group', 'large_group'],
    default: 'small_group'
  },
  ageRange: {
    min: {
      type: Number,
      required: true
    },
    max: {
      type: Number,
      required: true
    }
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['interested', 'confirmed', 'attended', 'cancelled'],
      default: 'interested'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  tags: [{
    type: String,
    trim: true
  }],
  isPrivate: {
    type: Boolean,
    default: false
  },
  requiresApproval: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for better query performance
eventSchema.index({ city: 1, dateTime: 1, category: 1 });
eventSchema.index({ creator: 1 });
eventSchema.index({ status: 1, dateTime: 1 });
eventSchema.index({ 'location.city': 1, dateTime: 1 });

// Virtual for checking if event is full
eventSchema.virtual('isFull').get(function() {
  return this.currentParticipants >= this.maxParticipants;
});

// Virtual for checking if event is in the past
eventSchema.virtual('isPast').get(function() {
  return new Date() > this.dateTime;
});

// Method to add participant
eventSchema.methods.addParticipant = function(userId, status = 'interested') {
  const existingParticipant = this.participants.find(
    p => p.user.toString() === userId.toString()
  );
  
  if (existingParticipant) {
    existingParticipant.status = status;
  } else {
    this.participants.push({
      user: userId,
      status: status
    });
    this.currentParticipants++;
  }
  
  return this.save();
};

// Method to remove participant
eventSchema.methods.removeParticipant = function(userId) {
  const participantIndex = this.participants.findIndex(
    p => p.user.toString() === userId.toString()
  );
  
  if (participantIndex > -1) {
    this.participants.splice(participantIndex, 1);
    this.currentParticipants = Math.max(0, this.currentParticipants - 1);
    return this.save();
  }
  
  return this;
};

// Method to get public event info
eventSchema.methods.getPublicInfo = function() {
  return {
    _id: this._id,
    title: this.title,
    description: this.description,
    type: this.type,
    category: this.category,
    location: this.location,
    dateTime: this.dateTime,
    duration: this.duration,
    maxParticipants: this.maxParticipants,
    currentParticipants: this.currentParticipants,
    groupSize: this.groupSize,
    ageRange: this.ageRange,
    creator: this.creator,
    status: this.status,
    tags: this.tags,
    isPrivate: this.isPrivate,
    requiresApproval: this.requiresApproval,
    createdAt: this.createdAt,
    isFull: this.isFull,
    isPast: this.isPast
  };
};

module.exports = mongoose.model('Event', eventSchema); 