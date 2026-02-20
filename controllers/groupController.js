import Group from '../models/groupModel.js'
import Workspace from '../models/workspaceModel.js'

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

    // if workspaceId provided, add channel to workspace and emit to workspace room
    try {
      if (workspaceId) {
        // add channel and add members to workspace members (avoid duplicates)
        await Workspace.findByIdAndUpdate(workspaceId, { $addToSet: { channels: saved._id, members: { $each: memberList } } })
        const io = req.app.get('io')
        if (io) {
          io.to(String(workspaceId)).emit('workspace-group-created', { group: saved })
          try {
            // emit member-added for workspace subscribers (clients can handle updating lists)
            (memberList || []).forEach((m) => {
              io.to(String(workspaceId)).emit('workspace-member-added', { user: { id: m } })
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
    const g = await Group.findById(req.params.groupId).populate('members', 'name').populate('admins', 'name')
    if (!g) return res.status(404).json({ msg: 'Not found' })
    res.json({ group: g })
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
    res.json({ group: g })
  } catch (err) {
    console.error('updateGroup', err)
    res.status(500).json({ msg: 'Server error' })
  }
}
