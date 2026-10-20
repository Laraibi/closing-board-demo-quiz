import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["learner", "trainer", "admin"], default: "learner" },
  // Modules suivis (apprenant) ou enseignés (formateur).
  modules: { type: [String], default: [] },
  // Préférences du résumé quotidien (formateur) : heure et modules suivis.
  digest: {
    enabled: { type: Boolean, default: true },
    hour: { type: Number, min: 0, max: 23, default: 18 },
    modules: { type: [String], default: [] }
  }
}, { timestamps: true });

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  choices: { type: [String], validate: (value) => value.length >= 2 },
  answer: { type: Number, required: true, select: false }
});

const quizSchema = new mongoose.Schema({
  title: { type: String, required: true, minlength: 3, trim: true },
  module: { type: String, required: true, index: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  questions: { type: [questionSchema], validate: (value) => value.length >= 1 }
}, { timestamps: true });

const attemptSchema = new mongoose.Schema({
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  answers: { type: Map, of: Number, default: {} },
  score: { type: Number, min: 0, max: 100, required: true }
}, { timestamps: true });

const feedbackSchema = new mongoose.Schema({
  attempt: { type: mongoose.Schema.Types.ObjectId, ref: "Attempt", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, required: true, minlength: 5 }
}, { timestamps: true });

const settingSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  emailsEnabled: { type: Boolean, default: true },
  digestCron: { type: String, default: "0 18 * * *" }
});

export const User = mongoose.model("User", userSchema);
export const Quiz = mongoose.model("Quiz", quizSchema);
export const Attempt = mongoose.model("Attempt", attemptSchema);
export const Feedback = mongoose.model("Feedback", feedbackSchema);
export const Setting = mongoose.model("Setting", settingSchema);

export async function settings() {
  return Setting.findOneAndUpdate({ key: "global" }, { $setOnInsert: { key: "global" } }, { upsert: true, new: true });
}
