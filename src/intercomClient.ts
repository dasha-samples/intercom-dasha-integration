import axios, { AxiosInstance, AxiosError } from "axios";
import * as dasha from "@dasha.ai/sdk";
import * as querystring from "querystring";
import { AxiosExtendedError } from "./axiosExtendedError";
import { IntercomConversationClient } from "./intercomConversationClient";
import { ConversationParts } from "./interfaces/conversationParts";
import { IIntercomAccessData } from "./interfaces/intercomAccessData";
import { IIntercomChat } from "./interfaces/intercomChat";
import { IIntercomClient } from "./interfaces/intercomClient";
import { IntercomConversation } from "./interfaces/intercomConversation";
import { IntercomListConversation } from "./interfaces/intercomListConversation";

export class IntercomClient implements IIntercomClient {
  private adminId!: string;
  private client: AxiosInstance;
  private accessData: IIntercomAccessData;
  private isSimpleUsed = false;
  private _logger?: Console;

  private onTimedOutJob?: (conversation: IntercomConversation) => Promise<void>;
  private onFailedJob?: (
    conversation: IntercomConversation,
    error: any
  ) => Promise<void>;
  private onRejected?: (conversation: IntercomConversation) => Promise<void>;
  private onCompletedJob?: (
    conversation: IntercomConversation,
    result: dasha.ConversationResult<Record<string, unknown>>
  ) => Promise<void>;
  private onTransctiption?: (
    conversation: IntercomConversation,
    transctiption: dasha.Transcription
  ) => Promise<void>;

