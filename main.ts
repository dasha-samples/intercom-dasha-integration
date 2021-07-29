import { IntercomClient } from "./src/intercomClient";
import * as dasha from "@dasha.ai/sdk";

async function main() 
{
  const application = await dasha.deploy("./graph", { groupName: "Default" });
  const intercom = await IntercomClient.create("https://api.intercom.io", 
  {
    accessToken: process.env.INTERCOM_APIKEY!,
  });

  try {
    application.connectionProvider = async (conv) =>
      dasha.chat.connect(await dasha.chat.createConsoleChat());
    application.setExternal("send_report_on_manager", (args, conv) => {
      console.log({ set_args: args, conversation: conv });
      return "ok";
    });

    await application.start({ concurrency: 10 });
    intercom.setLogger(console);

    await intercom.simpleConnectToDashaApp(application);
  } catch (e) 
  {
    console.error(e);
  } finally 
  {
    console.log("Fuck. Something is wrong.");
    application.dispose();
  }
}

main();
