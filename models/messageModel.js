import { Schema, model } from "mongoose";

const messageSchema = new Schema({
  from: { type: Schema.Types.ObjectId, ref: 'user', required: true },
  to: { type: Schema.Types.ObjectId, ref: 'user', required: true },
  content: { type: String },
  file: {
    url: { type: String },
    filename: { type: String },
    mimetype: { type: String },
    size: { type: Number }
  },
  createdAt: { type: Date, default: Date.now }
})

const Message = model('message', messageSchema)
export default Message
