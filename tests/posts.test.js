const request = require('supertest');
const mongoose = require('mongoose');
const createApp = require('../src/app');
const Post = require('../src/models/Post');
const User = require('../src/models/User');

let app;
let userCounter = 0;

// Signs up a fresh user and returns both the raw JWT and a ready-to-use
// Cookie header value, since /posts is guarded by requireLogin, which only
// reads req.cookies.token (unlike /api/users, which also accepts a Bearer
// header).
async function signupUser(overrides = {}) {
  userCounter += 1;
  const res = await request(app)
    .post('/api/auth/signup')
    .send({
      firstName: 'User' + userCounter,
      email: `posttest.user${userCounter}.${Date.now()}@skillloop.local`,
      password: 'password123',
      ...overrides,
    });
  const token = res.body.token;
  return { token, userId: res.body.user.id, cookie: 'token=' + token };
}

async function createPost(cookie, overrides = {}) {
  const fields = {
    type: 'offer',
    title: 'Guitar lessons',
    description: 'I can teach beginner guitar',
    skills: 'guitar,music',
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
  await User.deleteMany({});
});

// ─── Create ───────────────────────────────────────────────────────────────────

describe('POST /posts/create', () => {
  it('creates a post owned by the logged-in user', async () => {
    const { cookie, userId } = await signupUser();

    const res = await request(app)
      .post('/posts/create')
      .set('Cookie', cookie)
      .send({
        type: 'offer',
        title: 'Guitar lessons',
        description: 'I can teach beginner guitar',
        skills: 'guitar, music',
        availability: 'Weekends',
      });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/posts?mine=1');

    const saved = await Post.findOne({ title: 'Guitar lessons' });
    expect(saved).not.toBeNull();
    expect(saved.author.toString()).toBe(userId);
    expect(saved.skills).toEqual(['guitar', 'music']);
    expect(saved.status).toBe('open');
  });

  it('re-renders the form with an error when required fields are missing, and saves nothing', async () => {
    const { cookie } = await signupUser();

    const res = await request(app)
      .post('/posts/create')
      .set('Cookie', cookie)
      .send({ type: 'offer', description: 'Missing a title' });

    expect(res.statusCode).toBe(200);
    expect(res.text).toMatch(/required/i);
    expect(await Post.countDocuments()).toBe(0);
  });

  it('redirects an unauthenticated request to sign in', async () => {
    const res = await request(app)
      .post('/posts/create')
      .send({ type: 'offer', title: 'No auth', description: 'Should not save' });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/signin');
    expect(await Post.countDocuments()).toBe(0);
  });
});

// ─── Read ─────────────────────────────────────────────────────────────────────

describe('GET /posts/:id', () => {
  it('shows the post detail page to any logged-in user, not just the owner', async () => {
    const owner = await signupUser();
    const post = await createPost(owner.cookie);
    const viewer = await signupUser();

    const res = await request(app).get(`/posts/${post._id}`).set('Cookie', viewer.cookie);

    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('Guitar lessons');
  });

  it('redirects to /browse when the post does not exist', async () => {
    const { cookie } = await signupUser();
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app).get(`/posts/${fakeId}`).set('Cookie', cookie);

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/browse');
  });
});

// ─── Update: edit form (ownership) ─────────────────────────────────────────────

describe('GET /posts/:id/edit', () => {
  it('shows the edit form to the owner', async () => {
    const owner = await signupUser();
    const post = await createPost(owner.cookie);

    const res = await request(app).get(`/posts/${post._id}/edit`).set('Cookie', owner.cookie);

    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('Guitar lessons');
  });

  it('rejects a logged-in non-owner with 403', async () => {
    const owner = await signupUser();
    const post = await createPost(owner.cookie);
    const stranger = await signupUser();

    const res = await request(app).get(`/posts/${post._id}/edit`).set('Cookie', stranger.cookie);

    expect(res.statusCode).toBe(403);
  });

  it('returns 404 for a malformed post id', async () => {
    const { cookie } = await signupUser();

    const res = await request(app).get('/posts/not-a-valid-id/edit').set('Cookie', cookie);

    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for a well-formed id that does not exist', async () => {
    const { cookie } = await signupUser();
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app).get(`/posts/${fakeId}/edit`).set('Cookie', cookie);

    expect(res.statusCode).toBe(404);
  });
});

