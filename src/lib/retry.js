export async function withRetry(operation, options = {}) {
  const { attempts = 3, baseDelayMs = 500, shouldRetry = defaultShouldRetry } = options;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !shouldRetry(error)) throw error;
      await new Promise((resolve) => window.setTimeout(resolve, baseDelayMs * attempt));
    }
  }
  throw lastError;
}

function defaultShouldRetry(error) {
  const status = Number(error?.status || error?.statusCode || 0);
  if (status >= 400 && status < 500 && status !== 408 && status !== 429) return false;
  return true;
}
