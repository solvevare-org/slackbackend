import Group from '../models/groupModel.js'
import Workspace from '../models/workspaceModel.js'
import { createNotification } from '../controllers/notificationController.js'

const ensureAdmin = (req) => {
  try {
    const me = req.user?.id || req.user?._id
    if (!me) return false
    const role = (req.user?.role || req.user?.Role || '').toString().toLowerCase()
    if (role === 'admin') return true
    return false
  } catch (e) { return false }
}

export const createGroup = async (req, res) => {
  try {
    const me = req.user?.id || req.user?._id
    if (!me) return res.status(401).json({ msg: 'Unauthorized' })
    const { name, members, admins: adminsRaw, type, onlyAdminCanPost, workspaceId } = req.body
    const parsedMembers = members ? JSON.parse(members) : []
    const parsedAdmins = adminsRaw ? JSON.parse(adminsRaw) : []

    // ensure creator is admin and member
    const admins = Array.from(new Set([me, ...(parsedAdmins || [])]))
    const memberList = Array.from(new Set([...(parsedMembers || []), ...admins, me]))

    const group = new Group({
      name,
      type: type || 'group',
      members: memberList,
      admins,
      workspace: workspaceId || undefined,
      onlyAdminCanPost: !!onlyAdminCanPost
    })

    if (req.file) {
      const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
      group.image = { url, filename: req.file.filename }
    }

    const saved = await group.save()

    // Get admin name for notification
    const User = (await import('../models/userModel.js')).default
    const adminUser = await User.findById(me).select('name')
    const adminName = adminUser?.name || 'Admin'

    // if workspaceId provided, add channel to workspace and emit to workspace room
    try {
      if (workspaceId) {
        // add channel and add members to workspace members (avoid duplicates)
        await Workspace.findByIdAndUpdate(workspaceId, { $addToSet: { channels: saved._id, members: { $each: memberList } } })
        const io = req.app.get('io')
        const onlineUsers = req.app.get('onlineUsers')
        if (io) {
          io.to(String(workspaceId)).emit('workspace-group-created', { group: saved })
          try {
            // emit member-added for workspace subscribers (clients can handle updating lists)
            (memberList || []).forEach(async (m) => {
              io.to(String(workspaceId)).emit('workspace-member-added', { user: { id: m } })
              // Send notification to added members (except creator)
              if (String(m) !== String(me)) {
                // Save to database
                await createNotification(m, {
                  type: 'group',
                  from: me,
                  groupId: saved._id,
                  workspaceId: workspaceId,
                  title: saved.name,
                  message: `${adminName} created this Channel and add you`
                })
                // Only send real-time if online, otherwise they'll get it from database
                const memberSocket = onlineUsers?.get(String(m))
                if (memberSocket) {
                  io.to(memberSocket).emit('group-added-notification', {
                    groupId: saved._id,
                    groupName: saved.name,
                    adminName,
                    message: `${adminName} created this Channel and add you`
                  })
                }
              }
            })
          } catch (e) {}
        }
      }
    } catch (e) {}
    res.status(201).json({ group: saved })
  } catch (err) {
    console.error('createGroup error', err)
    res.status(500).json({ msg: 'Server error' })
  }
}

export const getGroup = async (req, res) => {
  try {
    const me = req.user?.id || req.user?._id
    const g = await Group.findById(req.params.groupId).populate('members', 'name email avatar').populate('admins', 'name email avatar')
    if (!g) return res.status(404).json({ msg: 'Not found' })
    
    // Check if user is a member of the group
    const isMember = g.members.some(m => String(m._id || m) === String(me))
    if (!isMember) return res.status(403).json({ msg: 'Access denied. You are not a member of this group.' })
    
    res.json({ success: true, group: g })
  } catch (err) {
    console.error('getGroup', err)
    res.status(500).json({ msg: 'Server error' })
  }
}

export const listGroupsForUser = async (req, res) => {
  try {
    const me = req.user?.id || req.user?._id
    const groups = await Group.find({ members: me }).select('name type members admins image')
    res.json({ groups })
  } catch (err) {
    console.error('listGroupsForUser', err)
    res.status(500).json({ msg: 'Server error' })
  }
}

export default { createGroup }

