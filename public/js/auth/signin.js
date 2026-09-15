(function () {
  const form = document.getElementById('signinForm');
  if (!form) return;

  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const emailError = document.getElementById('emailError');
  const passwordError = document.getElementById('passwordError');
  const formAlert = document.getElementById('formAlert');
  const submitBtn = document.getElementById('submitBtn');

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function setError(input, errorEl, message) {
    errorEl.textContent = message || '';
    if (message) {
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.removeAttribute('aria-invalid');
    }
  }

  function showAlert(message, type) {
    formAlert.textContent = message;
    formAlert.className = 'auth-alert auth-alert--' + type;
    formAlert.hidden = false;
  }

  function hideAlert() {
    formAlert.hidden = true;
    formAlert.textContent = '';
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
    setError(passwordInput, passwordError, '');
    return true;
  }

  emailInput.addEventListener('blur', validateEmail);
  passwordInput.addEventListener('blur', validatePassword);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const emailOk = validateEmail();
    const passwordOk = validatePassword();
    if (!emailOk || !passwordOk) return;

    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';

    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.value.trim(),
          password: passwordInput.value,
        }),
      });

      const data = await response.json();

      if (data.success) {
        showAlert('Sign in successful! Redirecting…', 'success');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 800);
        return;
      }

      showAlert(data.message || 'Unable to sign in. Please try again.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    } catch (error) {
      showAlert('Network error — please check your connection and try again.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
})();
