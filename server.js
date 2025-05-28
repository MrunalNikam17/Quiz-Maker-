const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'student'], required: true },
    email: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now }
});

// Quiz Schema
const quizSchema = new mongoose.Schema({
    title: { type: String, required: true },
    questions: [{
        question: { type: String, required: true },
        options: { type: [String], required: true },
        correctAnswer: { type: Number, required: true }
    }],
    createdAt: { type: Date, default: Date.now }
});

// Quiz Submission Schema
const quizSubmissionSchema = new mongoose.Schema({
    quizId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Quiz', 
        required: true 
    },
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    answers: { type: [Number], required: true },
    score: { type: Number, required: true },
    correctAnswers: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    submittedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Quiz = mongoose.model('Quiz', quizSchema);
const QuizSubmission = mongoose.model('QuizSubmission', quizSubmissionSchema);

// Create default admin if not exists
const createDefaultAdmin = async () => {
    try {
        const adminExists = await User.findOne({ role: 'admin' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            const admin = new User({
                username: 'admin',
                password: hashedPassword,
                email: 'admin@quiz.com',
                role: 'admin'
            });
            await admin.save();
            console.log('Default admin created successfully');
        } else {
            console.log('Admin user already exists');
        }
    } catch (error) {
        console.error('Error in admin creation:', error);
    }
};

// Call createDefaultAdmin after MongoDB connection is established
mongoose.connection.on('connected', () => {
    console.log('MongoDB connected, creating admin user if needed...');
    createDefaultAdmin();
});

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        console.log('No token provided');
        return res.status(401).json({ error: 'Access denied' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) {
            console.log('Token verification failed:', err.message);
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Admin Middleware
const isAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        console.log('Admin access denied for user:', req.user);
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, email } = req.body;
        
        // Check if user exists
        const userExists = await User.findOne({ $or: [{ username }, { email }] });
        if (userExists) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user (only students can register)
        const user = new User({
            username,
            password: hashedPassword,
            email,
            role: 'student'
        });

        await user.save();

        // Generate token
        const token = jwt.sign(
            { id: user._id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({ token, user: { username, role: user.role } });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Find user
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ error: 'User not found' });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid password' });
        }

        // Generate token
        const token = jwt.sign(
            { id: user._id, username: user.username, role: user.role },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        res.json({ 
            token, 
            user: { 
                id: user._id,
                username: user.username, 
                role: user.role,
                email: user.email
            } 
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(400).json({ error: error.message });
    }
});

// Quiz Routes
app.post('/api/quizzes', authenticateToken, isAdmin, async (req, res) => {
    try {
        if (!req.body.title) {
            return res.status(400).json({ error: 'Title is required' });
        }
        const quiz = new Quiz(req.body);
        await quiz.save();
        res.status(201).json(quiz);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get('/api/quizzes', authenticateToken, async (req, res) => {
    try {
        const quizzes = await Quiz.find().sort({ createdAt: -1 });
        if (!quizzes || quizzes.length === 0) {
            return res.json([]); // Return empty array if no quizzes exist
        }
        res.json(quizzes);
    } catch (error) {
        console.error('Error fetching quizzes:', error);
        res.status(500).json({ error: 'Failed to fetch quizzes' });
    }
});

app.get('/api/quizzes/:id', authenticateToken, async (req, res) => {
    try {
        const quizId = req.params.id;
        
        // Validate quiz ID format
        if (!quizId || !/^[0-9a-fA-F]{24}$/.test(quizId)) {
            return res.status(400).json({ error: 'Invalid quiz ID format' });
        }

        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        // For students, don't include correct answers
        if (req.user.role === 'student') {
            const quizForStudent = {
                _id: quiz._id,
                title: quiz.title,
                questions: quiz.questions.map(q => ({
                    question: q.question,
                    options: q.options
                }))
            };
            return res.json(quizForStudent);
        }

        res.json(quiz);
    } catch (error) {
        console.error('Error fetching quiz:', error);
        res.status(500).json({ error: 'Failed to fetch quiz' });
    }
});

app.put('/api/quizzes/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        if (!req.body.title) {
            return res.status(400).json({ error: 'Title is required' });
        }
        const quiz = await Quiz.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );
        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }
        res.json(quiz);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.delete('/api/quizzes/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const quiz = await Quiz.findByIdAndDelete(req.params.id);
        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }
        res.json({ message: 'Quiz deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Quiz Submission Routes
app.post('/api/quizzes/:id/submit', authenticateToken, async (req, res) => {
    try {
        const quizId = req.params.id;
        
        // Validate quiz ID format
        if (!quizId || !/^[0-9a-fA-F]{24}$/.test(quizId)) {
            return res.status(400).json({ error: 'Invalid quiz ID format' });
        }

        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        const { answers } = req.body;
        if (!Array.isArray(answers) || answers.length !== quiz.questions.length) {
            return res.status(400).json({ error: 'Invalid answers format' });
        }

        // Calculate score
        let correctAnswers = 0;
        const correctAnswersList = [];
        answers.forEach((answer, index) => {
            if (answer === quiz.questions[index].correctAnswer) {
                correctAnswers++;
                correctAnswersList.push(index);
            }
        });

        const score = Math.round((correctAnswers / quiz.questions.length) * 100);

        // Save submission
        const submission = new QuizSubmission({
            quizId: new mongoose.Types.ObjectId(quizId),
            userId: new mongoose.Types.ObjectId(req.user.id),
            answers,
            score,
            correctAnswers,
            totalQuestions: quiz.questions.length,
            submittedAt: new Date()
        });

        await submission.save();

        res.json({
            score,
            correctAnswers,
            totalQuestions: quiz.questions.length,
            correctAnswersList
        });
    } catch (error) {
        console.error('Error submitting quiz:', error);
        res.status(500).json({ error: 'Failed to submit quiz' });
    }
});

// Admin Submissions Route
app.get('/api/submissions', authenticateToken, isAdmin, async (req, res) => {
    try {
        const submissions = await QuizSubmission.find()
            .populate('userId', 'username')
            .populate('quizId', 'title')
            .sort({ submittedAt: -1 });

        const formattedSubmissions = submissions.map(submission => {
            // Handle cases where quiz or user might have been deleted
            const studentName = submission.userId ? submission.userId.username : 'Deleted User';
            const quizTitle = submission.quizId ? submission.quizId.title : 'Deleted Quiz';
            
            return {
                studentName,
                quizTitle,
                score: submission.score,
                correctAnswers: submission.correctAnswers,
                totalQuestions: submission.totalQuestions,
                submittedAt: submission.submittedAt
            };
        });

        res.json(formattedSubmissions);
    } catch (error) {
        console.error('Error fetching submissions:', error);
        res.status(500).json({ error: 'Failed to fetch submissions' });
    }
});

// Student Performance Route
app.get('/api/my-submissions', authenticateToken, async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user.id);
        
        const submissions = await QuizSubmission.find({ userId })
            .populate('quizId', 'title')
            .sort({ submittedAt: -1 });

        const formattedSubmissions = submissions.map(submission => ({
            quizTitle: submission.quizId.title,
            score: submission.score,
            correctAnswers: submission.correctAnswers,
            totalQuestions: submission.totalQuestions,
            submittedAt: submission.submittedAt
        }));

        res.json(formattedSubmissions);
    } catch (error) {
        console.error('Error fetching student submissions:', error);
        res.status(500).json({ error: 'Failed to fetch submissions' });
    }
});

// Database Status Route
app.get('/api/status', authenticateToken, async (req, res) => {
    try {
        const quizCount = await Quiz.countDocuments();
        const userCount = await User.countDocuments();
        const submissionCount = await QuizSubmission.countDocuments();
        
        res.json({
            status: 'ok',
            quizCount,
            userCount,
            submissionCount
        });
    } catch (error) {
        console.error('Error checking database status:', error);
        res.status(500).json({ error: 'Failed to check database status' });
    }
});

app.listen(3000, '0.0.0.0', () => {
    console.log('Server is running on port 3000');
    console.log('Access the application at:');
    console.log('Local: http://localhost:3000');
    console.log('Network: http://YOUR_IP_ADDRESS:3000');
});
