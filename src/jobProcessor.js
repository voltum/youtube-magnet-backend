import puppeteer from "puppeteer";
import {
  DetermineChannelID,
  GetMainInfo,
  YTCheckEmailCaptcha,
} from "./utils/helpers.js";
import LanguageDetect from "languagedetect";
import { update } from "./services/channel/channel.service.js";
import { emitJobEvent } from "./socketEvents.js";
import { create as createLog } from "./services/logMessages/logMessage.service.js";

export const queueProcessor = (channelsQueue, browser) => async (job, done) => {
  console.time("processTimer");
  const browserContext = await browser.createBrowserContext();

  const {
    id,
    url,
    folder,
    chunkStamp,
    skipMedia = true,
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

    const channelResult = {
      id: ID,
      emailExists,
      folders: [{ name: folder, chunkStamp }],
      language,
      ...mainInfo,
    };
    console.log(channelResult);
    console.timeEnd("processTimer");
    done(null, channelResult);
    return channelResult;
  } catch (err) {
    console.error("finished with error", err);
    console.timeEnd("processTimer");
    done(err);
    return err;
  } finally {
    await browserContext.close();
  }
};

export const channelsOnActive = (channelsQueue, io) =>
  async function (job) {
    const remainedCount = await channelsQueue.getWaitingCount();
    emitJobEvent(io, "events:active", { job, remainedCount });

    console.log("QueueProcessor", `Processing job ${job.data.id}...`);
  };

export const channelsOnProgress = (channelsQueue, io) =>
  async function (job, progress) {
    const remainedCount = await channelsQueue.getWaitingCount();
    emitJobEvent(io, "events:progress", {
      id: job.data.id,
      progress,
      remainedCount,
    });
  };

export const channelsOnCompleted = (io) =>
  async function (job, result) {
    emitJobEvent(io, "events:completed", { job: result });
    console.log("Job completed " + JSON.stringify(job.id), "ChannelsConsumer");

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
  };

export const channelsOnDrained = (io) =>
  async function () {
    emitJobEvent(io, "events:empty");
    console.log("Queue empty", "ChannelsConsumer");
  };

export const channelsOnFailed = (io) =>
  async function (job, error) {
    emitJobEvent(io, "events:error", `'${job.data.id}': ${error}`);
    emitJobEvent(io, "events:inactive", { id: job.data.id });
    emitJobEvent(io, {
      url: job.data.id,
      text: String(error),
      folder: job.data.folder,
      status: String(error),
    });
    await createLog({
      url: job.data.id,
      text: String(error),
      folder: job.data.folder,
      status: String(error),
    });
    console.error(error, "ChannelsConsumer");
  };

export const channelsOnStalled = (io) =>
  function (job) {
    emitJobEvent(io, "events:error", `Process ${job.data.id} stalled!`);
    console.error(`Process ${job.data.id} stalled!`);
  };
