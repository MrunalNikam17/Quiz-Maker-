// DOM Elements
const roleSelection = document.getElementById('roleSelection');
const adminPanel = document.getElementById('adminPanel');
const studentPanel = document.getElementById('studentPanel');
const quizForm = document.getElementById('quizForm');
const quizTitle = document.getElementById('quizTitle');
const questionsContainer = document.getElementById('questionsContainer');
const addQuestionBtn = document.getElementById('addQuestion');
const quizManager = document.getElementById('quizManager');
const quizzesContainer = document.getElementById('quizzes');
const performanceStats = document.getElementById('performanceStats');
const totalStudents = document.getElementById('totalStudents');
const totalQuizzes = document.getElementById('totalQuizzes');
const totalAttempts = document.getElementById('totalAttempts');
const quizStats = document.getElementById('quizStats');
const myPerformance = document.getElementById('myPerformance');
const leaderboardList = document.getElementById('leaderboardList');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterLink = document.getElementById('showRegister');
const showLoginLink = document.getElementById('showLogin');
const loginFormContainer = document.getElementById('login-form');
const registerFormContainer = document.getElementById('register-form');

let currentUser = null;

// Role Selection
function selectRole(role) {
    currentUser = { role: role };
    roleSelection.classList.add('hidden');
    
    if (role === 'admin') {
        adminPanel.classList.remove('hidden');
        loadQuizManager();
        loadAdminStats();
    } else {
        studentPanel.classList.remove('hidden');
        loadQuizzes();
        loadMyPerformance();
        loadLeaderboard();
    }
}

// Logout
function logout() {
    currentUser = null;
    adminPanel.classList.add('hidden');
    studentPanel.classList.add('hidden');
    roleSelection.classList.remove('hidden');
}

// Load admin stats
async function loadAdminStats() {
    try {
        const response = await fetch('http://localhost:3000/api/admin/stats');
        const data = await response.json();
        
        // Update summary stats
        totalStudents.textContent = data.totalStudents;
        totalQuizzes.textContent = data.totalQuizzes;
        totalAttempts.textContent = data.totalAttempts;

        // Update quiz stats
        const quizStatsHTML = data.quizStats.map(stat => `
            <div class="quiz-stat-item">
                <h4>${stat.title}</h4>
                <p>Attempts: ${stat.attempts}</p>
                <p>Average Score: ${stat.avgScore.toFixed(2)}%</p>
                <p>Average Time: ${stat.avgTime.toFixed(2)}s</p>
            </div>
        `).join('');

        quizStats.innerHTML = quizStatsHTML;
    } catch (error) {
        console.error('Error loading admin stats:', error);
    }
}

// Question template
function createQuestionHTML(questionIndex) {
    return `
        <div class="question-block">
            <div class="form-group">
                <label>Question ${questionIndex + 1}</label>
                <input type="text" name="questions[${questionIndex}][question]" required>
            </div>
            <div class="options-container">
                <label>Options</label>
                <div class="grid">
                    <input type="text" name="questions[${questionIndex}][options][]" placeholder="Option 1" required>
                    <input type="text" name="questions[${questionIndex}][options][]" placeholder="Option 2" required>
                    <input type="text" name="questions[${questionIndex}][options][]" placeholder="Option 3" required>
                    <input type="text" name="questions[${questionIndex}][options][]" placeholder="Option 4" required>
                </div>
            </div>
            <div class="form-group">
                <label>Correct Answer (1-4)</label>
                <input type="number" name="questions[${questionIndex}][correctAnswer]" min="1" max="4" required>
            </div>
        </div>
    `;
}

// Add question button handler
addQuestionBtn.addEventListener('click', () => {
    const questionIndex = questionsContainer.children.length;
    questionsContainer.insertAdjacentHTML('beforeend', createQuestionHTML(questionIndex));
});

// Form submission handler
quizForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(quizForm);
    const quizData = {
        title: formData.get('quizTitle'),
        questions: []
    };

    // Get all questions
    const questionBlocks = questionsContainer.children;
    for (let i = 0; i < questionBlocks.length; i++) {
        const question = {
            question: formData.get(`questions[${i}][question]`),
            options: Array.from(formData.getAll(`questions[${i}][options][]`)),
            correctAnswer: parseInt(formData.get(`questions[${i}][correctAnswer]`)) - 1
        };
        quizData.questions.push(question);
    }

    try {
        const response = await fetch('http://localhost:3000/api/quizzes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(quizData)
        });

        if (response.ok) {
            alert('Quiz created successfully!');
            quizForm.reset();
            questionsContainer.innerHTML = '';
            loadQuizManager();
            loadAdminStats(); // Reload stats after creating a quiz
        } else {
            alert('Error creating quiz');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error creating quiz');
    }
});

