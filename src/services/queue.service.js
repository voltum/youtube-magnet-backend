import Bull from "bull";
import { Channel } from "./channel/channel.model.js";

const channelsQueue = new Bull("channels");

export const createQueueJob = async (channel, chunkStampParam) => {
  console.log("Post single request");
  const { url, folder, chunkStamp } = channel;

  return await channelsQueue.add({
    id: url,
    url: url,
    folder: folder.toLowerCase(),
    chunkStamp: chunkStamp || chunkStampParam,
  });
};

export const getQueueStats = async () => {
  console.log("Get jobs stat");
  return channelsQueue.getJobCounts();
};

export const sendQueue = async (data, folder, options) => {
  console.log(`Sending a job...`);
  console.log(`Length of data ${data.length}`);

  const chunkStamp = Date.now();

  return channelsQueue.addBulk(
    data.map((row) => ({
      data: {
        id: row[0],
        url: row[0],
        folder,
        chunkStamp,
        options: {
          onlyEmail: options.onlyEmail ? { email: row[1].trim() } : null,
          shouldBlock: options.shouldBlock,
          remake: options.remake,
        },
      },
    }))
  );
};

