const Exam = require('../models/exam');
const Question = require('../models/question');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function(req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 10
  fileFilter: function(req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/png', 'audio/mpeg', 'video/mp4'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
}).single('media');

// Create a new exam
exports.createExam = async (req, res) => {
  try {
    const { title, description, targetAudience } = req.body;

    const exam = new Exam({
      title,
      description,
      targetAudience,
      creator: req.user.userId
    });

    await exam.save();

    res.status(201).json({
      message: 'Exam created successfully',
      exam: {
        id: exam._id,
        title: exam.title,
        accessLink: exam.accessLink
      }
    });
  } catch (error) {
    console.error('Create exam error:', error);
    res.status(500).json({ message: 'Error creating exam' });
  }
};

// Add a question to an exam
exports.addQuestion = async (req, res) => {
  try {
    upload(req, res, async function(err) {
      if (err) {
        return res.status(400).json({ message: err.message });
      }

      const { examId } = req.params;
      const {
        type,
        questionText,
        options,
        correctAnswers,
        tolerance,
        duration,
        points
      } = req.body;

      const exam = await Exam.findById(examId);
      if (!exam) {
        return res.status(404).json({ message: 'Exam not found' });
      }

      if (exam.creator.toString() !== req.user.userId) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      const question = new Question({
        type,
        questionText,
        options: type === 'MCQ' ? JSON.parse(options) : undefined,
        correctAnswers: JSON.parse(correctAnswers),
        tolerance: type === 'direct' ? parseFloat(tolerance) : undefined,
        duration: parseInt(duration),
        points: parseInt(points),
        exam: examId,
        order: exam.questions.length + 1,
        media: req.file ? {
          type: req.file.mimetype.split('/')[0],
          url: `/uploads/${req.file.filename}`
        } : undefined
      });

      await question.save();
      exam.questions.push(question._id);
      await exam.updateTotalPoints();

      res.status(201).json({
        message: 'Question added successfully',
        question: {
          id: question._id,
          type: question.type,
          questionText: question.questionText
        }
      });
    });
  } catch (error) {
    console.error('Add question error:', error);
    res.status(500).json({ message: 'Error adding question' });
  }
};

// Get exam by access link
exports.getExamByLink = async (req, res) => {
  try {
    const { accessLink } = req.params;
    const exam = await Exam.findOne({ accessLink, isActive: true })
      .select('-questions.correctAnswers');

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found or inactive' });
    }

    res.json({
      exam: {
        id: exam._id,
        title: exam.title,
        description: exam.description,
        totalPoints: exam.totalPoints
      }
    });
  } catch (error) {
    console.error('Get exam error:', error);
    res.status(500).json({ message: 'Error retrieving exam' });
  }
};

// Get next question
exports.getNextQuestion = async (req, res) => {
  try {
    const { examId } = req.params;
    const { currentQuestionOrder } = req.query;

    const exam = await Exam.findById(examId)
      .populate({
        path: 'questions',
        match: { order: { $gt: parseInt(currentQuestionOrder) || 0 } },
        options: { sort: { order: 1 }, limit: 1 },
        select: '-correctAnswers'
      });

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    if (!exam.questions.length) {
      return res.json({ finished: true });
    }

    const question = exam.questions[0];
    res.json({
      question: {
        id: question._id,
        type: question.type,
        questionText: question.questionText,
        options: question.options,
        duration: question.duration,
        points: question.points,
        media: question.media,
        order: question.order
      }
    });
  } catch (error) {
    console.error('Get next question error:', error);
    res.status(500).json({ message: 'Error retrieving question' });
  }
};

// Submit answer
exports.submitAnswer = async (req, res) => {
  try {
    const { questionId } = req.params;
    const { answer } = req.body;

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const isCorrect = question.checkAnswer(answer);
    const earnedPoints = isCorrect ? question.points : 0;

    res.json({
      result: {
        isCorrect,
        earnedPoints,
        correctAnswer: question.correctAnswers
      }
    });
  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(500).json({ message: 'Error submitting answer' });
  }
};

// Get exam results
exports.getExamResults = async (req, res) => {
  try {
    const { examId } = req.params;
    const exam = await Exam.findById(examId)
      .populate('questions', 'points');

    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    const totalPoints = exam.totalPoints;
    const earnedPoints = req.body.questionResults.reduce(
      (sum, result) => sum + (result.isCorrect ? result.points : 0),
      0
    );

    const score = Math.round((earnedPoints / totalPoints) * 100);

    res.json({
      results: {
        totalPoints,
        earnedPoints,
        score
      }
    });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ message: 'Error calculating results' });
  }
};
