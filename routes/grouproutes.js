import { Router } from 'express'
import { createGroup, getGroup, listGroupsForUser, deleteGroup, updateGroup, updateGroupPicture, removeMember, addMembers } from '../controllers/groupController.js'
import { getGroupMessages, uploadGroupFile, updateGroupMessage, deleteGroupMessage } from '../controllers/groupMessageController.js'
import protect from '../middlewares/protect.js'
import path from 'path'
import multer from 'multer'

const router = Router()

const uploadDir = path.join(process.cwd(), 'BACKEND', 'uploads')
const storage = multer.diskStorage({ destination: function(req,file,cb){ cb(null, uploadDir) }, filename: function(req,file,cb){ cb(null, Date.now() + '-' + file.originalname) } })
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } })

router.post('/', protect, upload.single('image'), createGroup)
router.get('/me', protect, listGroupsForUser)
router.get('/:groupId', protect, getGroup)
router.get('/:groupId/messages', protect, getGroupMessages)
router.post('/:groupId/upload', protect, upload.single('file'), uploadGroupFile)

// group message edit / delete
router.put('/message/:id', protect, updateGroupMessage)
router.delete('/message/:id', protect, deleteGroupMessage)

router.put('/:groupId', protect, updateGroup)
router.put('/:groupId/picture', protect, upload.single('image'), updateGroupPicture)
router.post('/:groupId/add-members', protect, addMembers)
router.post('/:groupId/remove-member', protect, removeMember)
router.delete('/:groupId', protect, deleteGroup)

export default router
