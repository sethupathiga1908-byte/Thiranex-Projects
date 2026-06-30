// -------------------------------------------------------------
// UI State & Selectors
// -------------------------------------------------------------
const cards = {
  login: document.getElementById('login-card'),
  register: document.getElementById('register-card'),
  tfaValidate: document.getElementById('tfa-validation-card'),
  dashboard: document.getElementById('dashboard-card')
};

// Forms
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const tfaValidateForm = document.getElementById('tfa-validate-form');
const tfaVerifyForm = document.getElementById('tfa-verify-form');

// Inputs
const registerPassword = document.getElementById('register-password');
const registerConfirmPassword = document.getElementById('register-confirm-password');
const tfaSetupCode = document.getElementById('tfa-setup-code');
const tfaLoginCode = document.getElementById('tfa-login-code');

// Requirement Elements
const reqs = {
  length: document.getElementById('req-length'),
  uppercase: document.getElementById('req-uppercase'),
  lowercase: document.getElementById('req-lowercase'),
  number: document.getElementById('req-number')
};
const matchError = document.getElementById('match-error');

// Buttons & Actions
const btnRegister = document.getElementById('btn-register');
const btnToggleTfa = document.getElementById('btn-toggle-tfa');
const btnLogout = document.getElementById('btn-logout');
const btnCancelTfaSetup = document.getElementById('btn-cancel-tfa-setup');
const tfaSetupSubpanel = document.getElementById('tfa-setup-subpanel');

// Toast Container
const toastContainer = document.getElementById('toast-container');

// App State
let currentUser = null;

