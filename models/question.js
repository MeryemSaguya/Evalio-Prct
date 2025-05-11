const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['image', 'audio', 'video'],
    required: true
  },
  url: {
    type: String,
    required: true
  }
}, { _id: false });

const questionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['direct', 'MCQ'],
    required: true
  },
  questionText: {
    type: String,
    required: true,
    trim: true
  },
  options: {
    type: [String],
    validate: {
      validator: function(v) {
        return this.type === 'MCQ' ? v.length >= 2 : true;
      },
      message: 'MCQ questions must have at least 2 options'
    }
  },
  correctAnswers: {
    type: [String],
    required: true,
    validate: {
      validator: function(v) {
        if (this.type === 'MCQ') {
          return v.length >= 1 && v.every(ans => this.options.includes(ans));
        }
        return v.length === 1; // Direct questions have exactly one correct answer
      },
      message: 'Invalid correct answers configuration'
    }
  },
  tolerance: {
    type: Number,
    min: 0,
    max: 100,
    validate: {
      validator: function(v) {
        return this.type === 'direct' ? v >= 0 : true;
      },
      message: 'Tolerance can only be set for direct questions'
    }
  },
  duration: {
    type: Number,
    required: true,
    min: 10, // Minimum 10 seconds
    max: 3600 // Maximum 1 hour
  },
  points: {
    type: Number,
    required: true,
    min: 0
  },
  media: {
    type: mediaSchema,
    required: false
  },
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  order: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

// Method to check if an answer is correct
questionSchema.methods.checkAnswer = function(answer) {
  if (this.type === 'MCQ') {
    // For QCM, check if the answers match exactly
    const submittedAnswers = Array.isArray(answer) ? answer : [answer];
    return (
      submittedAnswers.length === this.correctAnswers.length &&
      submittedAnswers.every(ans => this.correctAnswers.includes(ans))
    );
  } else {
    // For direct questions we apply tolerance
    const correctAnswer = this.correctAnswers[0];
    const submittedAnswer = answer.toString().trim().toLowerCase();
    
    // If the answer is numeric we apply percentage tolerance
    if (!isNaN(correctAnswer) && !isNaN(submittedAnswer)) {
      const correct = parseFloat(correctAnswer);
      const submitted = parseFloat(submittedAnswer);
      const tolerance = (this.tolerance || 0) / 100;
      return Math.abs(correct - submitted) <= correct * tolerance;
    }
    
    // For text answers we use string similarity with tolerance
    return this.calculateStringSimilarity(correctAnswer, submittedAnswer) >= (1 - this.tolerance / 100);
  }
};

// Helper method to calculate string similarity 
questionSchema.methods.calculateStringSimilarity = function(str1, str2) {
  const track = Array(str2.length + 1).fill(null).map(() =>
    Array(str1.length + 1).fill(null));
  for (let i = 0; i <= str1.length; i += 1) {
    track[0][i] = i;
  }
  for (let j = 0; j <= str2.length; j += 1) {
    track[j][0] = j;
  }
  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      );
    }
  }
  return 1 - (track[str2.length][str1.length] / Math.max(str1.length, str2.length));
};

module.exports = mongoose.model('Question', questionSchema);
