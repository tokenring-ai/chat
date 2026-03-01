import chatSend from "./commands/chat/send.ts";
import chatContext from "./commands/chat/context.ts";
import compact from "./commands/compact.ts";
import model from "./commands/model.ts";
import tool from "./commands/tool.ts";

export default [
  chatSend,
  chatContext,
  model,
  compact,
  tool,
];
