import { Router } from 'express'
import { createGroup, listGroupsForUser, getGroup } from '../controllers/groupController.js'
import protect from '../middlewares/protect.js'
import path from 'path'
import multer from 'multer'

const router = Router()

const uploadDir = path.join(process.cwd(), 'BACKEND', 'uploads')
const storage = multer.diskStorage({ destination: function(req,file,cb){ cb(null, uploadDir) }, filename: function(req,file,cb){ cb(null, Date.now() + '-' + file.originalname) } })
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

// create a community (delegates to createGroup but forces type=community)
router.post('/', protect, upload.single('image'), (req, res, next) => {
  try {
    req.body.type = 'community'
  } catch (e) {}
  return createGroup(req, res, next)
})

// list communities for user (filter by type=community)
router.get('/me', protect, async (req, res) => {
  try {
    const me = req.user?.id || req.user?._id
    const Group = (await import('../models/groupModel.js')).default
    const groups = await Group.find({ members: me, type: 'community' }).select('name type members admins image')
    res.json({ groups })
  } catch (err) {
    console.error('list communities error', err)
    res.status(500).json({ msg: 'Server error' })
  }
})

router.get('/:groupId', protect, getGroup)

export default router
