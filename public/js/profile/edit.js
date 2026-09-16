// T083 — wires the Edit Profile form to PUT /api/users/:id.
// Same pattern as /js/auth/signin.js: validate in the browser, send JSON,
// report the result in place. If this script fails to load the form still
// works, because it keeps its POST /profile/edit action as a fallback.
(function () {
  const form = document.getElementById('editProfileForm');
  if (!form) return;

  const userId = form.dataset.userId;
  if (!userId) return;

  const submitBtn = document.getElementById('submitBtn');
  const formAlert = document.getElementById('formAlert');

  const MAX_LENGTHS = {
    firstName: 60,
    lastName: 60,
    school: 120,
    bio: 500,
    avatar: 500,
  };
  const LABELS = {
    firstName: 'First name',
    lastName: 'Last name',
    school: 'School',
    bio: 'Bio',
    avatar: 'Avatar URL',
  };
  const TEXT_FIELDS = ['firstName', 'lastName', 'school', 'bio', 'avatar'];
  const SKILL_FIELDS = ['expertise', 'lookingToLearn'];
  const AVATAR_REGEX = /^(https?:\/\/|\/)\S+$/;
  const MAX_SKILLS = 20;

  const fields = {};
  TEXT_FIELDS.concat(SKILL_FIELDS).forEach((name) => {
    fields[name] = {
      input: document.getElementById(name),
      error: document.getElementById(name + 'Error'),
    };
  });

  function setError(name, message) {
    const field = fields[name];
    if (!field || !field.input || !field.error) return;
    field.error.textContent = message || '';
    if (message) {
      field.input.setAttribute('aria-invalid', 'true');
    } else {
      field.input.removeAttribute('aria-invalid');
    }
  }

  function showAlert(message, type) {
    formAlert.textContent = message;
    formAlert.className = 'form-alert form-alert--' + type;
    formAlert.hidden = false;
  }

  function hideAlert() {
    formAlert.hidden = true;
    formAlert.textContent = '';
  }

  function valueOf(name) {
    const field = fields[name];
    return field && field.input ? field.input.value.trim() : '';
  }

  function validateText(name) {
    const value = valueOf(name);

    if (name === 'firstName' && !value) {
      setError(name, 'First name is required');
      return false;
    }
    if (value.length > MAX_LENGTHS[name]) {
      setError(name, LABELS[name] + ' must be ' + MAX_LENGTHS[name] + ' characters or fewer');
      return false;
    }
    if (name === 'avatar' && value && !AVATAR_REGEX.test(value)) {
      setError(name, 'Enter a full URL starting with http:// or https://');
      return false;
    }

    setError(name, '');
    return true;
  }

  function validateSkills(name) {
    const skills = valueOf(name)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (skills.length > MAX_SKILLS) {
      setError(name, 'Please list no more than ' + MAX_SKILLS + ' skills');
      return false;
    }

    setError(name, '');
    return true;
  }

  function validateAll() {
    // Runs every validator so the user sees all problems at once,
    // rather than fixing them one reload at a time.
    const results = TEXT_FIELDS.map(validateText).concat(SKILL_FIELDS.map(validateSkills));
    return results.every(Boolean);
  }

  TEXT_FIELDS.forEach((name) => {
    if (fields[name].input) {
      fields[name].input.addEventListener('blur', () => validateText(name));
    }
  });
  SKILL_FIELDS.forEach((name) => {
    if (fields[name].input) {
      fields[name].input.addEventListener('blur', () => validateSkills(name));
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    if (!validateAll()) {
      showAlert('Please fix the highlighted fields and try again.', 'error');
      return;
    }

    const payload = {};
    TEXT_FIELDS.concat(SKILL_FIELDS).forEach((name) => {
      payload[name] = valueOf(name);
    });

    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    try {
      const response = await fetch('/api/users/' + encodeURIComponent(userId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        showAlert('Your session has expired. Redirecting to sign in…', 'error');
        setTimeout(() => {
          window.location.href = '/signin';
        }, 1200);
        return;
      }

      const data = await response.json();

      if (response.ok && data.success) {
        showAlert('Profile saved. Redirecting…', 'success');
        setTimeout(() => {
          window.location.href = '/profile';
        }, 800);
        return;
      }

      showAlert(data.message || 'Could not save your profile. Please try again.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    } catch {
      showAlert('Network error — please check your connection and try again.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
})();
