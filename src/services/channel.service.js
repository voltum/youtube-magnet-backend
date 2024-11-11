// channel.service.js

import { Parser } from "json2csv";
import { Channel } from "./channel.model.js";
import fs from "fs";

export const getAll = async (folder, blacklist, filterOptions) => {
  if (folder) {
    if (blacklist === "true") {
      return Channel.find({
        folders: { $elemMatch: { name: folder, blocked: true } },
      })
        .sort({ lastVideoPublishedAt: "desc" })
        .exec();
    } else {
      return Channel.find(
        {
          folders: {
            $elemMatch: { name: folder, blocked: { $in: [null, false] } },
          },
        },
        { description: 0 }
      )
        .sort({ lastVideoPublishedAt: "desc" })
        .exec();
    }
  } else {
    console.log(`Global search: ${filterOptions}`);
    return Channel.find(JSON.parse(filterOptions), { description: 0 })
      .sort({ lastVideoPublishedAt: "desc" })
      .exec();
  }
};

export const getById = async (id) => {
  return await Channel.findById(id);
};

export const save = async (channel) => {
  return channel.save();
};

export const remove = async (id, folder) => {
  console.log(`Deleting ${id} from ${folder}...`);

  const foundChannel = await getById(id);
  console.log(`Channel exists at: ${foundChannel.folders.toString()}`);

  if (foundChannel.folders.length > 1 && folder) {
    console.log(`Updating channel's folders array`);
    return Channel.findByIdAndUpdate(id, {
      $pull: { folders: { name: folder } },
    });
  } else {
    console.log(`Deleting channel completely`);
    return Channel.findByIdAndRemove(id);
  }
};

export const removeMany = async (ids, from) => {
  console.log(`Delete multiple channels ${ids.toString()}`);
  return await Promise.all(
    ids.map(async (id) => {
      console.log(`Deleting ${id}...`);
      return await remove(id, from);
    })
  );
};

export const update = async (id, channelUpdateQuery, options) => {
  console.log("Channel info sent to database");
  return Channel.findByIdAndUpdate({ _id: id }, channelUpdateQuery, {
    ...options,
    new: true,
  });
};

export const exportData = async (folder, blacklist, res) => {
  if (!folder) return "No folder specified";

  const allRaw = await getAll(folder, blacklist);

  var fields = [
    "title",
    "url",
    "email",
    "emailExists",
    "language",
    "country",
    "viewCount",
    "videoCount",
    "subscriberCount",
    "lastVideoPublishedAt",
    "publishedAt",
    "globalNote",
  ];

  const filename = `export${folder.replace(/\//g, "-")}-${new Date()
    .toJSON()
    .slice(0, 10)}.csv`;

  try {
    const csv = new Parser({ fields }).parse(allRaw);

    fs.writeFile(filename, "sep=,\n" + csv, function (err) {
      if (err) throw err;
      console.log("File has been saved");
      setTimeout(() => {
        fs.unlink(filename, function (err) {
          // delete this file after timeout
          if (err) {
            console.error(err);
          }
          console.log("File has been Deleted");
        });
      }, 10000);
      res.download(filename);
    });
  } catch (err) {
    console.error(err);
  }

  console.log(`Download folder ${folder}`);
};
