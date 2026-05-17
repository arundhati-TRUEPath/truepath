import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { db } from '../db/client';

const app = createApp();

const SEED_IDS = ['situation', 'education', 'timeframe', 'schedule', 'environment', 'support', 'location'];

function buildAnswers(sessionId: string) {
  return {
    sessionId,
    answers: SEED_IDS.map((id) => ({ questionId: id, optionIds: ['opt_test'] })),
  };
}

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

  beforeAll(async () => {
    const res = await request(app).post('/api/v1/sessions/start').expect(201);
    sessionId = res.body.data.sessionId as string;
  });

  afterAll(async () => {
    if (sessionId) {
      await db.from('session_responses').delete().eq('session_id', sessionId);
      await db.from('sessions').delete().eq('id', sessionId);
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
      .send({ sessionId: 'not-a-uuid', answers: SEED_IDS.map((id) => ({ questionId: id, optionIds: ['x'] })) })
      .expect(400);

    expect(res.body.error).toMatchObject({ code: 'validation_error' });
  });

  it('returns 400 when fewer than 7 answers are provided', async () => {
    const res = await request(app)
      .post('/api/v1/intake/followup')
      .send({ sessionId, answers: [{ questionId: 'situation', optionIds: ['opt_test'] }] })
      .expect(400);

    expect(res.body.error).toMatchObject({ code: 'validation_error' });
  });

  it('returns 400 when an answer has no optionIds', async () => {
    const answers = SEED_IDS.map((id) => ({ questionId: id, optionIds: [] }));
    const res = await request(app)
      .post('/api/v1/intake/followup')
      .send({ sessionId, answers })
      .expect(400);

    expect(res.body.error).toMatchObject({ code: 'validation_error' });
  });

  it('saves responses and returns 3 followup questions', async () => {
    const res = await request(app)
      .post('/api/v1/intake/followup')
      .send(buildAnswers(sessionId))
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
    const { data } = await db
      .from('session_responses')
      .select('id')
      .eq('session_id', sessionId);

    expect(data).toHaveLength(7);
  });

  it('sets session status to seed_complete', async () => {
    const { data } = await db
      .from('sessions')
      .select('status')
      .eq('id', sessionId)
      .single();

    expect(data).toMatchObject({ status: 'seed_complete' });
  });
});
