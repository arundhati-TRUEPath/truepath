import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { db } from '../db/client';

const app = createApp();

describe('POST /api/v1/sessions/start', () => {
  const createdIds: string[] = [];

  afterAll(async () => {
    if (createdIds.length > 0) {
      await db.from('session_responses').delete().in('session_id', createdIds);
      await db.from('sessions').delete().in('id', createdIds);
    }
  });

  it('returns 201 with a UUID sessionId', async () => {
    const res = await request(app)
      .post('/api/v1/sessions/start')
      .expect(201);

    expect(res.body.error).toBeNull();
    expect(res.body.data).toMatchObject({ sessionId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    createdIds.push(res.body.data.sessionId as string);
  });

  it('returns the response envelope shape', async () => {
    const res = await request(app)
      .post('/api/v1/sessions/start')
      .expect(201);

    expect(res.body).toMatchObject({ data: expect.any(Object), error: null, meta: null });
    createdIds.push(res.body.data.sessionId as string);
  });

  it('persists the session in the database', async () => {
    const res = await request(app)
      .post('/api/v1/sessions/start')
      .expect(201);

    const sessionId = res.body.data.sessionId as string;
    createdIds.push(sessionId);

    const { data } = await db
      .from('sessions')
      .select('id, status')
      .eq('id', sessionId)
      .single();

    expect(data).toMatchObject({ id: sessionId, status: 'in_progress' });
  });
});
