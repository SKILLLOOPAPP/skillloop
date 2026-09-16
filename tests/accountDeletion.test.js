const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const User = require('../src/models/User');
const Post = require('../src/models/Post');
const Comment = require('../src/models/Comment');

let app;
let userCounter = 0;

async function signupUser(overrides = {}) {
  userCounter += 1;
  const firstName = 'Acctdel' + userCounter;
  const email = `acctdel.user${userCounter}.${Date.now()}@skillloop.local`;
  const password = 'password123';
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ firstName, email, password, ...overrides });
  return {
    token: res.body.token,
    userId: res.body.user.id,
    firstName,
    email,
    password,
    cookie: 'token=' + res.body.token,
  };
}

async function createPost(cookie, overrides = {}) {
  const fields = {
    type: 'offer',
    title: 'Piano tutoring',
    description: 'I can teach beginner piano',
    skills: 'piano',
    availability: 'Weekends',
    ...overrides,
  };
  await request(app).post('/posts/create').set('Cookie', cookie).send(fields);
  return Post.findOne({ title: fields.title }).sort({ createdAt: -1 });
}

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
  await Post.deleteMany({});
  await Comment.deleteMany({});
  await User.deleteMany({});
});

// ─── POST /profile/delete ───────────────────────────────────────────────────

describe('POST /profile/delete', () => {
  it('redirects an unauthenticated request to sign in', async () => {
    const res = await request(app).post('/profile/delete').send({ password: 'x' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/signin');
  });

  it('rejects a missing password and leaves the account active', async () => {
    const { cookie, userId } = await signupUser();
    const res = await request(app).post('/profile/delete').set('Cookie', cookie).send({});
    expect(res.statusCode).toBe(200);
    expect(res.text).toMatch(/enter your password/i);
    const user = await User.findById(userId);
    expect(user.accountStatus).toBe('active');
  });

  it('rejects an incorrect password and leaves the account active', async () => {
    const { cookie, userId } = await signupUser();
    const res = await request(app)
      .post('/profile/delete')
      .set('Cookie', cookie)
      .send({ password: 'wrongpassword' });
    expect(res.statusCode).toBe(200);
    expect(res.text).toMatch(/incorrect password/i);
    const user = await User.findById(userId);
    expect(user.accountStatus).toBe('active');
  });

  it('soft-deletes the account and clears the session on the correct password', async () => {
    const { cookie, userId, password } = await signupUser();
    const res = await request(app).post('/profile/delete').set('Cookie', cookie).send({ password });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/');

    const clearedCookie = (res.headers['set-cookie'] || []).find(c => c.startsWith('token='));
    expect(clearedCookie).toBeDefined();
    expect(clearedCookie).toMatch(/token=;/);

    const user = await User.findById(userId);
    expect(user.accountStatus).toBe('deleted');
  });
});

// ─── Downstream effects of a deletion ───────────────────────────────────────

describe('after an account is deleted', () => {
  it('can no longer sign in', async () => {
    const { cookie, email, password } = await signupUser();
    await request(app).post('/profile/delete').set('Cookie', cookie).send({ password });

    const res = await request(app).post('/api/auth/signin').send({ email, password });
    expect(res.statusCode).toBe(403);
    expect(res.body.message).toMatch(/suspended or deleted/i);
  });

  it('GET /api/users/:id on the deleted user returns 404', async () => {
    const { cookie, userId, password } = await signupUser();
    await request(app).post('/profile/delete').set('Cookie', cookie).send({ password });

    // /api/users is behind verifyAuth, so the lookup itself needs a logged-in
    // caller — someone else still active, since the deleted user's own
    // cookie was just cleared.
    const viewer = await signupUser();
    const res = await request(app)
      .get(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${viewer.token}`);
    expect(res.statusCode).toBe(404);
  });

  it('their posts and comments render as "Deleted User", not their real name', async () => {
    const author = await signupUser();
    const post = await createPost(author.cookie);
    await request(app)
      .post(`/posts/${post._id}/comments`)
      .set('Cookie', author.cookie)
      .send({ body: 'Still available!' });

    await request(app).post('/profile/delete').set('Cookie', author.cookie).send({ password: author.password });

    const viewer = await signupUser();
    const res = await request(app).get(`/posts/${post._id}`).set('Cookie', viewer.cookie);

    expect(res.statusCode).toBe(200);
    expect(res.text).not.toContain(author.firstName);
    const occurrences = (res.text.match(/Deleted User/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2); // post author panel + comment
  });

  it("their avatar is hidden on posts they authored", async () => {
    const author = await signupUser();
    await request(app)
      .put(`/api/users/${author.userId}`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ avatar: 'https://example.com/should-be-hidden.png' });

    const post = await createPost(author.cookie);
    await request(app).post('/profile/delete').set('Cookie', author.cookie).send({ password: author.password });

    const viewer = await signupUser();
    const res = await request(app).get(`/posts/${post._id}`).set('Cookie', viewer.cookie);

    expect(res.text).not.toContain('should-be-hidden.png');
  });

  it('their name in a shared conversation shows as "Deleted User"', async () => {
    const author = await signupUser();
    const post = await createPost(author.cookie);
    const viewer = await signupUser();

    // viewer starts a conversation with the author from the post
    await request(app)
      .get(`/messages?to=${author.userId}&post=${post._id}`)
      .set('Cookie', viewer.cookie);

    await request(app).post('/profile/delete').set('Cookie', author.cookie).send({ password: author.password });

    const res = await request(app).get('/messages').set('Cookie', viewer.cookie);
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('Deleted User');
    expect(res.text).not.toContain(author.firstName);
  });
});
