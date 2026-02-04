import { Router } from "express";
import { deleteuser, getuser, getuserbyid, updateuser } from "../controllers/userController.js";
import validate from "../middlewares/validate.js";
import protect from "../middlewares/protect.js";
const userroutes=Router()



//log in 
userroutes.get("/",protect,getuser)
userroutes.put("/:id",protect,updateuser)
userroutes.get("/:id",protect,getuserbyid)
userroutes.delete("/:id",protect,deleteuser)


export default userroutes