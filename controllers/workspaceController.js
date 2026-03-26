import Workspace from '../models/workspaceModel.js';
import Group from '../models/groupModel.js';
import Message from '../models/messageModel.js';

// Create a new workspace
export const createWorkspace = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
    const createdBy = req.user?.id || req.user?._id;
    if (!createdBy) return res.status(401).json({ success: false, message: 'Unauthorized' });
    
    const workspaceData = { name, description, createdBy, members: [createdBy] };
    if (req.file) {
      workspaceData.image = `/uploads/${req.file.filename}`;
    }
    
    const workspace = await Workspace.create(workspaceData);
    
    try {
      const io = req.app.get('io');
      const onlineUsers = req.app.get('onlineUsers');
      const socketId = onlineUsers && onlineUsers.get(String(createdBy));
      if (io && socketId) {
        io.to(socketId).emit('workspace-updated', { workspace });
      }
    } catch (e) {}

    res.status(201).json({ success: true, workspace });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get all workspaces
export const getWorkspaces = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    // return workspaces the user created or is a member of
    const workspaces = await Workspace.find({ $or: [{ createdBy: userId }, { members: userId }] }).populate('createdBy', 'name email Role');
    res.status(200).json({ success: true, workspaces });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getWorkspace = async (req, res) => {
  try {
    const id = req.params.id
    if (!id) return res.status(400).json({ success: false, message: 'Missing id' })
    const userId = req.user?.id || req.user?._id
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' })
    
    // Run both queries in parallel
    const [ws, userChannels] = await Promise.all([
      Workspace.findById(id).populate('members', 'name email Role avatar').lean(),
      Group.find({ workspace: id, members: userId }).select('name members admins createdAt workspace image').lean()
    ])
    
    if (!ws) return res.status(404).json({ success: false, message: 'Not found' })
    const isMember = String(ws.createdBy) === String(userId) || (Array.isArray(ws.members) && ws.members.map((m) => String(m._id || m)).includes(String(userId)))
    if (!isMember) return res.status(403).json({ success: false, message: 'Forbidden' })
    
    ws.channels = userChannels
    res.json({ success: true, workspace: ws })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
}

// Delete workspace (admin only)
export const deleteWorkspace = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, msg: 'Missing id' });
    
    const userId = req.user?.id || req.user?._id;
    const userRole = (req.user?.Role || req.user?.role || '').toString().toLowerCase();
    
    if (!userId) return res.status(401).json({ success: false, msg: 'Unauthorized' });
    if (userRole !== 'admin') return res.status(403).json({ success: false, msg: 'Only admins can delete workspaces' });
    
    const ws = await Workspace.findById(id);
    if (!ws) return res.status(404).json({ success: false, msg: 'Workspace not found' });
    
    // Delete all channels in this workspace
    const channels = await Group.find({ workspace: id });
    for (const channel of channels) {
      // Delete all messages in each channel
      await Message.deleteMany({ group: channel._id });
    }
    await Group.deleteMany({ workspace: id });
    
    // Delete the workspace
    await Workspace.findByIdAndDelete(id);
    
    // Emit real-time update to all workspace members
    try {
      const io = req.app.get('io');
      const onlineUsers = req.app.get('onlineUsers');
      if (io && ws.members) {
        ws.members.forEach(memberId => {
          const socketId = onlineUsers && onlineUsers.get(String(memberId));
          if (socketId) {
            io.to(socketId).emit('workspace-deleted', { workspaceId: id });
          }
        });
      }
    } catch (e) {}
    
    res.json({ success: true, msg: 'Workspace deleted successfully' });
  } catch (err) {
    console.error('deleteWorkspace', err);
    res.status(500).json({ success: false, msg: 'Server error' });
  }
};

// Remove member from workspace (and all its channels)
export const removeWorkspaceMember = async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const userId = req.params.userId;
    
    if (!workspaceId || !userId) {
      return res.status(400).json({ success: false, msg: 'Missing parameters' });
    }
    
    const userRole = (req.user?.Role || req.user?.role || '').toString().toLowerCase();
    if (userRole !== 'admin') {
      return res.status(403).json({ success: false, msg: 'Only admins can remove members' });
    }
    
    const ws = await Workspace.findById(workspaceId);
    if (!ws) {
      return res.status(404).json({ success: false, msg: 'Workspace not found' });
    }
    
    // Remove user from workspace members
    ws.members = ws.members.filter(m => String(m) !== String(userId));
    await ws.save();
    
    // Remove user from all channels in this workspace
    const channels = await Group.find({ workspace: workspaceId });
    for (const channel of channels) {
      channel.members = channel.members.filter(m => String(m) !== String(userId));
      channel.admins = channel.admins.filter(a => String(a) !== String(userId));
      await channel.save();
    }
    
    // Notify user that they were removed from workspace
    try {
      const io = req.app.get('io');
      const onlineUsers = req.app.get('onlineUsers');
      const userSocket = onlineUsers && onlineUsers.get(String(userId));
      
      if (io && userSocket) {
        io.to(userSocket).emit('removed-from-workspace', { workspaceId });
      }
    } catch (e) {}
    
    res.json({ success: true, msg: 'Member removed successfully' });
  } catch (err) {
    console.error('removeWorkspaceMember', err);
    res.status(500).json({ success: false, msg: 'Server error' });
  }
};
