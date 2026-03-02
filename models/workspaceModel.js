import mongoose from 'mongoose';

const workspaceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String
  },
  image: {
    type: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  channels: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'group'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Workspace = mongoose.model('Workspace', workspaceSchema);
export default Workspace;