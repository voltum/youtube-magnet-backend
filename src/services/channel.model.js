import mongoose from "mongoose";

const Schema = mongoose.Schema;

const channelSchema = new Schema(
  {
    _id: String,
    blocked: Boolean,
    title: String,
    url: String,
    description: String,
    email: String,
    emailExists: Boolean,
    country: String,
    language: String,
    defaultLanguage: String,
    subscriberCount: Number,
    socialLinks: String,
    viewCount: Number,
    videoCount: Number,
    lastVideoPublishedAt: Date,
    publishedAt: Date,
    createdAt: Date,
    updatedAt: Date,
    globalNote: String,
    folders: [
      {
        name: String,
        chunkStamp: Number,
        note: {
          type: String,
          required: false,
        },
        blocked: Boolean,
      },
    ],
  },
  { timestamps: true }
);

export const Channel = mongoose.model("Channel", channelSchema);
