type RetryOptions = {
  attempts?: number;
  delayMs?: number;
};

function errorText(error: unknown): string {
  const messages: string[] = [String(error)];
  let current: unknown = error;

  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const value = current as { message?: unknown; cause?: unknown };
    if (typeof value.message === "string") messages.push(value.message);
    current = value.cause;
  }

  return messages.join(" ");
}

function isTransientWebSocketError(error: unknown): boolean {
  const message = errorText(error).toLowerCase();
  return message.includes("normal closure") || message.includes("disconnected from wss://rpc.preprod.midnight.network");
}

export async function submitWithRetry<T>(
  submit: () => Promise<T>,
  { attempts = 3, delayMs = 2_000 }: RetryOptions = {},
): Promise<T> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await submit();
    } catch (error) {
      if (attempt === attempts || !isTransientWebSocketError(error)) throw error;
      console.warn(`Midnight RPC closed the submission connection; retrying (${attempt}/${attempts - 1})...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error("Unreachable");
}
