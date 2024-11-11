import cors from "cors";
import express from "express";
import "dotenv/config";
import mongoose from "mongoose";
import { channelRouter } from "./services/channels.controller.js";
import Queue from "bull";

const port = process.env.PORT || 3000;
const app = express();

const channelsQueue = new Queue("channels", "redis://127.0.0.1:6379");

mongoose
  .connect(process.env.MONGODB_STRING)
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error.message);
  });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.get("/", (req, res) => res.send("Server is running!"));
app.use('/channels', channelRouter);
app.listen(port, () => {
  console.log(`App listening on port: ${port}`);
});
