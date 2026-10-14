import assert from "node:assert/strict";
import test from "node:test";
import { isQuotaError, parsePiOutput } from "./pi-output.mjs";

test("parsePiOutput extracts the final assistant text", () => {
  const output = [
    JSON.stringify({ type: "session", id: "session-1" }),
    JSON.stringify({
      type: "message_end",
      message: {
        role: "assistant",
        content: [{ type: "text", text: '{"verdict":"approve"}' }],
        usage: { totalTokens: 12 },
        model: "test-model",
      },
    }),
  ].join("\n");

  assert.deepEqual(parsePiOutput(output), {
    text: '{"verdict":"approve"}',
    usage: { totalTokens: 12 },
    model: "test-model",
  });
});

test("parsePiOutput exposes provider quota errors for fallback", () => {
  const output = JSON.stringify({
    type: "message_end",
    message: {
      role: "assistant",
      content: [],
      stopReason: "error",
      errorMessage: '429: {"code":"1308","message":"Usage limit reached"}',
    },
  });

  assert.throws(
    () => parsePiOutput(output),
    (error) => {
      assert.match(error.message, /Usage limit reached/);
      assert.equal(error.isQuotaError, true);
      assert.equal(isQuotaError(error), true);
      return true;
    },
  );
});

test("isQuotaError also recognizes quota errors from a non-zero CLI exit", () => {
  assert.equal(isQuotaError({ message: "exit 1", stderr: "HTTP 429 quota exceeded" }), true);
  assert.equal(isQuotaError(new Error("connection refused")), false);
});

test("parsePiOutput keeps a useful error for empty output", () => {
  assert.throws(() => parsePiOutput("{\"type\":\"session\"}"), {
    message: "sin salida de pi en modo json",
  });
});
