import { Router } from "express";
import { deleteuser, getuser, getuserbyid, updateuser, uploadAvatar } from "../controllers/userController.js";
import validate from "../middlewares/validate.js";
import protect from "../middlewares/protect.js";
import multer from 'multer'
import path from 'path'
const userroutes=Router()



//log in 
userroutes.get("/",protect,getuser)
userroutes.put("/:id",protect,updateuser)
userroutes.get("/:id",protect,getuserbyid)
userroutes.delete("/:id",protect,deleteuser)

// avatar upload
const uploadDir = path.join(process.cwd(), 'BACKEND', 'uploads')
const storage = multer.diskStorage({
	destination: function(req,file,cb){ cb(null, uploadDir) },
	filename: function(req,file,cb){ const unique = Date.now() + '-' + Math.round(Math.random()*1e9); cb(null, unique + '-' + file.originalname.replace(/[^a-zA-Z0-9.\-]/g, '_')) }
})
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } })
userroutes.post('/:id/avatar', protect, upload.single('avatar'), uploadAvatar)


export default userroutes


