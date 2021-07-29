import * as dasha from "@dasha.ai/sdk";

export interface IIntercomChat {
  run(chatChannel: dasha.chat.Chat): Promise<void>;
}
