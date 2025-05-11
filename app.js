require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const csrf = require('csurf');

// Import routes
const authRoutes = require('./routes/auth');
const examRoutes = require('./routes/exam');
const studentRoutes = require('./routes/students');

const app = express();

// Set up EJS view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session middleware
app.use(session({
    secret: process.env.JWT_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/evalio',
        ttl: 24 * 60 * 60 // 1 day
    }),
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        sameSite: 'lax'
    }
}));

// CSRF protection - only for non-GET requests
app.use((req, res, next) => {
    if (req.method === 'GET') {
        next();
    } else {
        csrf({
            cookie: {
                key: '_csrf',
                path: '/',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 3600, // 1 hour
                sameSite: 'lax'
            }
        })(req, res, next);
    }
});

// Make CSRF token available to all views
app.use((req, res, next) => {
    if (req.csrfToken) {
        res.locals.csrfToken = req.csrfToken();
    } else {
        res.locals.csrfToken = '';
    }
    next();
});

// Make user available to all templates
app.use((req, res, next) => {
    res.locals.user = req.session.user;
    next();
});

// Ensure uploads directory exists
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/evalio', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('Connected to MongoDB');
})
.catch((err) => {
    console.log('Error connecting to MongoDB:', err);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/students', studentRoutes);

// View routes
app.get('/', (req, res) => {
    res.render('index', { 
        title: 'Welcome to Evalio',
        user: req.session.user || null
    });
});

app.get('/login', (req, res) => {
    res.render('login', {
        title: 'Login - Evalio',
        user: req.session.user || null
    });
});

app.get('/register', (req, res) => {
    res.render('register', {
        title: 'Register - Evalio',
        user: req.session.user || null
    });
});

app.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('dashboard', {
        title: 'Dashboard - Evalio',
        user: req.session.user
    });
});

// Exam routes
app.get('/exams/create', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    if (req.session.user.role !== 'teacher') {
        return res.status(403).render('error', {
            title: 'Access Denied',
            message: 'Only teachers can create exams.',
            user: req.session.user
        });
    }
    res.render('exams/create', {
        title: 'Create Exam - Evalio',
        user: req.session.user
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', {
        title: 'Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!',
        user: req.session.user || null
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('error', {
        title: '404 - Page Not Found',
        message: 'The page you are looking for does not exist.',
        user: req.session.user || null
    });
});

// Server start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