export const deleteGroup = async (req, res) => {
  try {
    const groupId = req.params.groupId
    if (!groupId) return res.status(400).json({ msg: 'Missing id' })

    // require admin
    if (!ensureAdmin(req)) return res.status(403).json({ msg: 'Forbidden' })

    const g = await Group.findById(groupId)
    if (!g) return res.status(404).json({ msg: 'Not found' })

    await Group.deleteOne({ _id: groupId })
    res.json({ msg: 'Deleted' })
  } catch (err) {
    console.error('deleteGroup', err)
    res.status(500).json({ msg: 'Server error' })
  }
}

export const updateGroup = async (req, res) => {
  try {
    const groupId = req.params.groupId
    if (!groupId) return res.status(400).json({ msg: 'Missing id' })

    const { name } = req.body
    if (!name) return res.status(400).json({ msg: 'Missing name' })

    const g = await Group.findById(groupId)
    if (!g) return res.status(404).json({ msg: 'Not found' })

    // allow global admin or group admin
    const me = req.user?.id || req.user?._id
    const globalRole = (req.user?.role || req.user?.Role || '').toString().toLowerCase()
    const isGlobalAdmin = globalRole === 'admin'
    const isGroupAdmin = Array.isArray(g.admins) && g.admins.map(String).includes(String(me))
    if (!isGlobalAdmin && !isGroupAdmin) return res.status(403).json({ msg: 'Forbidden' })

    g.name = name
    await g.save()

    // Emit system message to group
    const io = req.app.get('io')
    if (io) {
      const User = (await import('../models/userModel.js')).default
      const adminUser = await User.findById(me).select('name')
      const adminName = adminUser?.name || 'Admin'
      
      io.to(String(groupId)).emit('group message', {
        id: `system-${Date.now()}`,
        from: 'system',
        group: groupId,
        content: `${adminName} edited the channel name.`,
        isSystemMessage: true,
        createdAt: new Date().toISOString()
      })
    }

    res.json({ group: g })
  } catch (err) {
    console.error('updateGroup', err)
    res.status(500).json({ msg: 'Server error' })
  }
}

export const updateGroupPicture = async (req, res) => {
  try {
    const groupId = req.params.groupId
    if (!groupId) return res.status(400).json({ msg: 'Missing id' })
    if (!req.file) return res.status(400).json({ msg: 'No file uploaded' })

    const g = await Group.findById(groupId)
    if (!g) return res.status(404).json({ msg: 'Not found' })

    const me = req.user?.id || req.user?._id
    const globalRole = (req.user?.role || req.user?.Role || '').toString().toLowerCase()
    const isGlobalAdmin = globalRole === 'admin'
    const isGroupAdmin = Array.isArray(g.admins) && g.admins.map(String).includes(String(me))
    if (!isGlobalAdmin && !isGroupAdmin) return res.status(403).json({ msg: 'Forbidden' })

    const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
    g.image = { url, filename: req.file.filename }
    await g.save()

    // Emit system message to group
    const io = req.app.get('io')
    if (io) {
      const User = (await import('../models/userModel.js')).default
      const adminUser = await User.findById(me).select('name')
      const adminName = adminUser?.name || 'Admin'
      
      io.to(String(groupId)).emit('group message', {
        id: `system-${Date.now()}`,
        from: 'system',
        group: groupId,
        content: `${adminName} updated the channel profile.`,
        isSystemMessage: true,
        createdAt: new Date().toISOString()
      })
    }

    res.json({ success: true, group: g })
  } catch (err) {
    console.error('updateGroupPicture', err)
    res.status(500).json({ msg: 'Server error' })
  }
}

