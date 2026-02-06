import GroupMessage from '../models/groupMessageModel.js'
import Group from '../models/groupModel.js'

export const getGroupMessages = async (req, res) => {
  try {
    const groupId = req.params.groupId
    const msgs = await GroupMessage.find({ group: groupId }).sort({ createdAt: 1 }).populate('from', 'name')
    const out = msgs.map(m => ({ id: m._id, from: m.from?._id || m.from, fromName: m.from?.name || '', group: m.group, content: m.content, file: m.file, createdAt: m.createdAt }))
    res.json({ messages: out })
  } catch (err) {
    console.error('getGroupMessages', err)
    res.status(500).json({ msg: 'Server error' })
  }
}

export const uploadGroupFile = async (req, res) => {
  try {
    const me = req.user?.id || req.user?._id
    const groupId = req.body.group
    if (!me) return res.status(401).json({ msg: 'Unauthorized' })
    if (!groupId) return res.status(400).json({ msg: 'Group required' })

    const group = await Group.findById(groupId)
    if (!group) return res.status(404).json({ msg: 'Group not found' })

    // check permission for community type
    if (group.type === 'community' && group.onlyAdminCanPost) {
      const isAdmin = String(group.admins || []).includes(String(me))
      if (!isAdmin) return res.status(403).json({ msg: 'Only admin can post in this community' })
    }

    const file = req.file
    const url = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`
    const gm = new GroupMessage({ from: me, group: groupId, content: file.originalname, file: { url, filename: file.filename, mimetype: file.mimetype, size: file.size } })
    const saved = await gm.save()

    // emit to room
    const io = req.app.get('io')
    io.to(String(groupId)).emit('group message', { content: saved.content, from: me, fromName: req.user?.name || '', group: groupId, file: saved.file, createdAt: saved.createdAt })

    res.status(201).json({ message: saved })
  } catch (err) {
    console.error('uploadGroupFile', err)
    res.status(500).json({ msg: 'Server error' })
  }
}

export default { getGroupMessages }
