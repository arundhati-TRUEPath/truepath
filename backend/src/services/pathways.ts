import OpenAI from 'openai';
import { z } from 'zod';
import { config } from '../config';
import { logger } from '../logger';
import { semanticSearch, type RagChunk } from './rag';
import { PATHWAYS_SYSTEM_PROMPT } from '../prompts/pathways-system-prompt';
import type { SessionQA } from '../repositories/sessions.repo';
import type { ClientSkill } from '../repositories/skills.repo';
import type { SavedPathways, Pathway, Limitations } from '../repositories/pathways.repo';

// We over-fetch from the vector store so the top results aren't crowded out by
// the xlsx tables (JobTable/Training/etc., ~68 chunks) at the expense of the
// 9 single-chunk pathway PDFs. After retrieval we split chunks by file type
// and pick the top 3 pathway PDFs by max similarity.
const SEARCH_TOP_K = 50;
const SEARCH_THRESHOLD = 0;
const PATHWAY_COUNT = 3;
const SUPPORT_CHUNK_LIMIT = 12;

const TagToneSchema = z.enum(['sage', 'amber', 'clay', '']);

const TagSchema = z.object({
  label: z.string().min(1).max(40),
  tone: TagToneSchema,
});

const CareerStepSchema = z.object({
  role: z.string().min(1),
  meta: z.string().min(1),
  current: z.boolean().optional(),
});

const PathwaySchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id must be kebab-case'),
  rank: z.number().int().min(1).max(3),
  featured: z.boolean().optional(),
  title: z.string().min(1).max(80),
  sub: z.string().min(1),
  wageRange: z.string().min(1),
  wageNote: z.string().min(1),
  confidence: z.number().int().min(1).max(5),
  tags: z.array(TagSchema).min(2).max(5),
  ladder: z.array(CareerStepSchema).min(2).max(5),
  why: z.string().min(1),
});

const LimitationsSchema = z.object({
  headline: z.string().min(1),
  summary: z.string().min(1),
  bullets: z.array(z.string().min(1)).min(1).max(6),
});

const LlmResponseSchema = z.object({
  pathways: z.array(PathwaySchema).length(PATHWAY_COUNT),
  limitations: LimitationsSchema,
});

function isPdfChunk(chunk: RagChunk): boolean {
  return chunk.file_name.toLowerCase().endsWith('.pdf');
}

function buildSearchQuery(qa: SessionQA[], skills: ClientSkill[]): string {
  const qaLines = qa.map((item) => {
    const labels = item.selectedLabels.join(', ');
    return `[${item.questionCategory}] ${item.questionTitle} -> ${labels || '(no answer)'}`;
  });
  const skillLine = skills.length
    ? `Confirmed skills: ${skills.map((s) => s.label).join(', ')}`
    : 'Confirmed skills: (none)';
  return [skillLine, ...qaLines].join('\n');
}

interface TopDocument {
  fileName: string;
  topSimilarity: number;
  chunks: RagChunk[];
}

function pickTopDocuments(chunks: RagChunk[], count: number): TopDocument[] {
  const byFile = new Map<string, TopDocument>();
  for (const chunk of chunks) {
    const existing = byFile.get(chunk.file_name);
    if (existing) {
      existing.chunks.push(chunk);
      if (chunk.similarity > existing.topSimilarity) {
        existing.topSimilarity = chunk.similarity;
      }
    } else {
      byFile.set(chunk.file_name, {
        fileName: chunk.file_name,
        topSimilarity: chunk.similarity,
        chunks: [chunk],
      });
    }
  }

  return Array.from(byFile.values())
    .sort((a, b) => b.topSimilarity - a.topSimilarity)
    .slice(0, count);
}

function buildPathwayContext(docs: TopDocument[]): string {
  return docs
    .map((doc, i) => {
      const body = doc.chunks
        .sort((a, b) => a.chunk_index - b.chunk_index)
        .map((c) => c.content)
        .join('\n\n');
      return `--- PATHWAY ${i + 1} · file: ${doc.fileName} · similarity: ${doc.topSimilarity.toFixed(3)} ---\n${body}`;
    })
    .join('\n\n');
}