// ─── Update: save (ownership) ──────────────────────────────────────────────────

describe('POST /posts/:id/edit', () => {
  it('lets the owner update their own post', async () => {
    const owner = await signupUser();
    const post = await createPost(owner.cookie);

    const res = await request(app)
      .post(`/posts/${post._id}/edit`)
      .set('Cookie', owner.cookie)
      .send({
        type: 'offer',
        title: 'Guitar lessons (updated)',
        description: 'Beginner guitar, updated',
        skills: 'guitar',
        availability: 'Weekends',
      });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/posts?mine=1');

    const updated = await Post.findById(post._id);
    expect(updated.title).toBe('Guitar lessons (updated)');
  });

  it('rejects a non-owner with 403 and leaves the post unchanged', async () => {
    const owner = await signupUser();
    const post = await createPost(owner.cookie);
    const stranger = await signupUser();

    const res = await request(app)
      .post(`/posts/${post._id}/edit`)
      .set('Cookie', stranger.cookie)
      .send({ type: 'offer', title: 'Hijacked title', description: 'Should not save', skills: '', availability: '' });

    expect(res.statusCode).toBe(403);

    const unchanged = await Post.findById(post._id);
    expect(unchanged.title).toBe('Guitar lessons');
  });

  it('returns 404 for a malformed post id', async () => {
    const { cookie } = await signupUser();

    const res = await request(app)
      .post('/posts/not-a-valid-id/edit')
      .set('Cookie', cookie)
      .send({ type: 'offer', title: 'x', description: 'x' });

    expect(res.statusCode).toBe(404);
  });
});

// ─── Delete (ownership) ─────────────────────────────────────────────────────────

describe('POST /posts/:id/delete', () => {
  it('lets the owner soft-delete their own post', async () => {
    const owner = await signupUser();
    const post = await createPost(owner.cookie);

    const res = await request(app).post(`/posts/${post._id}/delete`).set('Cookie', owner.cookie);

    expect(res.statusCode).toBe(302);

    const deleted = await Post.findById(post._id);
    expect(deleted.status).toBe('deleted');
  });

  it('rejects a non-owner with 403 and leaves the post intact', async () => {
    const owner = await signupUser();
    const post = await createPost(owner.cookie);
    const stranger = await signupUser();

    const res = await request(app).post(`/posts/${post._id}/delete`).set('Cookie', stranger.cookie);

    expect(res.statusCode).toBe(403);

    const intact = await Post.findById(post._id);
    expect(intact.status).toBe('open');
  });

  it('returns 404 when the post has already been deleted', async () => {
    const owner = await signupUser();
    const post = await createPost(owner.cookie);
    await Post.findByIdAndUpdate(post._id, { status: 'deleted' });

    const res = await request(app).post(`/posts/${post._id}/delete`).set('Cookie', owner.cookie);

    expect(res.statusCode).toBe(404);
  });
});

// ─── Resolve (ownership) ────────────────────────────────────────────────────────

describe('POST /posts/:id/resolve', () => {
  it('lets the owner mark their own post resolved', async () => {
    const owner = await signupUser();
    const post = await createPost(owner.cookie);

    const res = await request(app).post(`/posts/${post._id}/resolve`).set('Cookie', owner.cookie);

    expect(res.statusCode).toBe(302);

    const resolved = await Post.findById(post._id);
    expect(resolved.status).toBe('resolved');
  });

  it('rejects a non-owner with 403 and leaves the post open', async () => {
    const owner = await signupUser();
    const post = await createPost(owner.cookie);
    const stranger = await signupUser();

    const res = await request(app).post(`/posts/${post._id}/resolve`).set('Cookie', stranger.cookie);

    expect(res.statusCode).toBe(403);

    const unchanged = await Post.findById(post._id);
    expect(unchanged.status).toBe('open');
  });
});
