document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  // Clear previous errors
  document.getElementById('firstNameError').textContent = '';
  document.getElementById('emailError').textContent = '';
  document.getElementById('passwordError').textContent = '';
  document.getElementById('errorMessage').style.display = 'none';

  // Get form values
  const fullName = document.getElementById('firstName').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  // Validation
  if (!fullName) {
    document.getElementById('firstNameError').textContent = 'Name is required';
    return;
  }

  if (fullName.length < 2) {
    document.getElementById('firstNameError').textContent = 'Name must be at least 2 characters';
    return;
  }

  // Split the full name: first word = firstName, the rest = lastName
  // e.g. "Akash Singh"       -> firstName: "Akash", lastName: "Singh"
  //      "Akash Deep Singh"  -> firstName: "Akash", lastName: "Deep Singh"
  const nameParts = fullName.split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' '); // '' if only one word entered

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

  if (password.length < 6) {
    document.getElementById('passwordError').textContent = 'Password must be at least 6 characters';
    return;
  }

  try {
    // Send signup request with split first/last name and the user-entered email
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firstName: firstName,
        lastName: lastName,
        email: email,
        password: password,
      }),
    });

    const data = await response.json();

    if (data.success) {
      document.getElementById('successMessage').style.display = 'block';
      document.getElementById('successMessage').textContent = 'Account created successfully! Redirecting...';
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
    } else {
      document.getElementById('errorMessage').style.display = 'block';
      document.getElementById('errorMessage').textContent = data.message || 'Error creating account';
    }
  } catch (error) {
    document.getElementById('errorMessage').style.display = 'block';
    document.getElementById('errorMessage').textContent = 'Network error: ' + error.message;
  }
});
