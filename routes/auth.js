const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const auth = require('../middleware/auth');

// Register new user
router.post('/register', async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    
    // Set session for the newly registered user
    req.session.user = user;
    
    // Redirect to dashboard
    res.redirect('/dashboard');
  } catch (error) {
    res.render('register', { 
      title: 'Register - Evalio', 
      user: null, 
      error: error.message 
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await user.comparePassword(password))) {
      return res.render('login', {
        title: 'Login - Evalio',
        user: null,
        error: 'Invalid login credentials'
      });
    }

    // Set session for the logged in user
    req.session.user = user;

    // Redirect to dashboard
    res.redirect('/dashboard');
  } catch (error) {
    res.render('login', {
      title: 'Login - Evalio',
      user: null,
      error: error.message
    });
  }
});

// Get current user profile
router.get('/profile', auth, async (req, res) => {
  res.json(req.user);
});

// Logout user
router.post('/logout', auth, async (req, res) => {
  try {
    // Clear the session
    req.session.destroy();
    res.redirect('/');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
