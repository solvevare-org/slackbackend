import Message from "../models/messageModel.js"
import GroupMessage from "../models/groupMessageModel.js"
import User from "../models/userModel.js"
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const getMessagesBetween = async (req, res) => {
  try {
    const meId = req.user?.id || req.user?._id
    const otherId = req.params.userId
    const workspaceId = req.query.workspaceId || req.body?.workspaceId

    if (!meId) {
      console.warn('getMessagesBetween: missing auth user')
      return res.status(401).json({ msg: 'Unauthorized' })
    }

    // require workspace scoping for DMs
    if (!workspaceId) {
      return res.status(400).json({ msg: 'workspaceId required' })
    }

    console.log('getMessagesBetween:', { meId, otherId, workspaceId })

    const msgs = await Message.find({
      workspace: workspaceId,
      $or: [
        { from: meId, to: otherId },
        { from: otherId, to: meId }
      ]
    }).sort({ createdAt: 1 }).populate('from', 'name avatar').populate('to', 'name avatar')

    console.log('getMessagesBetween: found', Array.isArray(msgs) ? msgs.length : 0)

    // map messages to include sender name and timestamp
    const out = msgs.map(m => {
      const fromObj = m.from
      const toObj = m.to
      const fromId = fromObj?._id || fromObj
      const fromName = fromObj?.name || ''
      const fromAvatar = fromObj?.avatar || null
      const toId = toObj?._id || toObj
      const toName = toObj?.name || ''
      const toAvatar = toObj?.avatar || null
      return {
        id: m._id,
        from: fromId,
        fromName,
        fromAvatar,
        to: toId,
        toName,
        toAvatar,
        content: m.content,
        edited: !!m.edited,
        file: m.file || null,
        workspace: m.workspace ? String(m.workspace) : null,
        createdAt: m.createdAt
      }
    })
    res.json({ messages: out })
  } catch (error) {
    console.error('getMessagesBetween error', error)
    res.status(500).json({ msg: 'Server error' })
  }
}

export default { getMessagesBetween }

export const updateMessage = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const msgId = req.params.id
    const { content } = req.body

    if (!content || String(content).trim() === '') return res.status(400).json({ msg: 'Content required' })

    const m = await Message.findById(msgId)
    if (!m) return res.status(404).json({ msg: 'Message not found' })

    // permission: sender or admin
    const role = (req.user?.role || req.user?.Role || '').toString().toLowerCase()
    if (String(m.from) !== String(userId) && role !== 'admin') return res.status(403).json({ msg: 'Forbidden' })

    m.content = content
    m.edited = true
    await m.save()

    const populated = await Message.findById(m._id).populate('from', 'name avatar').populate('to', 'name avatar')
    const payload = {
      id: populated._id,
      from: populated.from?._id || populated.from,
      fromName: populated.from?.name || '',
      fromAvatar: populated.from?.avatar || null,
      to: populated.to?._id || populated.to,
      toName: populated.to?.name || '',
      toAvatar: populated.to?.avatar || null,
      content: populated.content,
      edited: !!populated.edited,
      workspace: populated.workspace ? String(populated.workspace) : null,
      createdAt: populated.createdAt
    }

    const io = req.app.get('io')
    const onlineUsers = req.app.get('onlineUsers')
    // notify recipient and sender sockets (workspace-aware clients will ignore if workspace doesn't match)
    const targetSocket = onlineUsers.get(String(payload.to))
    if (targetSocket && io) io.to(targetSocket).emit('message edited', payload)
    const senderSocket = onlineUsers.get(String(payload.from))
    if (senderSocket && io) io.to(senderSocket).emit('message edited', payload)

    return res.json({ message: payload })
  } catch (err) {
    console.error('updateMessage error', err)
    return res.status(500).json({ msg: 'Server error' })
  }
}

