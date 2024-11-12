import express from "express";
import bodyParser from "body-parser";
import multer from "multer";
import fs from "fs";
import * as channelService from "./channel.service.js";
import * as queueService from "../queue.service.js";
import { CSVToArray } from "../../utils/helpers.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.use(bodyParser.json());

router.get("/stats", async (req, res) => {
  try {
    const stats = await queueService.getQueueStats();
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/export", async (req, res) => {
  try {
    const { folder, blacklist } = req.query;
    await channelService.exportData(folder?.toLowerCase(), blacklist, res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const { folder, blacklist, filter } = req.query;
    console.log(`Folder: ${folder?.toLowerCase()}`);
    const channels = await channelService.getAll(
      folder?.toLowerCase(),
      blacklist,
      filter
    );
    res.status(200).json(channels);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const channel = await channelService.getById(req.params.id);
    res.status(200).json(channel);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const channel = await queueService.createQueueJob(req.body, Date.now());
    res.status(201).json(channel);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { from } = req.query;
    const channel = await channelService.remove(id, from);
    res.status(200).json(channel);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/", async (req, res) => {
  try {
    const { id } = req.query;
    const { update, options } = req.body;
    const updatedChannel = await channelService.update(id, update, options);
    res.status(200).json(updatedChannel);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/upload", upload.single("file"), (req, res) => {
  const { folder, shouldUpdate, shouldBlock, delimeter } = req.query;
  if (!folder) return res.status(400).json({ error: "No folder specified" });

  console.log("Uploading");

  fs.readFile(req.file.path, "utf-8", async (error, data) => {
    if (error) return res.status(500).json({ error: error.message });

    console.log("Should block: " + shouldBlock + " " + typeof shouldBlock);
    try {
      const jobs = await queueService.sendQueue(
        CSVToArray(data.trim(), delimeter || ";"),
        folder.toLowerCase(),
        { onlyEmail: shouldUpdate, shouldBlock: shouldBlock === "true" }
      );
      res.status(200).json(jobs);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  fs.unlink(req.file.path, (err) => {
    if (err) {
      console.error(err);
      throw new Error("Failed to delete file");
    }
  });
});

export { router as channelRouter };
