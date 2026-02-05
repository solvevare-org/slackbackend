import { Router } from "express";
import protect from "../middlewares/protect.js";
import { getMessagesBetween } from "../controllers/messageController.js";
import multer from 'multer'
import path from 'path'


const router = Router()

router.get('/:userId', protect, getMessagesBetween)



const uploadDir = path.join(process.cwd(), 'BACKEND', 'uploads')
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, uploadDir)
	},
	filename: function (req, file, cb) {
		const unique = Date.now() + '-' + Math.round(Math.random()*1e9)
		cb(null, unique + '-' + file.originalname.replace(/[^a-zA-Z0-9.\-]/g, '_'))
	}
})
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

import { uploadFile } from "../controllers/messageController.js";
router.post('/upload', protect, upload.single('file'), uploadFile)

export default router