// Load quiz manager (Admin)
async function loadQuizManager() {
    try {
        const response = await fetch('/api/quizzes');
        const quizzes = await response.json();
        
        quizManager.innerHTML = quizzes.map(quiz => `
            <div class="quiz-card bg-white p-4 rounded shadow">
                <h3 class="text-xl font-semibold mb-2">${quiz.title}</h3>
                <p class="text-gray-600 mb-4">${quiz.questions.length} questions</p>
                <div class="flex space-x-2">
                    <button onclick="editQuiz('${quiz._id}')" class="bg-yellow-500 text-white px-4 py-2 rounded">
                        Edit
                    </button>
                    <button onclick="deleteQuiz('${quiz._id}')" class="bg-red-500 text-white px-4 py-2 rounded">
                        Delete
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error:', error);
    }
}

// Load quizzes (Student)
async function loadQuizzes() {
    try {
        const response = await fetch('/api/quizzes');
        const quizzes = await response.json();
        
        quizzesContainer.innerHTML = quizzes.map(quiz => `
            <div class="quiz-card bg-white p-4 rounded shadow">
                <h3 class="text-xl font-semibold mb-2">${quiz.title}</h3>
                <p class="text-gray-600 mb-4">${quiz.questions.length} questions</p>
                <button onclick="startQuiz('${quiz._id}')" class="bg-blue-500 text-white px-4 py-2 rounded">
                    Take Quiz
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error:', error);
    }
}

// Load my performance (Student)
async function loadMyPerformance() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`/api/scores/user/${currentUser.username}`);
        const scores = await response.json();
        
        myPerformance.innerHTML = scores.map(score => `
            <div class="p-4">
                <div class="flex justify-between items-center">
                    <div>
                        <h3 class="font-semibold">${score.quizTitle}</h3>
                        <p class="text-gray-600">Completed: ${new Date(score.completedAt).toLocaleDateString()}</p>
                    </div>
                    <div>
                        <span class="mr-4">Score: ${score.score}</span>
                        <span class="text-gray-600">Time: ${score.timeSpent.toFixed(2)}s</span>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error:', error);
    }
}

// Start quiz
async function startQuiz(quizId) {
    try {
        const response = await fetch(`/api/quizzes/${quizId}`);
        const quiz = await response.json();
        
        const username = prompt('Enter your username:');
        if (!username) return;
        currentUser = { ...currentUser, username };

        const startTime = Date.now();
        let score = 0;
        
        for (let i = 0; i < quiz.questions.length; i++) {
            const question = quiz.questions[i];
            const answer = prompt(`${question.question}\n\n${question.options.map((opt, idx) => `${idx + 1}. ${opt}`).join('\n')}\n\nEnter number (1-4):`);
            
            if (!answer) break;
            
            if (parseInt(answer) - 1 === question.correctAnswer) {
                score++;
            }
        }

        const timeSpent = (Date.now() - startTime) / 1000;

        await fetch('/api/scores', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username,
                quizId,
                score,
                timeSpent
            })
        });

        alert(`Quiz completed!\nScore: ${score}/${quiz.questions.length}\nTime: ${timeSpent.toFixed(2)}s`);
        loadMyPerformance();
        loadLeaderboard();
        if (currentUser.role === 'admin') {
            loadAdminStats(); // Reload admin stats if admin completes a quiz
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Load leaderboard
async function loadLeaderboard() {
    try {
        const response = await fetch('/api/leaderboard');
        const scores = await response.json();
        
        leaderboardList.innerHTML = scores.map((score, index) => `
            <div class="leaderboard-entry p-4">
                <div class="flex justify-between items-center">
                    <div>
                        <span class="font-bold">#${index + 1}</span>
                        <span class="ml-4">${score.username}</span>
                    </div>
                    <div>
                        <span class="mr-4">Score: ${score.score}</span>
                        <span class="text-gray-600">Time: ${score.timeSpent.toFixed(2)}s</span>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error:', error);
    }
}

// Delete quiz (Admin)
async function deleteQuiz(quizId) {
    if (!confirm('Are you sure you want to delete this quiz?')) return;
    
    try {
        const response = await fetch(`/api/quizzes/${quizId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert('Quiz deleted successfully!');
            loadQuizManager();
        } else {
            alert('Error deleting quiz');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error deleting quiz');
    }
}

// Toggle between login and register forms
showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginFormContainer.classList.add('hidden');
    registerFormContainer.classList.remove('hidden');
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    registerFormContainer.classList.add('hidden');
    loginFormContainer.classList.remove('hidden');
});

// Handle Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('role', data.user.role);
            
            // Redirect based on role
            if (data.user.role === 'admin') {
                window.location.href = '/admin.html';
            } else {
                window.location.href = '/dashboard.html';
            }
        } else {
            alert(data.error || 'Login failed');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred during login');
    }
});

// Handle Registration
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, email, password }),
        });

        const data = await response.json();

        if (response.ok) {
            alert('Registration successful! Please login.');
            // Switch to login form
            registerFormContainer.classList.add('hidden');
            loginFormContainer.classList.remove('hidden');
        } else {
            alert(data.error || 'Registration failed');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred during registration');
    }
});

// Initial load
loadQuizzes();
loadLeaderboard();
