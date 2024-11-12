import * as ChannelService from "../channel/channel.service.js";
import { Folder } from "./folder.model.js";

export const getAll = async () => {
  console.info("GET: list of folders", "FoldersService");
  return Folder.find().exec();
};

export const getAllRoot = async () => {
  return Folder.find({ parent: /^\/$/ }).exec();
};

export const getById = async (id) => {
  return Folder.findById(id);
};

export const create = async (folder) => {
  const existingFolder = await Folder.findOne({
    category: folder.category,
  }).exec();
  if (!existingFolder) {
    const newFolder = new Folder(folder);
    return newFolder.save();
  }
};

export const remove = async (id) => {
  const folder = await getById(id);
  const allFromFolder = await ChannelService.getAll(folder.category);
  await ChannelService.removeMany(
    allFromFolder.map((channel) => channel._id),
    folder.category
  );
  return Folder.findByIdAndDelete(id);
};

export const update = async (id, folder) => {
  console.info("Folder info sent to database", "FoldersService");
  return Folder.findByIdAndUpdate(id, folder, { new: true });
};