  private constructor(url: string, data: IIntercomAccessData) {
    this.accessData = data;
    this.client = axios.create({
      baseURL: url,
      headers: {
        Authorization: `Bearer ${this.accessData.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      paramsSerializer: querystring.stringify,
      responseType: "json",
    });
    this.client.interceptors.response.use(undefined, (error: AxiosError) => {
      const validationErrors: { [field: string]: string[] } | undefined =
        error.response?.data?.errors;
      if (validationErrors !== undefined) {
        const messages = Object.values(validationErrors).flat().join(" ");
        return Promise.reject(new AxiosExtendedError(messages, error));
      }

      const errorDetails = error.response?.data?.details;
      if (errorDetails !== undefined) {
        return Promise.reject(new AxiosExtendedError(errorDetails, error));
      }

      const errorReason = error.response?.data?.reason;
      if (errorReason !== undefined) {
        return Promise.reject(new AxiosExtendedError(errorReason, error));
      }

      const statusText = error.response?.statusText;
      if (statusText !== undefined) {
        return Promise.reject(new AxiosExtendedError(statusText, error));
      }

      return Promise.reject(new AxiosExtendedError(error.message, error));
    });
  }

  static async create(
    url: "https://api.intercom.io",
    accessData: IIntercomAccessData
  ): Promise<IIntercomClient> {
    const client = new IntercomClient(url, accessData);
    client.adminId = await client.getAdminId();
    return client;
  }

  private async getAdminId(): Promise<string> {
    const response = await this.client.get("/me");

    if (response.status !== 200) {
      throw new Error(
        `Got not Ok status while getting adminId from intercom api. ${response.statusText}`
      );
    }
    return response.data?.id;
  }

  private async searchContact(userId: string): Promise<string> {
    const response = await this.client.post("/contacts/search", {
      query: {
        field: "external_id",
        operator: "~",
        value: userId,
      },
    });

    if (response.status !== 200) {
      throw new Error(
        `Got not Ok status while getting contact for '${userId}' from intercom api. StatusText: '${response.statusText}'`
      );
    }

    const id = (response.data.data as any[])?.find(
      (x) => x.external_id == userId
    )?.id;

    return id;
  }

  private async createConversation(externalId: string): Promise<string> {
    const userId = await this.searchContact(externalId);
    const response = await this.client.post("/conversations", {
      from: { type: "user", id: userId },
      body: "Chat has been created",
    });

    if (response.status !== 200) {
      throw new Error(
        `Got not ok status while creating conversation with '${externalId}' from intercom api. StatusText: '${response.statusText}'`
      );
    }

    const conversationId = response.data.conversation_id;

    return conversationId;
  }

  private async closeConversation(
    conversationId: string,
    messageOnClose: string
  ): Promise<void> {
    const response = await this.client.post(
      `/conversations/${conversationId}/parts`,
      {
        message_type: "close",
        type: "admin",
        admin_id: this.adminId,
        body: messageOnClose,
      }
    );

    if (response.status !== 200) {
      throw new Error(
        `Got not ok status while closing conversation '${conversationId}' from intercom api. StatusText: '${response.statusText}'`
      );
    }
  }

  private async openConversation(conversationId: string): Promise<void> {
    const response = await this.client.post(
      `/conversations/${conversationId}/parts`,
      {
        message_type: "open",
        admin_id: this.adminId,
      }
    );

    if (response.status !== 200) {
      throw new Error(
        `Got not ok status while opening conversation '${conversationId}' from intercom api. StatusText: '${response.statusText}'`
      );
    }
  }

  public async runChatWithUser(
    // external userId, it was guid
    externalId: string,
    // is the conversation open at the moment
    conversationWasOpen: boolean,
    options: {
      // if define then conversation after and needs to be closed
      // else conversation does not need to be closed
      closeAfter?: {
        messageOnClose: string;
      };
      // if nod defined than used first available user message in conversation
      // else use last available user message in conversation
      startOptions?: {
        // ignore last message, and awaiting new message
        skipLastMessage: boolean;
      };
      // period of receiving new messages from the api intercom
      periodReading: number;
    }
  ): Promise<IIntercomChat> {
    // First of all we need create conversation with this user
    const conversationId = await this.createConversation(externalId);

    return await this.runChatInConversation(
      conversationId,
      conversationWasOpen,
      options
    );
  }

  public async runChatInConversation(
    conversationId: string,
    // is the conversation open at the moment
    conversationWasOpen: boolean,
    options: {
      // if define than conversation after and need close
      // else conversation does not closing
      closeAfter?: {
        messageOnClose: string;
      };
      // if nod defined than used first available user message in conversation
      // else use last available user message in conversation
      startOptions?: {
        // ignore last message, and awaiting new message
        skipLastMessage: boolean;
      };
      // period of receiving new messages from the api intercom
      periodReading: number;
    }
  ): Promise<IIntercomChat> {
    // Create client for each conversation
    const intercomConversationClient = new IntercomConversationClient(
      this,
      conversationId,
      options.startOptions === undefined
        ? 0
        : await this.getLastTime(
          conversationId,
          options.startOptions.skipLastMessage
        ),
      options.periodReading
    );

    return {
      // hook which was triggered when conversation was started on the dasha platform.
      run: async (chatChannel: dasha.chat.Chat): Promise<void> => {
        try {
          // open conversation if it`s needed
          if (!conversationWasOpen) {
            await this.openConversation(conversationId);
          }

          // run conversation chat
          await intercomConversationClient.run(chatChannel);
        } finally {
          // close conversation if it`s need
          if (options.closeAfter !== undefined) {
            try {
              await this.closeConversation(
                conversationId,
                options.closeAfter.messageOnClose
              );
            } catch (e) {
              this._logger?.error(JSON.stringify(e));
            }
          }
        }
      },
    };
  }

  public async markAsRead(conversationId: string): Promise<void> {
    const response = await this.client.put(`/conversations/${conversationId}`, {
      read: true,
    });

    if (response.status !== 200) {
      throw new Error(
        `Got not ok status while mark conversation '${conversationId}' as read from intercom api. StatusText: '${response.statusText}'`
      );
    }
  }

  public async reply(conversationId: string, text: string): Promise<any> {
    const response = await this.client.post(
      `/conversations/${conversationId}/reply`,
      {
        message_type: "comment",
        type: "admin",
        admin_id: this.adminId,
        body: text,
      }
    );

    if (response.status !== 200) {
      throw new Error(
        `Got not ok status while reply into conversation '${conversationId}' from intercom api. StatusText: '${response.statusText}'`
      );
    }
    return response.data;
  }

