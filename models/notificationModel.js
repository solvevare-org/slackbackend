import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
  type: { type: String, enum: ['private', 'group', 'system'], required: true },
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  fromName: { type: String },
  fromAvatar: { type: String },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  groupName: { type: String },
  groupPicture: { type: String },
  title: { type: String, required: true },
  message: { type: String },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Notification', notificationSchema);
