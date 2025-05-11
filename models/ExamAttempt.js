const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  question: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  submittedAnswer: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  isCorrect: {
    type: Boolean,
    required: true
  },
  points: {
    type: Number,
    required: true
  },
  answeredAt: {
    type: Date,
    required: true,
    default: Date.now
  }
}, { _id: false });

const examAttemptSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
      required: false
    },
    coordinates: {
      type: [Number],
      required: false
    }
  },
  answers: [answerSchema],
  totalScore: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'abandoned'],
    default: 'in-progress'
  }
}, {
  timestamps: true
});

// Index for geospatial queries
examAttemptSchema.index({ location: '2dsphere' });

// calculate final score
examAttemptSchema.methods.calculateScore = function() {
  const totalPoints = this.answers.reduce((sum, answer) => sum + answer.points, 0);
  this.totalScore = totalPoints;
  return totalPoints;
};

module.exports = mongoose.model('ExamAttempt', examAttemptSchema);