// -------------------------------------------------------------
// Toast Notification Engine
// -------------------------------------------------------------
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${escapeHTML(message)}</span>
    <button class="toast-close" aria-label="Close">&times;</button>
  `;
  
  toastContainer.appendChild(toast);
  
  // Micro-delay for slide-in animation
  setTimeout(() => toast.classList.add('show'), 20);
  
  const closeToast = () => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 350);
  };

  const autoClose = setTimeout(closeToast, 5000);

  toast.querySelector('.toast-close').addEventListener('click', () => {
    clearTimeout(autoClose);
    closeToast();
  });
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// -------------------------------------------------------------
// Navigation / View Management
// -------------------------------------------------------------
function switchView(targetKey) {
  // Hide all cards
  Object.keys(cards).forEach(key => {
    cards[key].classList.remove('active');
  });
  
  // Show target card
  if (cards[targetKey]) {
    cards[targetKey].classList.add('active');
  }
}

// Bind Navigation Links
document.getElementById('link-to-register').addEventListener('click', (e) => {
  e.preventDefault();
  switchView('register');
  registerForm.reset();
  validateRegisterInputs();
});

document.getElementById('link-to-login').addEventListener('click', (e) => {
  e.preventDefault();
  switchView('login');
  loginForm.reset();
});

document.getElementById('link-back-to-login').addEventListener('click', (e) => {
  e.preventDefault();
  switchView('login');
  tfaValidateForm.reset();
});

// -------------------------------------------------------------
// Client Side Form Validation & Dynamic Feedback
// -------------------------------------------------------------
registerPassword.addEventListener('input', validateRegisterInputs);
registerConfirmPassword.addEventListener('input', validateRegisterInputs);
document.getElementById('register-username').addEventListener('input', validateRegisterInputs);

function validateRegisterInputs() {
  const username = document.getElementById('register-username').value;
  const password = registerPassword.value;
  const confirmPassword = registerConfirmPassword.value;

  // Validation conditions
  const isUsernameValid = /^[a-zA-Z0-9]{3,20}$/.test(username);
  const isLengthValid = password.length >= 8;
  const isUppercaseValid = /[A-Z]/.test(password);
  const isLowercaseValid = /[a-z]/.test(password);
  const isNumberValid = /\d/.test(password);

  // Update password checklist UI
  updateReqClass(reqs.length, isLengthValid);
  updateReqClass(reqs.uppercase, isUppercaseValid);
  updateReqClass(reqs.lowercase, isLowercaseValid);
  updateReqClass(reqs.number, isNumberValid);

  // Confirm password check
  const passwordsMatch = password === confirmPassword;
  if (confirmPassword.length > 0) {
    if (passwordsMatch) {
      matchError.classList.add('hidden');
    } else {
      matchError.classList.remove('hidden');
    }
  } else {
    matchError.classList.add('hidden');
  }

  // Master Enable/Disable button check
  const isPasswordValid = isLengthValid && isUppercaseValid && isLowercaseValid && isNumberValid;
  if (isUsernameValid && isPasswordValid && passwordsMatch) {
    btnRegister.removeAttribute('disabled');
  } else {
    btnRegister.setAttribute('disabled', 'true');
  }
}

function updateReqClass(element, isValid) {
  if (isValid) {
    element.classList.remove('invalid');
    element.classList.add('valid');
  } else {
    element.classList.remove('valid');
    element.classList.add('invalid');
  }
}

// -------------------------------------------------------------
// Backend APIs Core Integrations
// -------------------------------------------------------------

// Toggle element loaders
function setLoader(buttonId, show) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  const loader = btn.querySelector('.loader');
  const span = btn.querySelector('span');
  if (show) {
    if (loader) loader.classList.remove('hidden');
    if (span) span.classList.add('hidden');
    btn.setAttribute('disabled', 'true');
  } else {
    if (loader) loader.classList.add('hidden');
    if (span) span.classList.remove('hidden');
    btn.removeAttribute('disabled');
  }
}

// 1. REGISTER
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('register-username').value;
  const password = registerPassword.value;

  setLoader('btn-register', true);
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    
    if (res.ok) {
      showToast(data.message, 'success');
      switchView('login');
      registerForm.reset();
    } else {
      showToast(data.error || 'Registration failed', 'error');
    }
  } catch (err) {
    showToast('Network error, please try again.', 'error');
  } finally {
    setLoader('btn-register', false);
  }
});

// 2. LOGIN
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;

  setLoader('btn-login', true);
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (res.ok) {
      if (data.require2FA) {
        // Switch to 2FA Prompt Card
        showToast(data.message, 'info');
        switchView('tfaValidate');
        tfaLoginCode.focus();
      } else {
        showToast('Login successful!', 'success');
        loadDashboard(data.user);
      }
    } else {
      showToast(data.error || 'Login failed', 'error');
    }
  } catch (err) {
    showToast('Network error, please try again.', 'error');
  } finally {
    setLoader('btn-login', false);
  }
});

// 3. VALIDATE 2FA PIN (during login)
tfaValidateForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = tfaLoginCode.value;

  setLoader('btn-tfa-validate', true);
  try {
    const res = await fetch('/api/auth/2fa/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const data = await res.json();

    if (res.ok) {
      showToast('Authentication verified!', 'success');
      tfaValidateForm.reset();
      loadDashboard(data.user);
    } else {
      showToast(data.error || 'Verification failed', 'error');
    }
  } catch (err) {
    showToast('Network error, please try again.', 'error');
  } finally {
    setLoader('btn-tfa-validate', false);
  }
});

// 4. LOAD DASHBOARD
function loadDashboard(user) {
  currentUser = user;
  document.getElementById('dash-username').textContent = user.username;
  
  const badge = document.getElementById('tfa-status-badge');
  if (user.twoFactorEnabled) {
    badge.textContent = 'Enabled';
    badge.className = 'badge badge-success';
    btnToggleTfa.textContent = 'Disable 2FA';
    btnToggleTfa.className = 'btn-secondary btn-sm';
  } else {
    badge.textContent = 'Disabled';
    badge.className = 'badge badge-disabled';
    btnToggleTfa.textContent = 'Enable 2FA';
    btnToggleTfa.className = 'btn-primary btn-sm';
  }
  
  tfaSetupSubpanel.classList.add('hidden');
  switchView('dashboard');
}

// 5. LOGOUT
btnLogout.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    if (res.ok) {
      showToast('Logged out securely.', 'success');
      currentUser = null;
      switchView('login');
      loginForm.reset();
    } else {
      showToast('Logout failed.', 'error');
    }
  } catch (err) {
    showToast('Logout connection issue.', 'error');
  }
});

// 6. TOGGLE 2FA SETTINGS
btnToggleTfa.addEventListener('click', async () => {
  if (currentUser && currentUser.twoFactorEnabled) {
    // Disable 2FA request
    if (confirm('Are you sure you want to disable Two-Factor Authentication? This decreases account security.')) {
      try {
        const res = await fetch('/api/auth/2fa/disable', { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
          showToast(data.message, 'success');
          currentUser.twoFactorEnabled = false;
          loadDashboard(currentUser);
        } else {
          showToast(data.error || 'Failed to disable 2FA', 'error');
        }
      } catch (err) {
        showToast('Network error.', 'error');
      }
    }
  } else {
    // Enable 2FA request: Show Wizard
    tfaSetupSubpanel.classList.remove('hidden');
    document.getElementById('tfa-qr-image').src = '';
    document.getElementById('tfa-secret-key').textContent = 'Loading secret key...';
    
    try {
      const res = await fetch('/api/auth/2fa/setup', { method: 'POST' });
      const data = await res.json();
      
      if (res.ok) {
        document.getElementById('tfa-qr-image').src = data.qrCodeUrl;
        document.getElementById('tfa-secret-key').textContent = data.secret;
        document.querySelector('.qr-loader').classList.add('hidden');
      } else {
        showToast(data.error || 'Failed to generate 2FA key', 'error');
        tfaSetupSubpanel.classList.add('hidden');
      }
    } catch (err) {
      showToast('Network error loading QR code.', 'error');
      tfaSetupSubpanel.classList.add('hidden');
    }
  }
});

// Cancel 2FA Setup
btnCancelTfaSetup.addEventListener('click', () => {
  tfaSetupSubpanel.classList.add('hidden');
  document.querySelector('.qr-loader').classList.remove('hidden');
});

// Verify and enable 2FA submission
tfaVerifyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = tfaSetupCode.value;
  
  try {
    const res = await fetch('/api/auth/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const data = await res.json();
    
    if (res.ok) {
      showToast(data.message, 'success');
      tfaVerifyForm.reset();
      currentUser.twoFactorEnabled = true;
      loadDashboard(currentUser);
    } else {
      showToast(data.error || '2FA setup verification failed', 'error');
    }
  } catch (err) {
    showToast('Verification server error.', 'error');
  }
});

// -------------------------------------------------------------
// App Initialization (Check Active Session)
// -------------------------------------------------------------
async function initApp() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      loadDashboard(data);
    } else {
      switchView('login');
    }
  } catch (err) {
    // If server offline or connection failed, display login
    switchView('login');
  }
}

// Run on page load
document.addEventListener('DOMContentLoaded', initApp);
