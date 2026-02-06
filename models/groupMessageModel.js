import { Schema, model } from 'mongoose'

const groupMessageSchema = new Schema({
  from: { type: Schema.Types.ObjectId, ref: 'user', required: true },
  group: { type: Schema.Types.ObjectId, ref: 'group', required: true },
  content: { type: String },
  file: {
    url: String,
    filename: String,
    mimetype: String,
    size: Number
  },
  createdAt: { type: Date, default: Date.now }
})

const GroupMessage = model('groupmessage', groupMessageSchema)
export default GroupMessage
