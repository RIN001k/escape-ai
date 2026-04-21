import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";

const generationConfig = {
  responseMimeType: "application/json",
  temperature: 1.0,
  topP: 0.95,
};

const MODEL_CASCADE = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
] as const;

let cachedClient: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY environment variable");
  if (!cachedClient) cachedClient = new GoogleGenerativeAI(key);
  return cachedClient;
}

function getModel(name: string): GenerativeModel {
  return getClient().getGenerativeModel({ model: name, generationConfig });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Generate content with retry + model fallback.
 * - Retries transient errors (503/429/500) with exponential backoff.
 * - Falls back to the next model in the cascade if the current stays overloaded.
 * - The API key is read lazily at call time (NOT at module load), so this file
 *   is safe to import during Next.js build-time page-data collection.
 */
export async function generateJSON(prompt: string): Promise<string> {
  let lastError: unknown;

  for (const modelName of MODEL_CASCADE) {
    const model = getModel(modelName);

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        const isTransient = /\b(503|429|500|overloaded|unavailable|high demand)\b/i.test(msg);

        if (!isTransient) throw err;

        await sleep(600 * Math.pow(2.2, attempt));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All Gemini models are currently unavailable.");
}
