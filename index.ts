import {z} from "zod";

export const ChatClientConfigSchema = z.object({
  defaultModel: z.string(),
});



export {createChatRequest} from "./chatRequestBuilder/createChatRequest.ts";
export {default as ChatService} from "./ChatService.ts";
