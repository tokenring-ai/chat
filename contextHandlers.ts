import currentMessage from "./contextHandlers/currentMessage.ts";
import priorMessages from "./contextHandlers/priorMessages.ts";
import toolContext from "./contextHandlers/toolContext.ts";
import type { ContextHandler } from "./schema.ts";

export default {
  "current-message": currentMessage,
  "prior-messages": priorMessages,
  "tool-context": toolContext,
} as Record<string, ContextHandler>;
