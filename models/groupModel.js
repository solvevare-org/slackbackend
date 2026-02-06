import { Schema, model } from 'mongoose'

const groupSchema = new Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['group', 'community'], default: 'group' },
  members: [{ type: Schema.Types.ObjectId, ref: 'user' }],
  admins: [{ type: Schema.Types.ObjectId, ref: 'user' }],
  image: { url: String, filename: String },
  onlyAdminCanPost: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
})

const Group = model('group', groupSchema)
export default Group
