const express = require('express');
const router = express.Router();
const Exam = require('../models/exam');
const Question = require('../models/question');
const auth = require('../middleware/auth');

// Create new exam for (teacher only)
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Seuls les enseignants peuvent créer des examens' });
    }

    const {
      title,
      description,
      duration,
      passingScore,
      startDateTime,
      endDateTime,
      questionTypes
    } = req.body;

    // Validate required fields
    if (!title || !description || !duration || !passingScore || !startDateTime || !endDateTime) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    // Validate dates
    const startDate = new Date(startDateTime);
    const endDate = new Date(endDateTime);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Dates invalides' });
    }

    if (startDate >= endDate) {
      return res.status(400).json({ error: 'La date de fin doit être postérieure à la date de début' });
    }

    const exam = new Exam({
      title,
      description,
      duration,
      passingScore,
      startDate,
      endDate,
      questionTypes,
      creator: req.user._id
    });

    await exam.save();

    res.status(201).json({
      message: 'Examen créé avec succès',
      exam: {
        id: exam._id,
        title: exam.title,
        accessLink: exam.accessLink
      }
    });
  } catch (error) {
    console.error('Create exam error:', error);
    res.status(400).json({ error: error.message || 'Une erreur est survenue lors de la création de l\'examen' });
  }
});

// Get all exams for a teacher
router.get('/teacher', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const exams = await Exam.find({ creator: req.user._id })
      .populate('questions')
      .sort('-createdAt');
    res.json(exams);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get exam by access link (for students)
router.get('/access/:link', auth, async (req, res) => {
  try {
    const exam = await Exam.findOne({ 
      accessLink: req.params.link,
      isActive: true 
    }).populate('questions');

    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    res.json(exam);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get exam questions page
router.get('/:examId/questions', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).render('error', {
        title: 'Accès Refusé',
        message: 'Seuls les enseignants peuvent accéder à cette page',
        user: req.user
      });
    }

    const exam = await Exam.findOne({
      _id: req.params.examId,
      creator: req.user._id
    }).populate('questions');

    if (!exam) {
      return res.status(404).render('error', {
        title: 'Examen Non Trouvé',
        message: 'L\'examen demandé n\'existe pas',
        user: req.user
      });
    }

    res.render('exams/questions', {
      title: 'Gérer les Questions - ' + exam.title,
      exam: exam,
      user: req.user
    });
  } catch (error) {
    console.error('Get exam questions error:', error);
    res.status(500).render('error', {
      title: 'Erreur',
      message: 'Une erreur est survenue lors du chargement des questions',
      user: req.user
    });
  }
});

// Add question to exam for(teacher only)
router.post('/:examId/questions', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can add questions' });
    }

    const exam = await Exam.findOne({
      _id: req.params.examId,
      creator: req.user._id
    });

    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    const question = new Question({
      ...req.body,
      exam: exam._id,
      order: exam.questions.length + 1
    });

    await question.save();
    exam.questions.push(question._id);
    await exam.save();
    await exam.updateTotalPoints();

    res.status(201).json(question);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update question (teacher only)
router.put('/questions/:questionId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can update questions' });
    }

    const question = await Question.findById(req.params.questionId);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const exam = await Exam.findOne({
      _id: question.exam,
      creator: req.user._id
    });

    if (!exam) {
      return res.status(403).json({ error: 'Access denied' });
    }

    Object.assign(question, req.body);
    await question.save();
    await exam.updateTotalPoints();

    res.json(question);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete question for (teacher only)
router.delete('/questions/:questionId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can delete questions' });
    }

    const question = await Question.findById(req.params.questionId);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const exam = await Exam.findOne({
      _id: question.exam,
      creator: req.user._id
    });

    if (!exam) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await question.remove();
    exam.questions = exam.questions.filter(q => q.toString() !== question._id.toString());
    await exam.save();
    await exam.updateTotalPoints();

    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
