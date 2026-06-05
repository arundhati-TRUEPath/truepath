import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { pool } from '../db/client';

const app = createApp();

describe('GET /api/v1/intake/questions', () => {
  it('returns 200 with 7 seed questions', async () => {
    const res = await request(app)
      .get('/api/v1/intake/questions')
      .expect(200);

    expect(res.body.error).toBeNull();
    expect(res.body.data).toHaveLength(7);
  });

  it('each question has id, title, layout, and at least one option', async () => {
    const res = await request(app)
      .get('/api/v1/intake/questions')
      .expect(200);

    for (const q of res.body.data as unknown[]) {
      expect(q).toMatchObject({
        id: expect.any(String),
        title: expect.any(String),
        layout: expect.stringMatching(/^(wrap|column)$/),
        options: expect.arrayContaining([
          expect.objectContaining({ id: expect.any(String), label: expect.any(String) }),
        ]),
      });
    }
  });
});

describe('POST /api/v1/intake/followup', () => {
  let sessionId: string;
  let answers: Array<{ questionId: string; optionIds: string[] }>;

  beforeAll(async () => {
    const qRes = await request(app).get('/api/v1/intake/questions').expect(200);
    const questions = qRes.body.data as Array<{ id: string; options: Array<{ id: string }> }>;
    answers = questions.map((q) => ({ questionId: q.id, optionIds: [q.options[0].id] }));

    const sRes = await request(app).post('/api/v1/sessions/start').expect(201);
    sessionId = sRes.body.data.sessionId as string;
  });

  afterAll(async () => {
    if (sessionId) {
      await pool.query('DELETE FROM session_responses WHERE session_id = $1', [sessionId]);
      await pool.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
    }
  });

  it('returns 400 when body is missing', async () => {
    const res = await request(app)
      .post('/api/v1/intake/followup')
      .expect(400);

    expect(res.body.data).toBeNull();
    expect(res.body.error).toMatchObject({ code: 'validation_error' });
  });

  it('returns 400 when sessionId is not a UUID', async () => {
    const res = await request(app)
      .post('/api/v1/intake/followup')
      .send({ sessionId: 'not-a-uuid', answers: answers.map((a) => ({ ...a })) })
      .expect(400);

    expect(res.body.error).toMatchObject({ code: 'validation_error' });
  });

  it('returns 400 when fewer than 7 answers are provided', async () => {
    const res = await request(app)
      .post('/api/v1/intake/followup')
      .send({ sessionId, answers: [answers[0]] })
      .expect(400);

    expect(res.body.error).toMatchObject({ code: 'validation_error' });
  });

  it('returns 400 when an answer has no optionIds', async () => {
    const emptyOptions = answers.map((a) => ({ questionId: a.questionId, optionIds: [] }));
    const res = await request(app)
      .post('/api/v1/intake/followup')
      .send({ sessionId, answers: emptyOptions })
      .expect(400);

    expect(res.body.error).toMatchObject({ code: 'validation_error' });
  });

  it('saves responses and returns 3 followup questions', async () => {
    const res = await request(app)
      .post('/api/v1/intake/followup')
      .send({ sessionId, answers })
      .expect(200);

    expect(res.body.error).toBeNull();
    expect(res.body.data.questions).toHaveLength(3);

    for (const q of res.body.data.questions as unknown[]) {
      expect(q).toMatchObject({
        id: expect.any(String),
        title: expect.any(String),
        options: expect.arrayContaining([
          expect.objectContaining({ id: expect.any(String), label: expect.any(String) }),
        ]),
      });
    }
  });

  it('persists 7 session_responses rows in the database', async () => {
    const { rows } = await pool.query<{ id: string }>(
      'SELECT id FROM session_responses WHERE session_id = $1',
      [sessionId],
    );
    expect(rows).toHaveLength(7);
  });

  it('sets session status to seed_complete', async () => {
    const { rows } = await pool.query<{ status: string }>(
      'SELECT status FROM sessions WHERE id = $1',
      [sessionId],
    );
    expect(rows[0]).toMatchObject({ status: 'seed_complete' });
  });
});
