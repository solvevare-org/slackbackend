import Workspace from '../models/workspaceModel.js';

// Create a new workspace
export const createWorkspace = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
    const createdBy = req.user?.id || req.user?._id;
    if (!createdBy) return res.status(401).json({ success: false, message: 'Unauthorized' });
    // include creator as initial member
    const workspace = await Workspace.create({ name, description, createdBy, members: [createdBy] });
    // emit real-time update to the creator if socket is available
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
    const ws = await Workspace.findById(id).populate('members', 'name email Role avatar').populate({ path: 'channels', select: 'name members admins createdAt workspace' })
    if (!ws) return res.status(404).json({ success: false, message: 'Not found' })
    // ensure user is member or creator
    const isMember = String(ws.createdBy) === String(userId) || (Array.isArray(ws.members) && ws.members.map((m) => String(m._id || m)).includes(String(userId)))
    if (!isMember) return res.status(403).json({ success: false, message: 'Forbidden' })
    res.json({ success: true, workspace: ws })
  } catch (err) {
    console.error('getWorkspace', err)
    res.status(500).json({ success: false, message: 'Server error' })
  }
}
