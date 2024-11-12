import cors from "cors";
import express from "express";
import http from "http";
import "dotenv/config";
import mongoose from "mongoose";
import { channelRouter } from "./services/channel/channels.controller.js";
import Queue from "bull";
import { foldersRouter } from "./services/folder/folder.controller.js";
import { logRouter } from "./services/logMessages/logMessage.controller.js";
import {
  channelsOnActive,
  channelsOnCompleted,
  channelsOnDrained,
  channelsOnFailed,
  channelsOnProgress,
  channelsOnStalled,
  queueProcessor,
} from "./jobProcessor.js";
import { Server } from "socket.io";
import { setupSocketEvents } from "./socketEvents.js";
import puppeteer from "puppeteer";

const port = process.env.PORT || 3001;
const redis_address = process.env.REDIS_ADDRESS || "127.0.0.1:6379";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

setupSocketEvents(io);

const channelsQueue = new Queue("channels", "redis://" + redis_address);

mongoose
  .connect(process.env.MONGODB_STRING)
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error.message);
  });

const browser = await puppeteer.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    // `--user-data-dir=${configuration().getUserDataDir()}`,
  ],
});

console.log("Starting browser...");

const browserContext = await browser.createBrowserContext();

channelsQueue.process(queueProcessor(channelsQueue, browser, browserContext));
channelsQueue.on("active", channelsOnActive(channelsQueue, io));
channelsQueue.on("progress", channelsOnProgress(channelsQueue, io));
channelsQueue.on("completed", channelsOnCompleted(io));
channelsQueue.on("drained", channelsOnDrained(io));
channelsQueue.on("failed", channelsOnFailed(io));
channelsQueue.on("stalled", channelsOnStalled(io));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.get("/", (req, res) => res.send("Server is running!"));
app.use("/channels", channelRouter);
app.use("/folders", foldersRouter);
app.use("/log", logRouter);
server.listen(port, () => {
  console.log("redis:", redis_address);
  console.log(`App listening on port: ${port}`);
});
