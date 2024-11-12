import mongoose from "mongoose";

const Schema = mongoose.Schema;

const folderSchema = new Schema(
  {
    name: { type: String, required: true },
    code: { type: String },
    parent: { type: String },
    category: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true } // Automatically adds createdAt and updatedAt fields
);

export const Folder = mongoose.model("Folder", folderSchema);
