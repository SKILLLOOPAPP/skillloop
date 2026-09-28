const Post = require('../src/models/Post');

describe('Post database indexes', () => {
  const indexes = Post.schema.indexes().map(([fields]) => fields);

  test('defines an index for author/status queries ordered by newest first', () => {
    expect(indexes).toContainEqual({
      author: 1,
      status: 1,
      createdAt: -1,
    });
  });

  test('defines an index for status/type browsing ordered by newest first', () => {
    expect(indexes).toContainEqual({
      status: 1,
      type: 1,
      createdAt: -1,
    });
  });
});
