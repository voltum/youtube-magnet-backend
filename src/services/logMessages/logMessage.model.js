import mongoose from "mongoose";

const Schema = mongoose.Schema;

const logMessageSchema = new Schema(
  {
    url: { type: String },
    text: { type: String },
    folder: { type: String },
    status: { type: String },
    chunkStamp: { type: Number },
  },
  { timestamps: true } // Automatically adds createdAt and updatedAt fields
);

export const LogMessage = mongoose.model("LogMessage", logMessageSchema);
