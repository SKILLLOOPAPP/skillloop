// T083 — PUT /api/users/:id, the endpoint the Edit Profile form now submits to.
// Same pattern as auth.test.js / posts.test.js: Supertest against a real local
// MongoDB, no mocking.
const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');

let app;

beforeAll(async () => {
  process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/skillloop-test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret';
  process.env.NODE_ENV = 'test';
  app = createApp();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

afterEach(async () => {
  const User = require('../src/models/User');
  await User.deleteMany({});
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

let counter = 0;

async function signUp(firstName) {
  counter += 1;
  const res = await request(app)
    .post('/api/auth/signup')
    .send({
      firstName,
      email: `${firstName.toLowerCase()}${counter}@skillloop.local`,
      password: 'password123',
    });

  expect(res.statusCode).toBe(201);
  return { id: res.body.user.id, token: res.body.token };
}

function putProfile(user, body) {
  return request(app)
    .put(`/api/users/${user.id}`)
    .set('Authorization', `Bearer ${user.token}`)
    .send(body);
}

function findUser(id) {
  const User = require('../src/models/User');
  return User.findById(id).select('+password').lean();
}

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('PUT /api/users/:id — valid updates', () => {
  it('updates the caller\'s own profile', async () => {
    const user = await signUp('Alice');

    const res = await putProfile(user, {
      firstName: 'Alicia',
      lastName: 'Nguyen',
      school: 'Deakin University',
      bio: 'Second-year software engineering student.',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.firstName).toBe('Alicia');
    expect(res.body.user.lastName).toBe('Nguyen');
    expect(res.body.user.school).toBe('Deakin University');

    const saved = await findUser(user.id);
    expect(saved.firstName).toBe('Alicia');
    expect(saved.bio).toBe('Second-year software engineering student.');
  });

  it('trims surrounding whitespace before saving', async () => {
    const user = await signUp('Bob');

    const res = await putProfile(user, { firstName: '  Robert  ', bio: '  Hello  ' });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.firstName).toBe('Robert');

    const saved = await findUser(user.id);
    expect(saved.bio).toBe('Hello');
  });

  it('turns comma-separated expertise into skill objects with a default level', async () => {
    const user = await signUp('Cara');

    const res = await putProfile(user, { expertise: 'JavaScript, React , , Data Analytics' });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.expertise).toHaveLength(3);
    expect(res.body.user.expertise[0].skill).toBe('JavaScript');
    expect(res.body.user.expertise[0].level).toBe('intermediate');
    expect(res.body.user.expertise[2].skill).toBe('Data Analytics');
  });

  it('accepts an array of skill objects and keeps a valid level', async () => {
    const user = await signUp('Dan');

    const res = await putProfile(user, {
      expertise: [{ skill: 'Python', level: 'expert' }, 'Go'],
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.expertise[0].level).toBe('expert');
    expect(res.body.user.expertise[1].skill).toBe('Go');
    expect(res.body.user.expertise[1].level).toBe('intermediate');
  });

  it('replaces an invalid level with the default rather than failing', async () => {
    const user = await signUp('Elle');

    const res = await putProfile(user, {
      expertise: [{ skill: 'Rust', level: 'wizard' }],
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.expertise[0].level).toBe('intermediate');
  });

  it('saves lookingToLearn with the default priority', async () => {
    const user = await signUp('Finn');

    const res = await putProfile(user, { lookingToLearn: 'Python, Japanese' });

    expect(res.statusCode).toBe(200);

    const saved = await findUser(user.id);
    expect(saved.lookingToLearn).toHaveLength(2);
    expect(saved.lookingToLearn[0].priority).toBe('medium');
  });

  it('falls back to the default school when school is blanked out', async () => {
    const user = await signUp('Gia');

    const res = await putProfile(user, { school: '   ' });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.school).toBe('SkillLoop User');
  });

  it('clears the avatar to null when blanked out', async () => {
    const user = await signUp('Hana');

    await putProfile(user, { avatar: 'https://example.com/a.png' });
    const res = await putProfile(user, { avatar: '' });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.avatar).toBeNull();
  });
});

// ─── Data type validation ─────────────────────────────────────────────────────

describe('PUT /api/users/:id — data type validation', () => {
  it('rejects a firstName that is not text', async () => {
    const user = await signUp('Iris');

    const res = await putProfile(user, { firstName: 12345 });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);

    const saved = await findUser(user.id);
    expect(saved.firstName).toBe('Iris');
  });

  it('rejects a bio that is not text', async () => {
    const user = await signUp('Jack');

    const res = await putProfile(user, { bio: { text: 'nope' } });

    expect(res.statusCode).toBe(400);

    const saved = await findUser(user.id);
    expect(saved.bio).toBe('');
  });

  it('rejects a school sent as a boolean', async () => {
    const user = await signUp('Kim');

    const res = await putProfile(user, { school: true });

    expect(res.statusCode).toBe(400);
  });

  it('rejects expertise sent as a number', async () => {
    const user = await signUp('Liam');

    const res = await putProfile(user, { expertise: 42 });

    expect(res.statusCode).toBe(400);

    const saved = await findUser(user.id);
    expect(saved.expertise).toHaveLength(0);
  });

  it('rejects an expertise array holding values that are not skills', async () => {
    const user = await signUp('Mia');

    const res = await putProfile(user, { expertise: [{ name: 'JavaScript' }] });

    expect(res.statusCode).toBe(400);
  });
});

// ─── Field rules ──────────────────────────────────────────────────────────────

describe('PUT /api/users/:id — field rules', () => {
  it('rejects an empty first name and leaves the profile untouched', async () => {
    const user = await signUp('Noah');

    const res = await putProfile(user, { firstName: '   ' });

    expect(res.statusCode).toBe(400);

    const saved = await findUser(user.id);
    expect(saved.firstName).toBe('Noah');
  });

  it('rejects a first name longer than 60 characters', async () => {
    const user = await signUp('Olive');

    const res = await putProfile(user, { firstName: 'a'.repeat(61) });

    expect(res.statusCode).toBe(400);
  });

  it('rejects a bio longer than 500 characters', async () => {
    const user = await signUp('Pia');

    const res = await putProfile(user, { bio: 'a'.repeat(501) });

    expect(res.statusCode).toBe(400);

    const saved = await findUser(user.id);
    expect(saved.bio).toBe('');
  });

  it('rejects an avatar that is not a URL', async () => {
    const user = await signUp('Quinn');

    const res = await putProfile(user, { avatar: 'not a url' });

    expect(res.statusCode).toBe(400);
  });

  it('caps a skill list at 20 entries', async () => {
    const user = await signUp('Rory');

    const skills = Array.from({ length: 25 }, (_, i) => `Skill${i}`).join(', ');
    const res = await putProfile(user, { expertise: skills });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.expertise).toHaveLength(20);
  });

  it('rejects a body with no updatable fields', async () => {
    const user = await signUp('Sam');

    const res = await putProfile(user, { nickname: 'Sammy' });

    expect(res.statusCode).toBe(400);
  });

  it('ignores fields outside the whitelist', async () => {
    const user = await signUp('Tara');
    const before = await findUser(user.id);

    const res = await putProfile(user, {
      firstName: 'Tara',
      email: 'attacker@evil.local',
      password: 'hacked-password',
      accountStatus: 'suspended',
      rating: { average: 5, count: 999 },
    });

    expect(res.statusCode).toBe(200);

    const after = await findUser(user.id);
    expect(after.email).toBe(before.email);
    expect(after.password).toBe(before.password);
    expect(after.accountStatus).toBe('active');
    expect(after.rating.count).toBe(0);
  });
});

// ─── Authorisation and identity ───────────────────────────────────────────────

describe('PUT /api/users/:id — authorisation', () => {
  it('rejects an unauthenticated request with 401', async () => {
    const user = await signUp('Uma');

    const res = await request(app)
      .put(`/api/users/${user.id}`)
      .send({ firstName: 'Ursula' });

    expect(res.statusCode).toBe(401);

    const saved = await findUser(user.id);
    expect(saved.firstName).toBe('Uma');
  });

  it('rejects updating someone else\'s profile with 403', async () => {
    const owner = await signUp('Vic');
    const attacker = await signUp('Wes');

    const res = await request(app)
      .put(`/api/users/${owner.id}`)
      .set('Authorization', `Bearer ${attacker.token}`)
      .send({ firstName: 'Hacked' });

    expect(res.statusCode).toBe(403);

    const saved = await findUser(owner.id);
    expect(saved.firstName).toBe('Vic');
  });

  it('rejects a malformed user id with 400', async () => {
    const user = await signUp('Xan');

    const res = await request(app)
      .put('/api/users/not-an-id')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ firstName: 'Nope' });

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when the caller\'s own record is already gone', async () => {
    const user = await signUp('Yara');

    const User = require('../src/models/User');
    await User.deleteOne({ _id: user.id });

    const res = await putProfile(user, { firstName: 'Ghost' });

    expect(res.statusCode).toBe(404);
  });
});
