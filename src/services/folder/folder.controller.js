import express from "express";
import bodyParser from "body-parser";
import * as foldersService from "../folder/folder.service.js";
import * as channelsService from "../channel/channel.service.js";

const router = express.Router();

router.use(bodyParser.json());

router.get("/", async (req, res) => {
  try {
    const isRoot = req.query.root === "true";
    if (isRoot) {
      const folders = await foldersService.getAllRoot();
      res.status(200).json(folders);
    } else {
      const folders = await foldersService.getAll();
      res.status(200).json(folders);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const folder = await foldersService.getById(req.params.id);
    res.status(200).json(folder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const folder = await foldersService.create(req.body);
    res.status(201).json(folder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/remake/:id", async (req, res) => {
  try {
    const folderID = req.params.id;
    const result = await channelsService.remakeFolder(folderID);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const folder = await foldersService.remove(req.params.id);
    res.status(200).json(folder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/", async (req, res) => {
  try {
    const folder = await foldersService.update(req.body._id, req.body);
    res.status(200).json(folder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export { router as foldersRouter };
