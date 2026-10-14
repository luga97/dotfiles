const QUOTA_RE = /insufficient|balance|quota|exhausted|\b429\b|\b402\b|rate.?limit|billing/i;

/** Parse pi --mode json output, preserving provider errors for fallback routing. */
export function parsePiOutput(stdout) {
  let text = "";
  let usage = null;
  let model = "";
  let providerError = "";

  for (const line of stdout.split("\n")) {
    if (!line.startsWith("{")) continue;

    try {
      const event = JSON.parse(line);
      const message = event.type === "message_end" ? event.message : null;
      if (!message) continue;

      if (message.stopReason === "error" || message.errorMessage) {
        providerError = String(message.errorMessage || "Pi terminó el mensaje con error");
        continue;
      }

      const content = message.content;
      text = Array.isArray(content)
        ? content.map((block) => block.text || "").join("")
        : String(content || "");
      usage = message.usage || null;
      model = message.model || "";
    } catch {
      // Ignore non-JSON and partial lines; the next complete event may contain the result.
    }
  }

  if (!text && providerError) {
    const error = new Error(providerError);
    error.isQuotaError = QUOTA_RE.test(providerError);
    throw error;
  }
  if (!text) throw new Error("sin salida de pi en modo json");
  return { text, usage, model };
}

export function isQuotaError(error) {
  const details = `${error?.message || error} ${error?.stderr || ""}`;
  return QUOTA_RE.test(details);
}
