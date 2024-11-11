import Queue from "bull";
import { WebSocket, WebSocketServer } from "ws";
import puppeteer from "puppeteer";
import {
  DetermineChannelID,
  GetMainInfo,
  YTCheckEmailCaptcha,
} from "./utils/helpers.js";
import LanguageDetect from "languagedetect";
import { configDotenv } from "dotenv";
import { Channel } from "./services/channel.model.js";
import { update } from "./services/channel.service.js";
import mongoose from "mongoose";
const channelsQueue = new Queue("channels", "redis://127.0.0.1:6379");
const wss = new WebSocketServer({ port: 8080 });

configDotenv();
mongoose
  .connect(process.env.MONGODB_STRING)
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error.message);
  });

channelsQueue.process(async (job, done) => {
console.time('processTimer');
  console.log("Starting browser...");
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      // `--user-data-dir=${configuration().getUserDataDir()}`,
    ],
  });
  const browserContext = await browser.createBrowserContext();

  const {
    id,
    url,
    folder,
    chunkStamp,
    skipMedia = false,
    options = {},
  } = job.data;

  try {
    if (folder === "/") throw "Channel cannot be inserted in root folder";

    let progress = 0;

    console.log(channelsQueue.client.status, "Processor Queue Status");

    if (channelsQueue.client.status !== "ready") channelsQueue.client.connect();

    console.log(
      `Should update: ${options.onlyEmail?.email ? true : false}`,
      "Job"
    );
    console.log(`URL: ${url.trim()}`, "Job");

    // 1 step: determine channel ID
    const ID = await DetermineChannelID(browserContext, url.trim(), folder);
    progress = 15;
    await job.progress(progress);

    // 2 step: check if there is a channel in database already
    //   const foundOne = await channelsService.getById(ID);

    //   const isSameRootFolder =
    //     foundOne &&
    //     foundOne.folders.some(
    //       (foundFolder) => rootOfCurrent === getRootFolderName(foundFolder.name)
    //     );
    //   const isBlocked =
    //     foundOne &&
    //     foundOne.folders.some(
    //       (folder) =>
    //         rootOfCurrent === getRootFolderName(folder.name) &&
    //         folder.blocked === true
    //     );

    //   // Throw exception immediately if it is blocked
    //   if (isBlocked)
    //     throw `Channel is blocked in current category ${rootOfCurrent}`;

    progress = 35;

    await job.progress(progress);

    //   // Exceptional case for updating email or blocking
    //   if (foundOne && options.onlyEmail?.email) {
    //     progress = 50;
    //     await job.progress(progress);
    //     const updatedChannel = await channelModel.findByIdAndUpdate(
    //       ID,
    //       { email: options.onlyEmail.email || foundOne.email },
    //       { new: true }
    //     );
    //     return updatedChannel;
    //   } else if (foundOne && options.shouldBlock) {
    //     progress = 70;
    //     await job.progress(progress);
    //     const updatedChannel = await channelModel.findByIdAndUpdate(
    //       ID,
    //       { "folders.$[element].blocked": true },
    //       { arrayFilters: [{ "element.name": folder }] }
    //     );
    //     return updatedChannel;
    //   }

    // If there is the same channel in the same root category
    //   if (isSameRootFolder) {
    //     if (!options.remake) {
    //       throw `Channel already exists in the same category ${rootOfCurrent}`;
    //     }
    //   }

    // 3 step: check if email catcha exists
    const emailExists = await YTCheckEmailCaptcha(browserContext, ID);
    progress = 45;
    await job.progress(progress);
    console.log("browser context", browserContext);
    // 4 step: get main info about channel
    const mainInfo = await GetMainInfo(ID, { skipMedia, browserContext });
    progress = 80;
    await job.progress(progress);

    // 5 step: detect channel language
    let language = null;
    const langDetector = new LanguageDetect();
    try {
      const probableLanguages = mainInfo.description
        ? await langDetector.detect(mainInfo.description)
        : null;
      language = probableLanguages[0]?.[0] ? probableLanguages[0]?.[0] : "";
    } catch {
      // Ignore
    }

    progress = 100;
    await job.progress(progress);

    console.log(`Job ${id} is done!`, "QueueProcessor");

    await browserContext.close();

    const channelResult = {
      id: ID,
      emailExists,
      folders: [{ name: folder, chunkStamp }],
      language,
      ...mainInfo,
    };
    console.log(channelResult);
    await browser.close();
    console.timeEnd("processTimer");
    done(null, channelResult);
    return channelResult;
  } catch (err) {
    console.error("finished with error", err);
    await browser.close();
    console.timeEnd("processTimer");
    done(err);
    return err;
  }
});

wss.on("connection", function connection(ws) {
  ws.on("error", console.error);

  ws.on("message", function message(data) {
    console.log("received: %s", data);
  });
  
  ws.on('events:active', function message(data) {
    ws.send(data);
  })

  ws.send("something");
});

function broadcastEvent(event, payload) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ event, payload }));
    }
  });
}

channelsQueue.on("active", async function (job) {
    const remainedCount = await channelsQueue.getWaitingCount();
    broadcastEvent("events:active", { job, remainedCount });
    
    console.log("QueueProcessor", `Processing job ${job.data.id}...`);
});

channelsQueue.on("progress", async function (job, progress) {
    const remainedCount = await channelsQueue.getWaitingCount();
    broadcastEvent("events:progress", {
        id: job.data.id,
        progress,
        remainedCount,
    });
});

channelsQueue.on('completed', async function (job, result) {
    broadcastEvent("events:completed", { job: result });
    console.log(
        "Job completed " + JSON.stringify(job.id),
        "ChannelsConsumer"
    );
    
    console.log(`Job completed. Updating database`);
    const { id } = result;
    try {
        const updatedChannel = await update(
          id,
          { $set: result },
          { upsert: true }
        );
        console.log(`Channel updated`, updatedChannel);
    } catch (error) {
        console.error(`Error updating channel: ${error.message}`);
    }
})


channelsQueue.on("drained", async function () {
    broadcastEvent("events:empty");
    console.log("Queue empty", "ChannelsConsumer");
});

channelsQueue.on('failed', function (job, error) {
    broadcastEvent('events:error', `'${job.data.id}': ${error}`);
    broadcastEvent('events:inactive', { id: job.data.id });
    broadcastEvent({
      url: job.data.id,
      text: String(error),
      folder: job.data.folder,
      status: String(error),
    });
    console.error(error, 'ChannelsConsumer');
})

channelsQueue.on('stalled', function (job) {
    broadcastEvent('events:error', `Process ${job.data.id} stalled!`);
    console.error(`Process ${job.data.id} stalled!`);
})