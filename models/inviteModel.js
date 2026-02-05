import { Schema, model } from "mongoose";

const inviteSchema = new Schema({
  email: { type: String, required: true, lowercase: true },
  role: { type: String, required: true },
  token: { type: String, required: true, unique: true },
  used: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true }
});

const Invite = model("invite", inviteSchema);
export default Invite;
