const mongoose = require('mongoose');
const crypto = require('crypto');

const examSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  targetAudience: {
    type: String,
    required: true,
    trim: true
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  accessLink: {
    type: String,
    unique: true
  },
  questions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  totalPoints: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Generate unique access link before saving
examSchema.pre('save', function(next) {
  if (!this.accessLink) {
    this.accessLink = crypto.randomBytes(32).toString('hex');
  }
  next();
});

// Calculate total points
examSchema.methods.updateTotalPoints = async function() {
  const Question = mongoose.model('Question');
  const questions = await Question.find({ _id: { $in: this.questions } });
  this.totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);
  await this.save();
};

module.exports = mongoose.model('Exam', examSchema);
