/**
 * Retrieval module.
 *
 * Two responsibilities:
 *   1. Embed the user's query with Voyage AI (input_type='query')
 *   2. Call the Supabase match_chunks RPC to get top-N relevant chunks
 */

const VOYAGE_EMBEDDINGS_URL = 'https://api.voyageai.com/v1/embeddings';

/**
 * Embed a query string. Returns a 1024-dim vector.
 * IMPORTANT: input_type='query' (not 'document') for search-time embeddings.
 * voyage-3 / voyage-3-large produce embeddings optimized differently for
 * query vs document context.
 */
export async function embedQuery(env, text) {
  const res = await fetch(VOYAGE_EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: [text],
      model: env.VOYAGE_MODEL || 'voyage-3-large',
      input_type: 'query',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Voyage API error ${res.status}: ${body}`);
  }

  const json = await res.json();
  return json.data[0].embedding;
}

/**
 * Retrieve top-N chunks from Supabase using cosine similarity.
 * Uses the match_chunks RPC defined in supabase_setup.sql.
 *
 * Options:
 *   matchThreshold (default 0.4) — minimum similarity to include
 *   matchCount     (default 5)
 *   filterAudience (default null) — if set, restricts to chunks where
 *                                   audience matches or is 'all'
 *   filterEscalation (default false) — if true, only escalation_relevant chunks
 */
export async function retrieveChunks(env, queryEmbedding, options = {}) {
  const {
    matchThreshold = 0.4,
    matchCount = 5,
    filterAudience = null,
    filterEscalation = false,
  } = options;

  const useFiltered = filterAudience !== null || filterEscalation === true;
  const rpc = useFiltered ? 'match_chunks_filtered' : 'match_chunks';

  const body = useFiltered
    ? {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
        filter_audience: filterAudience,
        filter_escalation_only: filterEscalation,
      }
    : {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
      };

  const url = `${env.SUPABASE_URL}/rest/v1/rpc/${rpc}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Supabase RPC error ${res.status}: ${errBody}`);
  }

  return await res.json(); // array of {chunk_id, title, content, evidence_levels, escalation_relevant, similarity}
}
