(function () {
  const form = document.getElementById('signupForm');
  if (!form) return;

  const fullnameInput = document.getElementById('fullname');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirm');
  const agreeInput = document.getElementById('agree');

  const fullnameError = document.getElementById('fullnameError');
  const emailError = document.getElementById('emailError');
  const passwordError = document.getElementById('passwordError');
  const confirmError = document.getElementById('confirmError');
  const agreeError = document.getElementById('agreeError');

  const formAlert = document.getElementById('formAlert');
  const submitBtn = document.getElementById('submitBtn');

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const MIN_PASSWORD_LENGTH = 6; // matches backend User model's minlength: 6

  function setError(input, errorEl, message) {
    errorEl.textContent = message || '';
    if (message) {
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.removeAttribute('aria-invalid');
    }
  }

  function showAlert(message, type) {
    formAlert.innerHTML = '';
    formAlert.textContent = message;
    formAlert.className = 'auth-alert auth-alert--' + type;
    formAlert.hidden = false;
  }

  function hideAlert() {
    formAlert.hidden = true;
    formAlert.textContent = '';
  }

  function validateFullname() {
    const value = fullnameInput.value.trim();
    if (!value) {
      setError(fullnameInput, fullnameError, 'Full name is required');
      return false;
    }
    if (value.length < 2) {
      setError(fullnameInput, fullnameError, 'Name must be at least 2 characters');
      return false;
    }
    setError(fullnameInput, fullnameError, '');
    return true;
  }

  function validateEmail() {
    const value = emailInput.value.trim();
    if (!value) {
      setError(emailInput, emailError, 'Email is required');
      return false;
    }
    if (!EMAIL_REGEX.test(value)) {
      setError(emailInput, emailError, 'Enter a valid email address');
      return false;
    }
    setError(emailInput, emailError, '');
    return true;
  }

  function validatePassword() {
    if (!passwordInput.value) {
      setError(passwordInput, passwordError, 'Password is required');
      return false;
    }
    if (passwordInput.value.length < MIN_PASSWORD_LENGTH) {
      setError(passwordInput, passwordError, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return false;
    }
    setError(passwordInput, passwordError, '');
    return true;
  }

  function validateConfirm() {
    if (!confirmInput.value) {
      setError(confirmInput, confirmError, 'Please confirm your password');
      return false;
    }
    if (confirmInput.value !== passwordInput.value) {
      setError(confirmInput, confirmError, 'Passwords do not match');
      return false;
    }
    setError(confirmInput, confirmError, '');
    return true;
  }

  function validateAgree() {
    if (!agreeInput.checked) {
      agreeError.textContent = 'You must agree to the Terms and Privacy Policy';
      return false;
    }
    agreeError.textContent = '';
    return true;
  }

  fullnameInput.addEventListener('blur', validateFullname);
  emailInput.addEventListener('blur', validateEmail);
  passwordInput.addEventListener('blur', validatePassword);
  confirmInput.addEventListener('blur', validateConfirm);
  agreeInput.addEventListener('change', validateAgree);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const fullnameOk = validateFullname();
    const emailOk = validateEmail();
    const passwordOk = validatePassword();
    const confirmOk = validateConfirm();
    const agreeOk = validateAgree();

    if (!fullnameOk || !emailOk || !passwordOk || !confirmOk || !agreeOk) return;

    // Split full name: first word = firstName, remainder = lastName
    const nameParts = fullnameInput.value.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');

    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account…';

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName,
          lastName: lastName,
          email: emailInput.value.trim(),
          password: passwordInput.value,
        }),
      });

      const data = await response.json();

      if (data.success) {
        showAlert('Account created! Redirecting…', 'success');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 800);
        return;
      }

      // Backend returns 400 (not 409) for a duplicate email, so branch on
      // the message text rather than trusting the HTTP status code.
      const message = data.message || 'Unable to create your account. Please try again.';
      if (/already exists/i.test(message)) {
        formAlert.className = 'auth-alert auth-alert--error';
        formAlert.hidden = false;
        formAlert.textContent = '';
        const text = document.createElement('span');
        text.textContent = message + ' — ';
        const link = document.createElement('a');
        link.href = '/signin';
        link.textContent = 'Sign in instead';
        formAlert.appendChild(text);
        formAlert.appendChild(link);
      } else {
        showAlert(message, 'error');
      }

      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    } catch (error) {
      showAlert('Network error — please check your connection and try again.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
})();
