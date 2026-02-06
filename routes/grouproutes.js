import { Router } from 'express'
import { createGroup, getGroup, listGroupsForUser } from '../controllers/groupController.js'
import { getGroupMessages, uploadGroupFile } from '../controllers/groupMessageController.js'
import protect from '../middlewares/protect.js'
import path from 'path'
import multer from 'multer'

const router = Router()

const uploadDir = path.join(process.cwd(), 'BACKEND', 'uploads')
const storage = multer.diskStorage({ destination: function(req,file,cb){ cb(null, uploadDir) }, filename: function(req,file,cb){ cb(null, Date.now() + '-' + file.originalname) } })
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

router.post('/', protect, upload.single('image'), createGroup)
router.get('/me', protect, listGroupsForUser)
router.get('/:groupId', protect, getGroup)
router.get('/:groupId/messages', protect, getGroupMessages)
router.post('/:groupId/upload', protect, upload.single('file'), uploadGroupFile)

export default router
