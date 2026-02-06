import Group from '../models/groupModel.js'

export const createGroup = async (req, res) => {
  try {
    const me = req.user?.id || req.user?._id
    if (!me) return res.status(401).json({ msg: 'Unauthorized' })

    const { name, members, admins: adminsRaw, type, onlyAdminCanPost } = req.body
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
      onlyAdminCanPost: !!onlyAdminCanPost
    })

    if (req.file) {
      const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
      group.image = { url, filename: req.file.filename }
    }

    const saved = await group.save()
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
