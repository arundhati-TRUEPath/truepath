import { z } from 'zod';
import { config } from '../config';

const EmbedResponseSchema = z.object({
  embedding: z.array(z.number()),
  dimensions: z.number().int(),
});

const EmbedBatchResponseSchema = z.object({
  embeddings: z.array(z.array(z.number())),
  count: z.number().int(),
});

export async function embedText(text: string): Promise<number[]> {
  const res = await fetch(`${config.pythonServicesUrl}/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Embedding service error: ${res.status}`);
  return EmbedResponseSchema.parse(await res.json()).embedding;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch(`${config.pythonServicesUrl}/embed-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts }),
  });
  if (!res.ok) throw new Error(`Embedding service error: ${res.status}`);
  return EmbedBatchResponseSchema.parse(await res.json()).embeddings;
}
