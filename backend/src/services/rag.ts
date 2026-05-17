import { z } from 'zod';
import { config } from '../config';

const RagChunkSchema = z.object({
  id: z.string().uuid(),
  document_id: z.string().uuid(),
  chunk_index: z.number().int(),
  content: z.string(),
  metadata: z.record(z.unknown()),
  file_name: z.string(),
  similarity: z.number(),
});

const SearchResponseSchema = z.object({
  results: z.array(RagChunkSchema),
  count: z.number().int(),
});

export type RagChunk = z.infer<typeof RagChunkSchema>;

export async function semanticSearch(
  query: string,
  topK: number = 5,
  threshold: number = 0.5,
): Promise<RagChunk[]> {
  const res = await fetch(`${config.pythonServicesUrl}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, top_k: topK, threshold }),
  });
  if (!res.ok) throw new Error(`RAG search error: ${res.status}`);
  return SearchResponseSchema.parse(await res.json()).results;
}
