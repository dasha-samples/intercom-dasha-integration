import * as dasha from "@dasha.ai/sdk";
import { IIntercomChat } from "./interfaces/intercomChat";
import { IIntercomClient } from "./interfaces/intercomClient";

export class IntercomConversationClient implements IIntercomChat {
  // Id of conversation on Intercom.
  public readonly conversationId: string;
  // Used Intercom client.
  private readonly client: IIntercomClient;
  // Delay for reading new messages from Intercom conversation.
  private readonly delayReading: number;
  // This property indicate that this client in a close state.
  private close = false;
  //Creation time of the last message we read from Intercom conversation.
  private lastTime = 0;

  public constructor(client: IIntercomClient, conversationId: string, lastTime: number, delayReading: number) {
    this.client = client;
    this.conversationId = conversationId;
    this.lastTime = lastTime;
    this.delayReading = delayReading;
  }

  public async run(chatChannel: dasha.chat.Chat): Promise<void> {
    // listen message from dasha sdk application and write into intercom
    chatChannel.on("text",async(text)=>{
      await this.client.reply(this.conversationId, text);
    });
    chatChannel.on("close",()=>{
      this.close = true;
    });
    chatChannel.on("error",(error)=>{
      this.close = true;
      console.warn("chat error:", error);
    });
    // listen message from intercom and write into dasha sdk chat channel
    await this.readConversation(chatChannel);
  }

  private async readConversation(chatChannel: dasha.chat.Chat): Promise<void> {
    while (!this.close) {
      await new Promise((resolve, _) => setTimeout(resolve, this.delayReading));
      // read new messages in intercom conversation
      const obj = await this.client.readMessages(this.conversationId, this.lastTime);
      // mark conversation as read. This see user in intercom
      await this.client.markAsRead(this.conversationId);

      this.lastTime = obj.lastTime;
      // send new message from intercom into dasha sdk application
      for (const msg of obj.messages) {
        await chatChannel.sendText(msg);
      }
    }
    console.log(`end read`);
  }
}
