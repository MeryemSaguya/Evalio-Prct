const express = require('express');
const router = express.Router();
const Exam = require('../models/exam');
const ExamAttempt = require('../models/ExamAttempt');
const auth = require('../middleware/auth');

// Start exam attempt
router.post('/exams/:examId/attempt', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can take exams' });
    }

    const exam = await Exam.findOne({
      _id: req.params.examId,
      isActive: true
    }).populate('questions');

    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    // Check if student already attempted this exam
    const existingAttempt = await ExamAttempt.findOne({
      exam: exam._id,
      student: req.user._id
    });

    if (existingAttempt) {
      return res.status(400).json({ error: 'You have already attempted this exam' });
    }

    // Create new attempt
    const { latitude, longitude } = req.body.location || {};
    const attempt = new ExamAttempt({
      exam: exam._id,
      student: req.user._id,
      startTime: new Date(),
      location: latitude && longitude ? {
        type: 'Point',
        coordinates: [longitude, latitude]
      } : undefined
    });

    await attempt.save();
    res.status(201).json(attempt);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Submit answer for a question
router.post('/attempts/:attemptId/answers', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can submit answers' });
    }

    const attempt = await ExamAttempt.findOne({
      _id: req.params.attemptId,
      student: req.user._id
    });

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    if (attempt.status === 'completed') {
      return res.status(400).json({ error: 'This attempt is already completed' });
    }

    const { questionId, answer } = req.body;
    const question = await Question.findById(questionId);

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Check if answer is correct and calculate score
    const isCorrect = question.checkAnswer(answer);
    const score = isCorrect ? question.points : 0;

    // Add or update answer
    const answerIndex = attempt.answers.findIndex(a => a.question.toString() === questionId);
    if (answerIndex > -1) {
      attempt.answers[answerIndex] = { question: questionId, answer, score };
    } else {
      attempt.answers.push({ question: questionId, answer, score });
    }

    await attempt.save();
    res.json({ isCorrect, score });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Complete exam attempt
router.post('/attempts/:attemptId/complete', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can complete exams' });
    }

    const attempt = await ExamAttempt.findOne({
      _id: req.params.attemptId,
      student: req.user._id
    });

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    if (attempt.status === 'completed') {
      return res.status(400).json({ error: 'This attempt is already completed' });
    }

    attempt.endTime = new Date();
    attempt.status = 'completed';
    attempt.finalScore = attempt.answers.reduce((sum, a) => sum + a.score, 0);

    await attempt.save();
    res.json(attempt);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get exam results
router.get('/attempts/:attemptId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const attempt = await ExamAttempt.findOne({
      _id: req.params.attemptId,
      student: req.user._id
    }).populate({
      path: 'exam',
      populate: {
        path: 'questions'
      }
    });

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    res.json(attempt);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
