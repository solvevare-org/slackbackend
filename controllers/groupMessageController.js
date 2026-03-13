import GroupMessage from '../models/groupMessageModel.js'
import Group from '../models/groupModel.js'

export const getGroupMessages = async (req, res) => {
  try {
    const groupId = req.params.groupId
    const msgs = await GroupMessage.find({ group: groupId }).sort({ createdAt: 1 }).populate('from', 'name avatar')
    const out = msgs.map(m => ({ 
      id: m._id, 
      from: m.from?._id || m.from, 
      fromName: m.from?.name || '', 
      fromAvatar: m.from?.avatar || null, 
      group: m.group, 
      content: m.content, 
      edited: !!m.edited, 
      isSystemMessage: !!m.isSystemMessage,
      file: m.file, 
      createdAt: m.createdAt 
    }))
    res.json({ messages: out })
  } catch (err) {
    console.error('getGroupMessages', err)
    res.status(500).json({ msg: 'Server error' })
  }
}

export const updateGroupMessage = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const msgId = req.params.id
    const { content } = req.body
    if (!content || String(content).trim() === '') return res.status(400).json({ msg: 'Content required' })

    const gm = await GroupMessage.findById(msgId)
    if (!gm) return res.status(404).json({ msg: 'Message not found' })

    // permission: sender or admin
    const role = (req.user?.role || req.user?.Role || '').toString().toLowerCase()
    if (String(gm.from) !== String(userId) && role !== 'admin') return res.status(403).json({ msg: 'Forbidden' })

    gm.content = content
    gm.edited = true
    await gm.save()

    const populated = await GroupMessage.findById(gm._id).populate('from', 'name avatar')
    const payload = { id: populated._id, from: populated.from?._id || populated.from, fromName: populated.from?.name || '', fromAvatar: populated.from?.avatar || null, group: populated.group, content: populated.content, edited: !!populated.edited, file: populated.file, createdAt: populated.createdAt }

    const io = req.app.get('io')
    io.to(String(populated.group)).emit('message edited', payload)

    return res.json({ message: payload })
  } catch (err) {
    console.error('updateGroupMessage', err)
    res.status(500).json({ msg: 'Server error' })
  }
}

export const deleteGroupMessage = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const msgId = req.params.id

    const gm = await GroupMessage.findById(msgId)
    if (!gm) return res.status(404).json({ msg: 'Message not found' })

    const role = (req.user?.role || req.user?.Role || '').toString().toLowerCase()
    if (String(gm.from) !== String(userId) && role !== 'admin') return res.status(403).json({ msg: 'Forbidden' })

    await GroupMessage.deleteOne({ _id: msgId })

    const io = req.app.get('io')
    io.to(String(gm.group)).emit('message deleted', { id: msgId, group: gm.group })

    return res.json({ success: true })
  } catch (err) {
    console.error('deleteGroupMessage', err)
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
    const url = `/uploads/${file.filename}`
    const gm = new GroupMessage({ from: me, group: groupId, content: file.originalname, file: { url, filename: file.filename, mimetype: file.mimetype, size: file.size } })
    const saved = await gm.save()

    // emit to room
    const io = req.app.get('io')
    const fromUser = await import('../models/userModel.js').then(m => m.default.findById(me).select('name avatar'))
    io.to(String(groupId)).emit('group message', { content: saved.content, from: me, fromName: fromUser?.name || req.user?.name || '', fromAvatar: fromUser?.avatar || null, group: groupId, file: saved.file, createdAt: saved.createdAt })

    res.status(201).json({ message: saved })
  } catch (err) {
    console.error('uploadGroupFile', err)
    res.status(500).json({ msg: 'Server error' })
  }
}

export default { getGroupMessages }
