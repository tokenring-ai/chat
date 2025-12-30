import currentMessage from "./contextHandlers/currentMessage.ts";
import priorMessages from "./contextHandlers/priorMessages.ts";
import systemMessage from "./contextHandlers/systemMessage.ts";
import toolContext from "./contextHandlers/toolContext.ts";
import {ContextHandler} from "./schema.ts";

export default {
  'current-message': currentMessage,
  'prior-messages': priorMessages,
  'system-message': systemMessage,
  'tool-context': toolContext,
} as Record<string, ContextHandler>;
