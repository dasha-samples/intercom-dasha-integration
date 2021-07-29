import * as dasha from "@dasha.ai/sdk";
import { IntercomConversation } from "./intercomConversation";

export interface IIntercomClient {
  readMessages(
    conversationId: string,
    lastTime: number
  ): Promise<{ messages: string[]; lastTime: number }>;
  reply(conversationId: string, text: string): Promise<any>;
  markAsRead(conversationId: string): Promise<void>;
  onCompletedConversation(
    callback?: (
      conversation: IntercomConversation,
      result: dasha.ConversationResult<Record<string, unknown>>
    ) => Promise<void>
  ): void;
  onRejectedConversation(
    callback?: (conversation: IntercomConversation) => Promise<void>
  ): void;
  onFailedConversation(
    callback?: (conversation: IntercomConversation, error: any) => Promise<void>
  ): void;
  onTimedOutConversation(
    callback?: (conversation: IntercomConversation) => Promise<void>
  ): void;
  setLogger(logger: Console): void;
  simpleConnectToDashaApp(
    application: dasha.Application<
      Record<string, unknown>,
      Record<string, unknown>
    >
  ): Promise<void>;
  onTranscriptionConversation(
    callback?: (
      conversation: IntercomConversation,
      transctiption: dasha.Transcription
    ) => Promise<void>
  ): void
}