export const deleteMessage = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id
    const msgId = req.params.id

    const m = await Message.findById(msgId)
    if (!m) return res.status(404).json({ msg: 'Message not found' })

    const role = (req.user?.role || req.user?.Role || '').toString().toLowerCase()
    if (String(m.from) !== String(userId) && role !== 'admin') return res.status(403).json({ msg: 'Forbidden' })

    await Message.deleteOne({ _id: msgId })

    const payload = { id: msgId, from: m.from, to: m.to }
    const io = req.app.get('io')
    const onlineUsers = req.app.get('onlineUsers')
    const targetSocket = onlineUsers.get(String(m.to))
    if (targetSocket && io) io.to(targetSocket).emit('message deleted', payload)
    const senderSocket = onlineUsers.get(String(m.from))
    if (senderSocket && io) io.to(senderSocket).emit('message deleted', payload)

    return res.json({ success: true })
  } catch (err) {
    console.error('deleteMessage error', err)
    return res.status(500).json({ msg: 'Server error' })
  }
}

export const uploadFile = async (req, res) => {
  try {
    const meId = req.user?.id || req.user?._id
    const to = req.body.to
    const group = req.body.group

    if (!meId) return res.status(401).json({ msg: 'Unauthorized' })
    if (!to && !group) return res.status(400).json({ msg: 'Recipient required' })
    if (!req.file) return res.status(400).json({ msg: 'File required' })

    const file = req.file
    const url = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`

    // Generate thumbnail for PDF
    let thumbnailUrl = null
    if (file.mimetype === 'application/pdf') {
      try {
        const { default: pdfThumbnail } = await import('pdf-thumbnail')
        const uploadsPath = path.join(process.cwd(), 'BACKEND', 'uploads')
        const pdfPath = path.join(uploadsPath, file.filename)
        const thumbnailFilename = `thumb_${path.parse(file.filename).name}.png`
        const thumbnailPath = path.join(uploadsPath, thumbnailFilename)
        
        console.log('Generating PDF thumbnail:', { pdfPath, thumbnailPath })
        const thumbnail = await pdfThumbnail(pdfPath, { width: 280, height: 128 })
        fs.writeFileSync(thumbnailPath, thumbnail)
        thumbnailUrl = `${req.protocol}://${req.get('host')}/uploads/${thumbnailFilename}`
        console.log('PDF thumbnail generated:', thumbnailUrl)
      } catch (err) {
        console.error('PDF thumbnail generation failed:', err)
      }
    }

    const io = req.app.get('io')
    const onlineUsers = req.app.get('onlineUsers')

    // Direct message upload
    if (to) {
        const m = new Message({
        from: meId,
        to,
        workspace: req.body.workspaceId || undefined,
        content: file.originalname,
        file: { url, filename: file.filename, mimetype: file.mimetype, size: file.size, thumbnail: thumbnailUrl }
      })
      const saved = await m.save()

      const fromUser = await User.findById(meId).select('name avatar')
      const payload = {
        content: saved.content,
        from: meId,
        fromName: fromUser?.name || req.user?.name || '',
        fromAvatar: fromUser?.avatar || null,
        to,
        workspace: saved.workspace ? String(saved.workspace) : null,
        file: m.file,
        createdAt: saved.createdAt
      }

      const targetSocket = onlineUsers.get(String(to))
      // only emit to recipient if their socket is joined to the same workspace room
      if (targetSocket && io && saved.workspace) {
        const room = io.sockets.adapter.rooms.get(String(saved.workspace))
        if (room && room.has(targetSocket)) io.to(targetSocket).emit('private message', payload)
      } else if (targetSocket && io && !saved.workspace) {
        // fallback: emit directly if no workspace specified
        io.to(targetSocket).emit('private message', payload)
      }

      // echo back to sender
      return res.status(201).json({ message: payload })
    }

    // Group upload
    if (group) {
      const gm = new GroupMessage({
        from: meId,
        group,
        content: file.originalname,
        file: { url, filename: file.filename, mimetype: file.mimetype, size: file.size, thumbnail: thumbnailUrl }
      })
      const saved = await gm.save()

      const fromUser = await User.findById(meId).select('name avatar')
      const payload = {
        content: saved.content,
        from: meId,
        fromName: fromUser?.name || req.user?.name || '',
        fromAvatar: fromUser?.avatar || null,
        group,
        file: gm.file,
        createdAt: saved.createdAt
      }

      if (io) io.to(String(group)).emit('group message', payload)
      return res.status(201).json({ message: payload })
    }

    // fallback (shouldn't reach)
    return res.status(400).json({ msg: 'Recipient required' })
  } catch (error) {
    console.error('uploadFile error', error)
    return res.status(500).json({ msg: 'Server error' })
  }
}
