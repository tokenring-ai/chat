import {Agent} from "@tokenring-ai/agent";
import markdownList from "@tokenring-ai/utility/string/markdownList";
import ChatService from "../../ChatService.ts";

export default async function settings(
  remainder: string,
  agent: Agent,
): Promise<void> {
  const chatService = agent.requireServiceByType(ChatService);
  const args = remainder.split(/\s+/);
  if (args.length === 0) {
    // Show current settings
    const config = chatService.getChatConfig(agent);
    const lines: string[] = ["Current AI settings:"];
    const entries = Object.entries(config).map(([key, value]) => `${key}: ${value}`);
    lines.push(markdownList(entries));
    agent.infoMessage(lines.join("\n"));
    return;
  }

  const updates: Record<string, any> = {};

  for (const part of args) {
    const [key, value] = part.split("=");

    if (!key || value === undefined) {
      agent.errorMessage(`Invalid format: ${part}. Use key=value`);
      continue;
    }

    // Parse value based on key type
    let parsedValue: any = value;
    if (
      key === "temperature" ||
      key === "topP" ||
      key === "frequencyPenalty" ||
      key === "presencePenalty"
    ) {
      parsedValue = parseFloat(value);
      if (isNaN(parsedValue)) {
        agent.errorMessage(`Invalid number for ${key}: ${value}`);
        continue;
      }
    } else if (key === "maxTokens") {
      parsedValue = parseInt(value);
      if (isNaN(parsedValue)) {
        agent.errorMessage(`Invalid integer for ${key}: ${value}`);
        continue;
      }
    } else if (key === "stopSequences") {
      parsedValue = value.split(",");
    } else if (key === "autoCompact") {
      parsedValue = value.toLowerCase() === "true";
    }

    updates[key] = parsedValue;
  }

  if (Object.keys(updates).length > 0) {
    chatService.updateChatConfig(updates, agent);
    agent.infoMessage(`Updated AI settings: ${Object.keys(updates).join(", ")}`);
  }
}