  public async readMessages(
    conversationId: string,
    lastTime: number
  ): Promise<{ messages: string[]; lastTime: number }> {
    const messages = await this.getMessages(conversationId, lastTime);
    let lt = lastTime;
    const processedMessages: string[] = [];
    for (const message of messages) {
      // filter message which appears after lastTime reading
      if (message.created_at > lastTime) {
        lt = message.created_at;
      }

      // the message text in intercom is enclosed in <p> tag
      const msg = message.body.match("<[p][^>]*>(.+?)</[p]>");

      if (msg !== null) {
        processedMessages.push(msg[1]);
      }
    }
    return { messages: processedMessages, lastTime: lt };
  }

  public async getMessages(
    conversationId: string,
    lastTime: number
  ): Promise<ConversationParts[]> {
    const response = await this.client.get(`conversations/${conversationId}`);

    if (response.status !== 200) {
      throw new Error(
        `Got not ok status while getting messages from '${conversationId}' from intercom api. StatusText: '${response.statusText}'`
      );
    }

    return ((
      response.data as IntercomConversation
    )?.conversation_parts?.conversation_parts).filter(
      (x) => x.created_at > lastTime && x.author.id != this.adminId
    );
  }

  public async getLastTime(
    conversationId: string,
    skipLastMessage: boolean
  ): Promise<number> {
    let lastTime = 0;
    const messages = await this.getMessages(conversationId, lastTime);
    // getting last time when user write message
    for (const message of messages) {
      if (message.created_at > lastTime) {
        lastTime = message.created_at;
      }
    }

    return skipLastMessage ? lastTime : lastTime - 1;
  }

  public async watchConversations(
    // We need callback to start work with conversation
    callback: (conv: IntercomConversation) => Promise<void>,
    // Hook, for end watching conversations
    stopTrigger: () => boolean
  ): Promise<void> {
    // Search over all conversation and find only those which have not replied message
    while (!stopTrigger()) {
      // take first 20 conversation from first page in listing method
      let conversation = await this.getConversation(20, 1);
      // skip all conversation which was been replied by admin
      for (const conv of conversation.conversations.filter(
        (x) =>
          x.statistics.last_contact_reply_at > x.statistics.last_admin_reply_at
      )) {
        // send new potential conversation for working
        callback(conv);
      }
      // now we go over all other conversation and do same action like above
      while (conversation.pages.total_pages >= conversation.pages.page) {
        conversation = await this.getConversation(
          20,
          conversation.pages.page + 1
        );

        for (const conv of conversation.conversations.filter(
          (x) =>
            x.statistics.last_contact_reply_at >
            x.statistics.last_admin_reply_at
        )) {
          callback(conv);
        }
      }
      // timeout in order not to spam requests
      await new Promise((resolve, reject) => setTimeout(resolve, 1000));
    }
  }

  public async getConversation(
    perPage: number,
    page: number
  ): Promise<IntercomListConversation> {
    const response = await this.client.get(`/conversations`, {
      params: {
        order: "desc",
        sort: "waiting_since",
        per_page: perPage,
        page: page,
      },
    });

    if (response.status !== 200) {
      throw new Error(
        `Got not ok status while getting conversation list from intercom api. StatusText: '${response.statusText}'`
      );
    }

    return response.data as IntercomListConversation;
  }

