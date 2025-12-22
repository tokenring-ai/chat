import {z} from "zod";

export const ChatClientConfigSchema = z.object({
  defaultModel: z.string(),
});



export {default as ChatService} from "./ChatService.ts";
