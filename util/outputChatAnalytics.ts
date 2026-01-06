import Agent from "@tokenring-ai/agent/Agent";
import type {AIResponse} from "@tokenring-ai/ai-client/client/AIChatClient";

export function outputChatAnalytics(
  response: AIResponse,
  agent: Agent,
  pkgName: string = "Chat Complete",
) {
  const {
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningTokens,
  } = response.totalUsage;

  const usage = [
    `- Input Tokens: ${inputTokens?.toLocaleString() ?? "unknown"}${cachedInputTokens ? ` (+${cachedInputTokens} cached)` : ""}`,
    `- Output Tokens: ${outputTokens?.toLocaleString() ?? "unknown"}${reasoningTokens ? ` (+${reasoningTokens} reasoning)` : ""}`
  ];

  if (response.lastStepUsage.inputTokens && response.lastStepUsage.outputTokens) {
    usage.push(`- Context Length: ${(response.lastStepUsage.inputTokens + response.lastStepUsage.outputTokens).toLocaleString()}`);
  }

  const {input, cachedInput, output, reasoning, total} = response.cost;
  if (total) {
    usage.push(
      `- Input Cost: \$${input ? input.toFixed(4) : "unknown"}${cachedInput ? ` (+\$${cachedInput.toFixed(4)} cached)` : ""}`,
      `- Output Cost: \$${output ? output.toFixed(4) : "unknown"}${reasoning ? ` (+\$${reasoning.toFixed(4)} reasoning)` : ""}`,
    );

  }

  const {elapsedMs, tokensPerSec} = response.timing;

  const seconds = (elapsedMs / 1000).toFixed(2);
  const tps = tokensPerSec ? tokensPerSec.toFixed(0) : "N/A";

  usage.push(`- Run Time: ${seconds}s`);
  if (tps) {
    usage.push(`- Throughput: ${tps} tk/s`);
  }

  agent.infoLine(`${pkgName}\n${usage.join("\n")}`);
}
