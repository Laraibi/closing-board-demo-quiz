// Données de démonstration, entièrement fictives. Mot de passe commun : demo1234.
import mongoose from "mongoose";
import { Attempt, Feedback, Quiz, User } from "../src/models/index.js";
import { hashPassword } from "../src/lib/auth.js";

export async function seed() {
  await Promise.all([User.deleteMany({}), Quiz.deleteMany({}), Attempt.deleteMany({}), Feedback.deleteMany({})]);
  const passwordHash = hashPassword("demo1234");
  const [, , trainer] = await User.create([
    { name: "Ada Démo", email: "ada@example.com", passwordHash, role: "learner", modules: ["backend"] },
    { name: "Bob Démo", email: "bob@example.com", passwordHash, role: "learner", modules: ["backend"] },
    { name: "Formatrice Démo", email: "formatrice@example.com", passwordHash, role: "trainer", modules: ["backend"] },
    { name: "Admin Démo", email: "admin@example.com", passwordHash, role: "admin" }
  ]);
  await Quiz.create({
    title: "Bases HTTP",
    module: "backend",
    author: trainer._id,
    questions: [
      { text: "Code d'une création réussie ?", choices: ["200", "201", "204"], answer: 1 },
      { text: "Verbe idempotent ?", choices: ["POST", "PUT"], answer: 1 }
    ]
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/lms-demo");
  await seed();
  console.log("Données de démo créées.");
  await mongoose.disconnect();
}
