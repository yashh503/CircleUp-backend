const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  toUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  feedbackType: {
    type: String,
    enum: ['good_buddy', 'flaky_buddy', 'neutral'],
    required: true
  },
  comment: {
    type: String,
    trim: true,
    maxlength: [500, 'Comment cannot exceed 500 characters']
  },
  trustScoreChange: {
    type: Number,
    required: true,
    enum: [10, -15, 0] // +10 for good, -15 for flaky, 0 for neutral
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  isModerated: {
    type: Boolean,
    default: false
  },
  moderationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  moderationNote: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
feedbackSchema.index({ fromUser: 1, toUser: 1, event: 1 }, { unique: true });
feedbackSchema.index({ toUser: 1, createdAt: -1 });
feedbackSchema.index({ event: 1 });
feedbackSchema.index({ feedbackType: 1 });

// Prevent users from giving feedback to themselves
feedbackSchema.pre('save', function(next) {
  if (this.fromUser.toString() === this.toUser.toString()) {
    return next(new Error('Users cannot give feedback to themselves'));
  }
  next();
});

// Method to get public feedback info
feedbackSchema.methods.getPublicInfo = function() {
  return {
    _id: this._id,
    fromUser: this.isAnonymous ? null : this.fromUser,
    toUser: this.toUser,
    event: this.event,
    rating: this.rating,
    feedbackType: this.feedbackType,
    comment: this.comment,
    trustScoreChange: this.trustScoreChange,
    isAnonymous: this.isAnonymous,
    createdAt: this.createdAt
  };
};

// Static method to get user's average rating
feedbackSchema.statics.getUserAverageRating = async function(userId) {
  const result = await this.aggregate([
    { $match: { toUser: mongoose.Types.ObjectId(userId) } },
    { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);
  
  return result.length > 0 ? {
    averageRating: Math.round(result[0].avgRating * 10) / 10,
    totalFeedback: result[0].count
  } : { averageRating: 0, totalFeedback: 0 };
};

// Static method to get user's trust score breakdown
feedbackSchema.statics.getUserTrustScoreBreakdown = async function(userId) {
  const result = await this.aggregate([
    { $match: { toUser: mongoose.Types.ObjectId(userId) } },
    { $group: { 
      _id: '$feedbackType', 
      count: { $sum: 1 },
      totalScoreChange: { $sum: '$trustScoreChange' }
    } }
  ]);
  
  const breakdown = {
    good_buddy: { count: 0, scoreChange: 0 },
    flaky_buddy: { count: 0, scoreChange: 0 },
    neutral: { count: 0, scoreChange: 0 }
  };
  
  result.forEach(item => {
    if (breakdown[item._id]) {
      breakdown[item._id].count = item.count;
      breakdown[item._id].scoreChange = item.totalScoreChange;
    }
  });
  
  return breakdown;
};

module.exports = mongoose.model('Feedback', feedbackSchema); 