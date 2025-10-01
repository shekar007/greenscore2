// Authentication JavaScript with secure password handling

document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    
    // Check if user is already logged in
    const user = getCurrentUser();
    if (user) {
        redirectToUserDashboard(user.userType);
    }

    // Initialize password strength checker
    initPasswordStrength();
});

function setupEventListeners() {
    document.getElementById('signin-form').addEventListener('submit', handleSignIn);
    document.getElementById('signup-form').addEventListener('submit', handleSignUp);
    document.getElementById('forgot-password-form').addEventListener('submit', handleForgotPassword);
    
    // Real-time password validation
    document.getElementById('signup-password').addEventListener('input', checkPasswordStrength);
}

function showTab(tabName) {
    // Hide all forms
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.remove('active');
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected form
    document.getElementById(tabName).classList.add('active');
    
    // Add active class to clicked button
    event.target.classList.add('active');
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const button = input.parentElement.querySelector('.password-toggle i');
    
    if (input.type === 'password') {
        input.type = 'text';
        button.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        button.className = 'fas fa-eye';
    }
}

function initPasswordStrength() {
    const passwordInput = document.getElementById('signup-password');
    const strengthIndicator = document.getElementById('password-strength');
    
    if (passwordInput && strengthIndicator) {
        passwordInput.addEventListener('input', function() {
            const password = this.value;
            const strength = calculatePasswordStrength(password);
            updatePasswordStrengthUI(strength, strengthIndicator);
        });
    }
}

function calculatePasswordStrength(password) {
    let score = 0;
    const checks = {
        length: password.length >= 8,
        lowercase: /[a-z]/.test(password),
        uppercase: /[A-Z]/.test(password),
        numbers: /\d/.test(password),
        special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };
    
    Object.values(checks).forEach(check => {
        if (check) score++;
    });
    
    let strength = 'weak';
    if (score >= 4) strength = 'strong';
    else if (score >= 3) strength = 'medium';
    
    return { score, checks, strength };
}

function updatePasswordStrengthUI(strengthData, indicator) {
    const { strength, checks } = strengthData;
    
    let html = `<div class="strength-bar strength-${strength}"></div>`;
    html += `<div class="strength-text">Password strength: <span class="${strength}">${strength.toUpperCase()}</span></div>`;
    
    if (strengthData.score > 0) {
        html += '<div class="strength-requirements">';
        html += checks.length ? '✓' : '✗';
        html += ' At least 8 characters ';
        html += checks.numbers ? '✓' : '✗';
        html += ' Contains numbers ';
        html += checks.lowercase ? '✓' : '✗';
        html += ' Contains lowercase ';
        if (checks.uppercase || checks.special) {
            html += checks.uppercase ? '✓' : '✗';
            html += ' Contains uppercase ';
        }
        html += '</div>';
    }
    
    indicator.innerHTML = html;
}

function checkPasswordStrength() {
    const password = document.getElementById('signup-password').value;
    const indicator = document.getElementById('password-strength');
    const strength = calculatePasswordStrength(password);
    updatePasswordStrengthUI(strength, indicator);
}

async function handleSignIn(e) {
    e.preventDefault();
    
    const email = document.getElementById('signin-email').value;
    const password = document.getElementById('signin-password').value;
    const userType = document.getElementById('signin-usertype').value;
    
    // Basic validation
    if (!email || !password || !userType) {
        showNotification('Please fill in all fields', 'error');
        return;
    }

    try {
        showLoading(true);
        
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password, userType })
        });
        
        const result = await response.json();
        
        if (result.success) {
            localStorage.setItem('greenscore-user', JSON.stringify(result.user));
            showNotification('Successfully signed in!', 'success');
            
            setTimeout(() => {
                redirectToUserDashboard(result.user.userType);
            }, 1000);
        } else {
            showNotification(result.message || 'Invalid credentials', 'error');
        }
    } catch (error) {
        showNotification('Error signing in. Please try again.', 'error');
        console.error('Sign in error:', error);
    } finally {
        showLoading(false);
    }
}

