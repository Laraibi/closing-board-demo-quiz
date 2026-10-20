import mongoose from "mongoose";
import { createApp } from "./app.js";
import { scheduleDigest } from "./jobs/digest.js";

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lms-demo";
await mongoose.connect(uri);
const port = Number(process.env.PORT || 3000);
createApp().listen(port, () => console.log(`API démo sur http://localhost:${port}`));
scheduleDigest();
