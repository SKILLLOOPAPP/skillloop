document.getElementById('signinForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  // Clear previous errors
  document.getElementById('emailError').textContent = '';
  document.getElementById('passwordError').textContent = '';
  document.getElementById('errorMessage').style.display = 'none';

  // Get form values
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const rememberMe = document.getElementById('rememberMe').checked;

  // Validation
  if (!email) {
    document.getElementById('emailError').textContent = 'Email is required';
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    document.getElementById('emailError').textContent = 'Invalid email format';
    return;
  }

  if (!password) {
    document.getElementById('passwordError').textContent = 'Password is required';
    return;
  }

  try {
    // Send signin request
    const response = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        password: password,
      }),
    });

    const data = await response.json();

    if (data.success) {
      // If remember me is checked, store token in localStorage
      if (rememberMe) {
        localStorage.setItem('authToken', data.token);
      }

      document.getElementById('successMessage').style.display = 'block';
      document.getElementById('successMessage').textContent = 'Sign in successful! Redirecting...';
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);
    } else {
      document.getElementById('errorMessage').style.display = 'block';
      document.getElementById('errorMessage').textContent = data.message || 'Error signing in';
    }
  } catch (error) {
    document.getElementById('errorMessage').style.display = 'block';
    document.getElementById('errorMessage').textContent = 'Network error: ' + error.message;
  }
});