export const removeMember = async (req, res) => {
  try {
    const groupId = req.params.groupId
    const { userId } = req.body
    if (!groupId || !userId) return res.status(400).json({ msg: 'Missing parameters' })

    const g = await Group.findById(groupId)
    if (!g) return res.status(404).json({ msg: 'Not found' })

    const me = req.user?.id || req.user?._id
    const globalRole = (req.user?.role || req.user?.Role || '').toString().toLowerCase()
    const isGlobalAdmin = globalRole === 'admin'
    const isGroupAdmin = Array.isArray(g.admins) && g.admins.map(String).includes(String(me))
    if (!isGlobalAdmin && !isGroupAdmin) return res.status(403).json({ msg: 'Forbidden' })

    g.members = g.members.filter(m => String(m) !== String(userId))
    g.admins = g.admins.filter(a => String(a) !== String(userId))
    await g.save()

    // Remove user from socket room
    const io = req.app.get('io')
    const onlineUsers = req.app.get('onlineUsers')
    if (io && onlineUsers) {
      const userSocket = onlineUsers.get(String(userId))
      if (userSocket) {
        const socket = io.sockets.sockets.get(userSocket)
        if (socket) {
          socket.leave(String(groupId))
        }
      }
    }

    // Send notification to removed user
    try {
      const User = (await import('../models/userModel.js')).default
      const adminUser = await User.findById(me).select('name')
      const removedUser = await User.findById(userId).select('name')
      const adminName = adminUser?.name || 'Admin'
      const removedUserName = removedUser?.name || 'User'
      
      await createNotification(userId, {
        type: 'group',
        from: me,
        groupId: g._id,
        workspaceId: g.workspace,
        title: g.name,
        message: `${adminName} removed you from ${g.name}`
      })
      
      if (io && onlineUsers) {
        const userSocket = onlineUsers.get(String(userId))
        if (userSocket) {
          io.to(userSocket).emit('member-removed-notification', {
            groupId: g._id,
            groupName: g.name,
            adminName,
            message: `${adminName} removed you from ${g.name}`
          })
        }
      }

      // Emit system message to group
      if (io) {
        io.to(String(groupId)).emit('group message', {
          id: `system-${Date.now()}`,
          from: 'system',
          group: groupId,
          content: `${adminName} removed ${removedUserName}.`,
          isSystemMessage: true,
          createdAt: new Date().toISOString()
        })
      }
    } catch (e) {}

    res.json({ success: true, msg: 'Member removed' })
  } catch (err) {
    console.error('removeMember', err)
    res.status(500).json({ msg: 'Server error' })
  }
}

export const addMembers = async (req, res) => {
  try {
    const groupId = req.params.groupId
    const { memberIds } = req.body
    if (!groupId || !memberIds || !Array.isArray(memberIds)) return res.status(400).json({ msg: 'Missing parameters' })

    const g = await Group.findById(groupId)
    if (!g) return res.status(404).json({ msg: 'Not found' })

    const me = req.user?.id || req.user?._id
    const globalRole = (req.user?.role || req.user?.Role || '').toString().toLowerCase()
    const isGlobalAdmin = globalRole === 'admin'
    const isGroupAdmin = Array.isArray(g.admins) && g.admins.map(String).includes(String(me))
    if (!isGlobalAdmin && !isGroupAdmin) return res.status(403).json({ msg: 'Forbidden' })

    // Add members
    const existingIds = new Set(g.members.map(String))
    const newMembers = memberIds.filter(id => !existingIds.has(String(id)))
    g.members = [...g.members, ...newMembers]
    await g.save()

    // Populate and return
    const populated = await Group.findById(groupId).populate('members', 'name email avatar').populate('admins', 'name email avatar')

    // Emit system message and send notifications
    const io = req.app.get('io')
    const onlineUsers = req.app.get('onlineUsers')
    if (io && newMembers.length > 0) {
      const User = (await import('../models/userModel.js')).default
      const adminUser = await User.findById(me).select('name')
      const adminName = adminUser?.name || 'Admin'
      const addedUsers = await User.find({ _id: { $in: newMembers } }).select('name')
      const names = addedUsers.map(u => u.name).join(', ')
      
      io.to(String(groupId)).emit('group message', {
        id: `system-${Date.now()}`,
        from: 'system',
        group: groupId,
        content: `${adminName} added ${names}.`,
        isSystemMessage: true,
        createdAt: new Date().toISOString()
      })

      // Send notification to each added member
      try {
        for (const memberId of newMembers) {
          await createNotification(memberId, {
            type: 'group',
            from: me,
            groupId: g._id,
            workspaceId: g.workspace,
            title: g.name,
            message: `${adminName} added you to ${g.name}`
          })
          
          const memberSocket = onlineUsers?.get(String(memberId))
          if (memberSocket) {
            io.to(memberSocket).emit('group-added-notification', {
              groupId: g._id,
              groupName: g.name,
              adminName,
              message: `${adminName} added you to ${g.name}`
            })
          }
        }
      } catch (e) {}
    }

    res.json({ success: true, group: populated })
  } catch (err) {
    console.error('addMembers', err)
    res.status(500).json({ msg: 'Server error' })
  }
}