async function handleSignUp(e) {
    e.preventDefault();
    
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const companyName = document.getElementById('signup-company').value;
    const password = document.getElementById('signup-password').value;
    const userType = document.getElementById('signup-usertype').value;
    const termsAccepted = document.getElementById('terms-checkbox').checked;
    
    // Validation
    if (!name || !email || !companyName || !password || !userType) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    // Prevent admin account creation
    if (userType === 'admin') {
        showNotification('Admin accounts cannot be created through registration. Please contact system administrator.', 'error');
        return;
    }
    
    if (!termsAccepted) {
        showNotification('Please accept the Terms of Service and Privacy Policy', 'error');
        return;
    }
    
    if (password.length < 8) {
        showNotification('Password must be at least 8 characters long', 'error');
        return;
    }
    
    // Check password strength
    const strength = calculatePasswordStrength(password);
    if (strength.score < 3) {
        showNotification('Please choose a stronger password', 'error');
        return;
    }

    try {
        showLoading(true);
        
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, companyName, password, userType })
        });
        
        const result = await response.json();
        
        if (result.success) {
            localStorage.setItem('greenscore-user', JSON.stringify(result.user));
            showNotification('Account created successfully!', 'success');
            
            setTimeout(() => {
                redirectToUserDashboard(result.user.userType);
            }, 1000);
        } else {
            showNotification(result.message || 'Error creating account', 'error');
        }
    } catch (error) {
        showNotification('Error creating account. Please try again.', 'error');
        console.error('Sign up error:', error);
    } finally {
        showLoading(false);
    }
}

async function handleForgotPassword(e) {
    e.preventDefault();
    
    const email = document.getElementById('forgot-email').value;
    
    if (!email) {
        showNotification('Please enter your email address', 'error');
        return;
    }

    try {
        showLoading(true);
        
        // Note: This would connect to a real password reset service
        showNotification('Password reset functionality will be implemented soon. Please contact support for assistance.', 'info');
        closeForgotPassword();
        
    } catch (error) {
        showNotification('Error sending reset email. Please try again.', 'error');
        console.error('Forgot password error:', error);
    } finally {
        showLoading(false);
    }
}

function showForgotPassword() {
    document.getElementById('forgot-password-modal').classList.add('show');
}

function closeForgotPassword() {
    document.getElementById('forgot-password-modal').classList.remove('show');
    document.getElementById('forgot-password-form').reset();
}

function getCurrentUser() {
    const userStr = localStorage.getItem('greenscore-user');
    return userStr ? JSON.parse(userStr) : null;
}

function redirectToUserDashboard(userType) {
    if (userType === 'seller') {
        window.location.href = '/seller';
    } else if (userType === 'buyer') {
        window.location.href = '/buyer';
    } else if (userType === 'admin') {
        window.location.href = '/admin';
    } else {
        window.location.href = '/';
    }
}

function showLoading(show) {
    const buttons = document.querySelectorAll('.btn[type="submit"]');
    buttons.forEach(button => {
        if (show) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        } else {
            button.disabled = false;
            // Restore original text
            if (button.closest('#signin-form')) {
                button.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
            } else if (button.closest('#signup-form')) {
                button.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
            } else if (button.closest('#forgot-password-form')) {
                button.innerHTML = '<i class="fas fa-paper-plane"></i> Send Reset Link';
            }
        }
    });
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, type === 'error' ? 5000 : 3000);
}

// Email validation
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Real-time email validation
document.addEventListener('DOMContentLoaded', function() {
    const emailInputs = document.querySelectorAll('input[type="email"]');
    emailInputs.forEach(input => {
        input.addEventListener('blur', function() {
            if (this.value && !validateEmail(this.value)) {
                this.setCustomValidity('Please enter a valid email address');
                this.classList.add('invalid');
            } else {
                this.setCustomValidity('');
                this.classList.remove('invalid');
            }
        });
    });
});

// Make functions global
window.showTab = showTab;
window.togglePassword = togglePassword;
window.showForgotPassword = showForgotPassword;
window.closeForgotPassword = closeForgotPassword;
window.showNotification = showNotification;
