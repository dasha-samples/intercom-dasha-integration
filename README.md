
## How Intercom does bots today

Intercom offers chatbot building functionality out of the box with a drag-and-drop, no code interface. These are rather simplistic command-response/multiple choice chat bots.

You might ask “what’s wrong with multiple choices”. They are great for taking the cream off the top. However, if a user’s request does not fit within the bounds of the commands served up by the bot, the user will quickly become frustrated and seek to speak with a human agent. The problem with human agents is that they are often unavailable or take a while to respond. 

Importantly, according to Intercom’s [own research](https://www.intercom.com/blog/the-state-of-chatbots/) only 15% of customers would prefer talking to a bot over a human agent. 

So we got to thinking. What if we can deploy a conversational AI app that can communicate through Intercom and provide a truly human-like experience to the customer? How would customers feel about a thing like that? How would it impact their perception of the brand? 

Also, we just think it’s a cool little project.

## Dasha AI 

[Dasha](https://dasha.ai) conversational AI platform is a suite of developer tools. Using Dasha Studio, SDK and Cloud Platform, any developer can design, build, train and deploy fully human-like, deeply conversational AI applications. DashaScript is a derivative of TypeScript, the SDK is Node.js. No ML or AI experience is required.  It’s a perfect platform to create a human-like chatbot for Intercom. 

## Challenges to overcome 	

Here is what we need to make happen for this thing to start talking to customers: 

Integrate a Dasha AI app with Intercom 
Design and develop the Dasha conversational AI app 
Deploy and test the app

In our journey we will create a simple conversational bot for customer support via Dasha platform. In terms of the conversational app functionality - we will keep it exceedingly simple for the purposes of this tutorial, yet will illustrate all the features of Dasha platform that you can use to create fully human-like conversational applications. 

Before we go any further, let’s make sure that you are equipped with the tools to use Dasha conversational AI. Firstly, you’ll want to head over to our [developer community](https://community.dasha.ai), where you will get instructions on how to get your API key. Secondly, download and install the [Dasha Studio extension](https://marketplace.visualstudio.com/items?itemName=dasha-ai.dashastudio-beta) for Visual Studio Code. Thirdly, you’ll want to install the Dasha CLI ```npm i -g "@dasha.ai/cli"```. For more on our command line interface, read this [post](https://dasha.ai/en-us/blog/dasha-cli). 

You want to clone and open a copy of the source code here. 

## Integration

Our Dasha AI app has to be able to do the following things through Intercom: 

* Be notified of newly-initiated conversations that have yet to be responded to by a human agent 
* Read the content of the customer’s communication.
* Notify the customer that their message(s) have been read.
* Decipher the customer’s intent and select an appropriate response. 
* Respond to the customer in the conversation. 

To integrate, we will look at intercom API and search for a library that can perform the following actions:

* Search conversation by parameters;
* Reply to a specific conversation;
* Create/open/close/reopen conversations;
* Read messages from any given conversation.

Since clients for Dasha SDK are currently written only in JavaScript (TypeScript), we need a JavaScript library for Intercom. Intercom has a Node.js SDK in their API references (https://github.com/intercom/intercom-node). Unfortunately, this library cannot create new conversations.

### Step one. Getting the access token for Intercom

First off we need to get acquainted with the [Intercom API](https://developers.intercom.com/intercom-api-reference).

As we can see, all requests must have an access token. To get your access token, go [here](https://app.intercom.com/) and to settings->developers->developer-hub and click “New app” to create a new application.

![Intercom developer portal](//images.contentful.com/pzhspng2mvip/59cWy3MsdX2FCZvM9qqRhH/acbef4a660af368cb429738e0af8e5f7/Screenshot_at_Jul_22_14-32-08.png)

Once you create your application, head over to App > Configure > Authentication to find your access token. 

Equipped with the access token, we can start sending requests to the Intercom rest API. For our HTTP client we will use Axios. 

### Step two. Apply integration to your code

We are using TypeScript to write our app. Open up main.ts. First, we need to import the intercom integration library. 

```typescript
import { IntercomClient } from "./src/intercomClient";
```

Then, we need to create an instance of a Dasha application and an instance of an intercom client. On the creation of the Intercom client instance we should pass the access token and url for Intercom as arguments of the function.

We are creating both within the function __`main`__. 

```typescript
 const application = await dasha.deploy("./graph", { groupName: "Default" });
 const intercom = await IntercomClient.create("https://api.intercom.io", {
   accessToken: process.env.INTERCOM_APIKEY!,
 });
```

Next, we instruct the Dasha application how and where to execute the conversation and to let us know all is going well: 

```typescript
try {
   application.connectionProvider = async (conv) =>
     dasha.chat.connect(await dasha.chat.createConsoleChat());
   application.setExternal("send_report_on_manager", (args, conv) => {
     console.log({ set_args: args, conversation: conv });
     return "ok";
   });
```

Then we need to connect the Intercom client with the Dasha SDK application:

```typescript
   await intercom.simpleConnectToDashaApp(application);
```

And set a logger to log the actions.
```typescript
 intercom.setLogger(console);
```

## Details of Intercom integration library

### Function for connecting Dasha application to Intercom
We use the “simpleConnectToDashaApp” function in our code. Let’s take a look at its implementation. Go to .src/intercomClient.ts, line 412.

Look at the signature of this method. This method has one argument - an instance of   platform application.

```typescript
public async simpleConnectToDashaApp(
   application: dasha.Application<
     Record<string, unknown>,
     Record<string, unknown>
   >
 ): Promise<void>
```

In the first part of the function below we prepare to interact with the integration:

```typescript
   if (this.isSimpleUsed) {
     return;
   }
   this.isSimpleUsed = true;
   const closeTrigger = false;
   const conversations = new Map<string, IntercomConversation>();
```

In the next part of the function, we set up a callback to become active on certain events in the application.
On the "starting" event, it is necessary to check that the incoming conversation has not been started yet. After this you need to execute the function for connecting intercom and application chats, and accept this job. Let’s check out the implementation of this callback:

```typescript
     const dashaChat = await dasha.chat.createChat();
     const chat = await this.runChatInConversation(
       conversations.get(conv.input.conversationId as string)!.id,
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

```

Third step is to connect the intercom client to Dasha application chat.

```typescript 
     chat.run(dashaChat).catch(this._logger?.error);
     return dasha.chat.connect(dashaChat);
   };

   application.queue.on("ready", async (id, conv) => {
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

```

Fourth step is to reply to Dasha SDK that the conversation can be started.

```typescript
     conv.on("transcription", async (transcription) => {
       if (this.onTransctiption) {
         await this.onTransctiption(conversations.get(id)!, transcription);
       }
     });
     this._logger?.info(`Conversation was been accepted ('${id}').`);
```

The events "failed", "completed", "timeOut" have the same implementation up to the call of the corresponding functions. Look at the implementation for conversation __`result`__ event:

```typescript
       const result = await conv.execute();
       try {
         this._logger?.info(`Conversation finish ('${id}').`);
         if (this.onCompletedJob) {
           await this.onCompletedJob(conversations.get(id)!, result);
         }
       } finally {
         conversations.delete(id);
       }
     }
```

Similarly you will see functionality for rejected, timed out and failed conversations. At line 523 we begin a loop where we search for new conversations. 

```typescript
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
```

See how we change the state of the instance to start a new simple conversation with `   this.isSimpleUsed = false;`.

### The function that lets us search ouyt a new conversation 

We use the “watchConversations” function in our code. Let’s see their implementation. Write simple checking conversations to have a new one or a not replied one.

```typescript
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
```

Now we can work with applications and conversations, but we cannot start conversations.

### Function for start chatting

These methods prepare Intercom for conversation and to start a chat. This function has two logical parts. In part one, we prepare the client for the conversation: 

```typescript
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
```
In next part we use a hook to start the conversation: 

```typescript
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
```

### Implementing a class to chat within a single conversation.

This is the magic class which lets the Dasha conversational AI chat with Intercom. Go to __intercomConversationClient.ts__. 

Let’s take a look at the construction of this class.

```typescript
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
```

This class should have two functions. The first of them needs to run and control the conversation flow:

```typescript
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
```

The next function reads messages from the conversation and sends them to the Dasha application.

```typescript
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
 }
}
```
Quite simple. 

## The Dasha conversational AI app 

On to the fun part. Let’s look at the conversational AI app that will interact with our Intercom customer/user. 

You will need to open the following files: 
* __.graph/main.dsl__ is the DashaScript file which you use to construct the conversational pathway that Dasha is to take. Here you can make your conversation as absolutely complex or simple as you wish. For the purposes of this tutorial we will opt for simple.
* __data.json__ is the file where you store data that is used to train the neural networks to properly understand the customer’s/user’s intent.
* __phrasemap.json__  is where you store all the phrases to be used by Dasha AI in the context of the conversation. (tip: you can list phrases directly in __main.dsl__ by using the __`#sayText()`__ function. Using the phrase map for it is, however, the better way for scalable apps.)

We will be discussing the following concepts in this part of the tutorial: 
* __Node__ is literally just that - a node in the conversation. It’s a point of interaction between the user and the AI. A node must always have another node or digression leading into it.
* __Digression__ is, in essence, a node that does not have to have anything lead into it. A digression can be called up by the user at any point in the conversation. Digressions are used to imitate the way a human might adapt when the person they are talking to suddenly throws them off on a tangent. Read this for a [deeper dive]() on __digressions__.
* __Intent__ refers to the meaning behind the user/customer’s phrases. When you are speaking to someone you figure out the meaning of their words and phrases and sentences based on context, a variety of clues and previous experience. Right now Dasha AI interprets meaning solely from text (we are working on emotional analysis). Intents refer to the . The Dasha Cloud Platform has neural networks dedicated to training for user intents and to analysing said intents in the course of a conversation. [Take a look here]() for more on __intents__. 
* __Named entities__ are fields referring to names, place names, objects, etc. that you need Dasha AI to identify within the customer/user’s responses. __Named entities__ are also processed by neural networks and you provide training data using __data.json__ in a format similar to __intent__ training data. For more on __named entities__ you can read [this piece]() from the leader of the team which constructed the neural networks.

Let’s look at __main.dsl__. We start by importing common functions. In the case of Dasha this means common digressions and ways of responding to them. 

```dsl
import "commonReactions/all.dsl";
```
Then we need to declare some variables for context: 

```dsl
context
{
   input conversationId: string;
   input continueConversation: boolean;
   last_message: string = "";
   can_say: boolean = false;
   output status: string?;
   output serviceStatus: string?;
}

```
We also need to declare an external function. This is a way for a DashaScript app to call out to an external application to send or receive data. In this case the app is __main.ts__ and we are sending the customer’s phrase data which refers to a manager who led to a dissatisfied customer. 

```dsl
external function send_report_on_manager(report: string): unknown;
```

Let’s look at the first node - __`node root`__. 

```dsl
start node root
{
   do
   {
       #connectSafe("");
       if(!$continueConversation)
       {
           #say("greeting", repeatMode: "ignore");
           #say("how_can_i_help_you");
       }
       goto hub;
   }
   transitions
   {
       hub: goto hub;
   }
}
```

Here we connect to the chat instance if check if our conversation should be continued, as per the code we wrote previously in the integration. If we continue the conversation, we greet the customer and ask how they can be helped. 

It is expected that in most cases the customer will state the problem with which they are calling. 

Here is where __digressions__ come in. Let’s say the customer says “I have a problem with my phone.” If you look at the __intents.json__, you will find a __`"problem_with_phone"`__ intent on line 98:

```json
    "problem_with_phone": {
        "includes": [
          "I can't seem to make a phone call",
          "I have a problem with my phone",
          "I'm afraid I broke my phone",
          "Phone problem"
            ],
```

If you scroll down to line 144 in __main.dsl__, you will see this digression: 

```dsl
digression problem_dig
{
   conditions
   {
       on #messageHasAnyIntent(["problem_with_phone", "problem_with_manager", "have_problem"]);
   }
   do
   {
       digression disable problem_dig;
       goto problem;
   }
   transitions
   {
       problem: goto problem;
   }
}
``` 

The digression comes into play when any of the intents __`"problem_with_phone", "problem_with_manager", "have_problem"`__ are identified. If they are identified, the conversation goes to __`node problem`__. 

There are a variety of exciting funcitons of DashaScript that you should learn about if you want to develop further on it. The best place to go is our [documentation](https://docs.dasha.ai). You can also make your way through a detailed tutorial, such as [this one](https://dasha.ai/en-us/blog/customer-feedback-survey). 

## Launching and testing the Intercom conversation

Now that you’ve got the integration built out and the app is developed as well, let’s launch a test convo. 

To do this, type __`npm i`__ in the terminal and then __’npm run build`__ and  __’npm run start`__. The app should now be deployed. 

Now, head over to the Intercom [Developer Hub](https://app.intercom.com/a/apps/opk5tlz2/developer-hub). You will want to [launch a test conversation](https://app.intercom.com/a/apps/opk5tlz2/test-conversation). 

Now, just send a message from the chat interface. Give it a few minutes and you will get a reply from Dasha AI. In this way you can test any conversation that your users can have with Dasha AI. 

Was this tutorial helpful? Let us know in our [developer community](http://community.dasha.ai).


 