  public async simpleConnectToDashaApp(
    application: dasha.Application<
      Record<string, unknown>,
      Record<string, unknown>
    >
  ): Promise<void> {
    if (this.isSimpleUsed) {
      return;
    }
    this.isSimpleUsed = true;
    const closeTrigger = false;
    const conversations = new Map<string, IntercomConversation>();
    application.connectionProvider = async (conv) => {
      this._logger?.info(`Got new starting conversation with input(${JSON.stringify(conv.input)}).`);

      const dashaChat = await dasha.chat.createChat();
      console.log(JSON.stringify(conversations.get(conv.input.conversationId as string)));
      const currentConv = conversations.get(conv.input.conversationId as string);
      const chat = await this.runChatInConversation(
        currentConv!.id,
        conversations.get(conv.input.conversationId as string)?.open ?? false,
        {
          closeAfter: {
            messageOnClose:
              "Conversation was closed because dialog was finished",
          },
          periodReading: 100,
          startOptions: {
            skipLastMessage: !conversations.get(
              conv.input.conversationId as string
            )?.open,
          },
        }
      );

      chat.run(dashaChat).catch(this._logger?.error);
      return dasha.chat.connect(dashaChat);
    };

    application.queue.on("ready", async (id: string, conv: any) => {
      this._logger?.info(`Got new starting conversation ('${id}').`);

      // Checking that the conversation belongs to this intercom client instance
      if (!conversations.has(id)) {
        this._logger?.info(
          `Try starting conversation from not this instance of intercom client new conversation ('${id}'). ` +
          `Conversation was been rejected`
        );
        return;
      }
      this._logger?.info(`Prepare intercom conversation for chat ('${id}').`);

      this._logger?.info(
        `Connecting to dasha sdk chat protocol for conversation ('${id}').`
      );
      conv.input = {
        conversationId: id,
        continueConversation: conversations.get(id)?.open,
      };

      conv.on("transcription", async (transcription: any) => {
        if (this.onTransctiption) {
          await this.onTransctiption(conversations.get(id)!, transcription);
        }
      });

      conv.on("debugLog", async (x: any) => {
        if (x?.msg?.msgId === "RecognizedSpeechMessage") {
          const logEntry = x?.msg?.results[0]?.facts;
          console.log(JSON.stringify(logEntry, undefined, 2) + "\n");
        }
      });

      this._logger?.info(`Conversation as been accepted ('${id}').`);
      try {
        const result = await conv.execute();
        try {
          this._logger?.info(`Conversation finished ('${id}').`);
          if (this.onCompletedJob) {
            await this.onCompletedJob(conversations.get(id)!, result);
          }
        } finally {
          conversations.delete(id);
        }
      } catch (error) {
        try {
          this._logger?.info(
            `Conversation failed ('${id}').` + `'${JSON.stringify(error)}'`
          );
          if (this.onFailedJob) {
            await this.onFailedJob(conversations.get(id)!, error);
          }
        } finally {
          conversations.delete(id);
        }
      }
    });

    application.queue.on("timeout", async (id: string) => {
      try {
        this._logger?.info(`Conversation was timed out ('${id}').`);
        if (this.onTimedOutJob) {
          await this.onTimedOutJob(conversations.get(id)!);
        }
      } finally {
        conversations.delete(id);
      }
    });
    application.queue.on("rejected", async (id: string, error: any) => {
      try {
        this._logger?.info(`Conversation was rejected ('${id}').`);
        if (this.onRejected) {
          await this.onRejected(conversations.get(id)!);
        }
      } finally {
        conversations.delete(id);
      }
    });

    // Searching for a new conversation loop.
    // Сallback used for adding new conversation into queue in dashaSDK
    await this.watchConversations(
      async (conv) => {
        try {
          // Checking that a conversation is already in progress
          if (conversations.has(conv.id)) {
            return;
          }

          this._logger?.info(`Got new conversation ('${conv.id}')`);
          conversations.set(conv.id, conv);
          const date = Date.now();
          const notBefore = new Date(date);
          const notAfter = new Date(date + 3600 * 1000);
          await application.queue.push(conv.id);
          this._logger?.info(
            `Conversation ('${conv.id}') was enqueued into dasha sdk`
          );
        } catch {
          this._logger?.error(
            `Could not enqueue conversation ('${conv.id}') into dasha sdk`
          );
        }
      },
      () => {
        return closeTrigger;
      }
    );
    this.isSimpleUsed = false;
  }

  public onCompletedConversation(
    callback?: (
      conversation: IntercomConversation,
      result: dasha.ConversationResult<Record<string, unknown>>
    ) => Promise<void>
  ): void {
    this.onCompletedJob = callback;
  }

  public onRejectedConversation(
    callback?: (conversation: IntercomConversation) => Promise<void>
  ): void {
    this.onRejected = callback;
  }

  public onFailedConversation(
    callback?: (conversation: IntercomConversation, error: any) => Promise<void>
  ): void {
    this.onFailedJob = callback;
  }

  public onTimedOutConversation(
    callback?: (conversation: IntercomConversation) => Promise<void>
  ): void {
    this.onTimedOutJob = callback;
  }

  public setLogger(logger: Console): void {
    this._logger = logger;
  }

  public onTranscriptionConversation(
    callback?: (
      conversation: IntercomConversation,
      transctiption: dasha.Transcription
    ) => Promise<void>
  ): void {
    this.onTransctiption = callback;
  }
}
