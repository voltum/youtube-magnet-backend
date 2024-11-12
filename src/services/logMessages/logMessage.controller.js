import express from "express";
import bodyParser from "body-parser";
import * as logMessagesService from "./logMessage.service.js";

const router = express.Router();

router.use(bodyParser.json());

router.get("/", async (req, res) => {
  const { folder } = req.query;
  console.log(`Folder: ${folder?.toLowerCase()}`, "LogMessagesController");
  try {
    const logMessages = await logMessagesService.getAll(folder?.toLowerCase());
    res.status(200).json(logMessages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req, res) => {
  const logMessage = req.body;
  try {
    const newLogMessage = await logMessagesService.create(
      logMessage,
      Date.now()
    );
    res.status(201).json(newLogMessage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const deletedLogMessage = await logMessagesService.remove(id);
    res.status(200).json(deletedLogMessage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export { router as logRouter };
