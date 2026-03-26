import { Schema, model } from "mongoose";

const messageSchema = new Schema({
  from: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  // workspace scoping: which workspace this DM belongs to
  workspace: { type: Schema.Types.ObjectId, ref: 'Workspace' },
  content: { type: String },
  edited: { type: Boolean, default: false },
  file: {
    url: { type: String },
    filename: { type: String },
    mimetype: { type: String },
    size: { type: Number }
  }
}, { timestamps: true })

// Indexes for fast DM queries
messageSchema.index({ workspace: 1, from: 1, to: 1, createdAt: 1 })
messageSchema.index({ workspace: 1, to: 1, from: 1, createdAt: 1 })

const Message = model('message', messageSchema)
export default Message
