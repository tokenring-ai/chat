import {default as currentMessage} from "./contextHandlers/currentMessage.ts";
import {default as priorMessages} from "./contextHandlers/priorMessages.ts";
import {default as systemMessage} from "./contextHandlers/systemMessage.ts";
import {ContextHandler} from "./types.ts";

export default {
  'current-message': currentMessage,
  'prior-messages': priorMessages,
  'system-message': systemMessage,
} as Record<string, ContextHandler>;
