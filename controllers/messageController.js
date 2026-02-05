import Message from "../models/messageModel.js"

export const getMessagesBetween = async (req, res) => {
  try {
    const meId = req.user?.id || req.user?._id
    const otherId = req.params.userId
    if (!meId) return res.status(401).json({ msg: 'Unauthorized' })
    const msgs = await Message.find({
      $or: [
        { from: meId, to: otherId },
        { from: otherId, to: meId }
      ]
    }).sort({ createdAt: 1 }).populate('from', 'name').populate('to', 'name')

    // map messages to include sender name and timestamp, be defensive if populate returned null
    const out = msgs.map(m => {
      const fromObj = m.from
      const toObj = m.to
      const fromId = fromObj?._id || fromObj
      const fromName = fromObj?.name || ''
      const toId = toObj?._id || toObj
      const toName = toObj?.name || ''
      return {
        id: m._id,
        from: fromId,
        fromName,
        to: toId,
        toName,
        content: m.content,
        createdAt: m.createdAt
      }
    })
    res.json({ messages: out })
  } catch (error) {
    console.error(error)
    res.status(500).json({ msg: 'Server error' })
  }
}

export default { getMessagesBetween }

export const uploadFile = async (req, res) => {
  try {
    const meId = req.user?.id || req.user?._id
    const to = req.body.to
    if (!meId) return res.status(401).json({ msg: 'Unauthorized' })
    if (!to) return res.status(400).json({ msg: 'Recipient required' })
    if (!req.file) return res.status(400).json({ msg: 'File required' })

    const file = req.file
    const url = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`
    const m = new Message({ from: meId, to, content: file.originalname, file: { url, filename: file.filename, mimetype: file.mimetype, size: file.size } })
    const saved = await m.save()

    // notify recipient if online
    const io = req.app.get('io')
    const onlineUsers = req.app.get('onlineUsers')
    const payload = { content: saved.content, from: meId, fromName: req.user?.name || '', to, file: m.file, createdAt: saved.createdAt }
    const targetSocket = onlineUsers.get(String(to))
    if (targetSocket && io) {
      io.to(targetSocket).emit('private message', payload)
    }

    return res.status(201).json({ message: payload })
  } catch (error) {
    console.error('uploadFile error', error)
    return res.status(500).json({ msg: 'Server error' })
  }
}
