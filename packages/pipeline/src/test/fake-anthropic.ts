import Anthropic from "@anthropic-ai/sdk";

/**
 * A real Anthropic client whose fetch returns a canned Messages API response,
 * so the test exercises the SDK's own request building and output parsing.
 */
export function clientReturning(message: Record<string, unknown>) {
  const requests: Record<string, unknown>[] = [];
  const client = new Anthropic({
    apiKey: "test-key",
    maxRetries: 0,
    fetch: (_url, init) => {
      requests.push(JSON.parse(init?.body as string) as Record<string, unknown>);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: "msg_test",
            type: "message",
            role: "assistant",
            model: "claude-test",
            stop_sequence: null,
            stop_details: null,
            usage: {
              input_tokens: 400,
              output_tokens: 300,
              cache_read_input_tokens: 1500,
              cache_creation_input_tokens: 0,
            },
            ...message,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    },
  });
  return { client, requests };
}
