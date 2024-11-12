import { LogMessage } from "./logMessage.model.js";

export const getAll = async (folder) => {
  if (folder) {
    return LogMessage.find({ folder })
      .sort({ createdAt: "desc" })
      .limit(200)
      .exec();
  } else {
    return LogMessage.find().sort({ createdAt: "desc" }).limit(200).exec();
  }
};

export const create = async (logMessage, chunkStampParam = Date.now()) => {
  console.log("Post single request", "LogMessagesService");
  const newLogMessage = new LogMessage({
    ...logMessage,
    chunkStamp: chunkStampParam,
  });
  return save(newLogMessage);
};

export const save = async (logMessage) => {
  return logMessage.save();
};

export const remove = async (id) => {
  return LogMessage.findByIdAndDelete(id);
};

export const removeMany = async (ids) => {
  console.log("Delete multiple log messages", "LogMessagesService");
  return LogMessage.deleteMany({ _id: { $in: ids } });
};