function buildSupportingContext(chunks: RagChunk[]): string {
  const xlsxChunks = chunks
    .filter((c) => !isPdfChunk(c))
    .slice(0, SUPPORT_CHUNK_LIMIT);
  if (xlsxChunks.length === 0) return '(no supporting table rows retrieved)';

  return xlsxChunks
    .map((c) => `- [${c.file_name}] ${c.content}`)
    .join('\n');
}

function buildUserMessage(
  qa: SessionQA[],
  skills: ClientSkill[],
  pdfDocs: TopDocument[],
  allChunks: RagChunk[],
): string {
  const qaLines = qa.map((item, i) => {
    const labels = item.selectedLabels.join(', ');
    return `${i + 1}. [${item.questionCategory}] ${item.questionTitle}\n   Answer: ${labels || '(no answer)'}`;
  });

  const skillLines = skills.length
    ? skills.map((s) => `- ${s.label} (${s.confidence}): ${s.sub}`).join('\n')
    : '(user did not confirm any skills)';

  return [
    'USER INTAKE ANSWERS (10 questions):',
    qaLines.join('\n\n'),
    '',
    'USER CONFIRMED SKILLS:',
    skillLines,
    '',
    'TOP-RANKED PATHWAY DOCUMENTS (you MUST recommend exactly these three, ranked in this order):',
    buildPathwayContext(pdfDocs),
    '',
    'SUPPORTING TABLE ROWS (wages, training programs, support systems — use to ground wageRange/tags):',
    buildSupportingContext(allChunks),
  ].join('\n');
}

export async function generatePathwayRecommendations(
  qa: SessionQA[],
  skills: ClientSkill[],
): Promise<SavedPathways> {
  if (!config.openai.apiKey) {
    throw new Error('OPENAI_API_KEY is not set. Add it to backend/.env to enable pathway generation.');
  }
  if (qa.length === 0) {
    throw new Error('Cannot generate pathways without intake answers.');
  }

  const query = buildSearchQuery(qa, skills);
  logger.info({ event: 'pathways_search_request', topK: SEARCH_TOP_K, qaCount: qa.length, skillCount: skills.length });

  const allChunks = await semanticSearch(query, SEARCH_TOP_K, SEARCH_THRESHOLD);
  const pdfChunks = allChunks.filter(isPdfChunk);
  const pdfDocs = pickTopDocuments(pdfChunks, PATHWAY_COUNT);

  if (pdfDocs.length < PATHWAY_COUNT) {
    throw new Error(
      `Vector search returned only ${pdfDocs.length} distinct pathway documents (need ${PATHWAY_COUNT}). Lower the similarity threshold or re-ingest rag-data.`,
    );
  }

  logger.info({
    event: 'pathways_search_result',
    pathwayFiles: pdfDocs.map((d) => ({ file: d.fileName, sim: d.topSimilarity })),
    supportingChunkCount: allChunks.filter((c) => !isPdfChunk(c)).length,
  });

  const client = new OpenAI({ apiKey: config.openai.apiKey });
  const userMessage = buildUserMessage(qa, skills, pdfDocs, allChunks);

  const messages = [
    { role: 'system' as const, content: PATHWAYS_SYSTEM_PROMPT },
    { role: 'user' as const, content: userMessage },
  ];

  logger.info({ event: 'llm_pathways_request', model: config.openai.model });

  const completion = await client.chat.completions.create({
    model: config.openai.model,
    response_format: { type: 'json_object' },
    messages,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty response from OpenAI');
  logger.info({ event: 'llm_pathways_response', length: raw.length });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('OpenAI returned non-JSON content');
  }

  const validated = LlmResponseSchema.safeParse(parsed);
  if (!validated.success) {
    logger.error({ event: 'llm_pathways_invalid', issues: validated.error.issues, raw });
    throw new Error('LLM pathway response did not match expected schema');
  }

  const pathways: Pathway[] = validated.data.pathways.map((p, i) => ({
    ...p,
    rank: i + 1,
    featured: i === 0 ? true : p.featured,
  }));
  const limitations: Limitations = validated.data.limitations;

  return {
    pathways,
    limitations,
    sourceFiles: pdfDocs.map((d) => d.fileName),
  };
}
