import availableAgents from "./contextHandlers/availableAgents.ts";
import currentMessage from "./contextHandlers/currentMessage.ts";
import priorMessages from "./contextHandlers/priorMessages.ts";
import toolCall from "./contextHandlers/toolCall.ts";
import toolContext from "./contextHandlers/toolContext.ts";
import type { ContextHandler } from "./schema.ts";

export default {
  "current-message": currentMessage,
  "prior-messages": priorMessages,
  "tool-context": toolContext,
  "tool-call": toolCall,
  "available-agents": availableAgents,
} as Record<string, ContextHandler>;
