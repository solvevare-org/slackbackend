import { Schema, model } from 'mongoose'

const groupMessageSchema = new Schema({
  from: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  group: { type: Schema.Types.ObjectId, ref: 'group', required: true },
  content: { type: String },
  edited: { type: Boolean, default: false },
  file: {
    url: String,
    filename: String,
    mimetype: String,
    size: Number
  },
  createdAt: { type: Date, default: Date.now }
})

// Index for fast group message queries
groupMessageSchema.index({ group: 1, createdAt: 1 })

const GroupMessage = model('groupmessage', groupMessageSchema)
export default GroupMessage
