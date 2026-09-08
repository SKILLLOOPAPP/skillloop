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

// ─── Signup ───────────────────────────────────────────────────────────────────

describe('POST /api/auth/signup', () => {
  it('creates a new user and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ firstName: 'Alice', password: 'password123' });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.firstName).toBe('Alice');
    expect(res.body.user.email).toBe('alice@skillloop.local');
  });

  it('rejects signup when firstName is missing', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ password: 'password123' });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects signup when password is too short', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ firstName: 'Bob', password: '123' });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects duplicate user signup', async () => {
    await request(app)
      .post('/api/auth/signup')
      .send({ firstName: 'Charlie', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ firstName: 'Charlie', password: 'password123' });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already exists/i);
  });
});

// ─── Signin ───────────────────────────────────────────────────────────────────

describe('POST /api/auth/signin', () => {
  beforeEach(async () => {
    await request(app)
      .post('/api/auth/signup')
      .send({ firstName: 'Dave', password: 'password123' });
  });

  it('signs in with correct credentials and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/signin')
      .send({ email: 'dave@skillloop.local', password: 'password123' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
  });

  it('rejects signin with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/signin')
      .send({ email: 'dave@skillloop.local', password: 'wrongpassword' });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects signin with unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/signin')
      .send({ email: 'nobody@skillloop.local', password: 'password123' });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects signin when fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/signin')
      .send({ email: 'dave@skillloop.local' });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─── Protected route ──────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  it('returns user data when token is valid', async () => {
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({ firstName: 'Eve', password: 'password123' });

    const token = signupRes.body.token;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects request with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toBe(401);
  });
});
