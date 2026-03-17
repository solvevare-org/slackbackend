import User from "../models/userModel.js"

export const getuser=async(req,res)=>{
   try {
    const data=await User.find().select('-password')
    res.json({result:data})
   } catch (error) {
    res.json({msg:error})
   }
}

export const updateuser=async(req,res)=>{
    try {
      const id=req.params.id
      const updata=req.body
      // only admin can change Role
      let roleChanged = false
      let oldRole = null
      let newRole = null
      if (updata.Role !== undefined) {
        const requesterRole = (req.user?.role || req.user?.Role || '').toString().toLowerCase()
        if (requesterRole !== 'admin') {
          delete updata.Role
        } else {
          const existing = await User.findById(id).select('Role').lean()
          if (existing && existing.Role !== updata.Role) {
            roleChanged = true
            oldRole = existing.Role
            newRole = updata.Role
          }
        }
      }
      const newuser=await User.findByIdAndUpdate(id,updata,{new:true}).select('-password')

      // emit real-time role update + save notification
      if (roleChanged && newRole) {
        try {
          const io = req.app.get('io')
          const onlineUsers = req.app.get('onlineUsers')
          const socketId = onlineUsers && onlineUsers.get(String(id))
          if (io && socketId) {
            io.to(socketId).emit('role-updated', { userId: String(id), newRole, oldRole })
          }
          // save notification
          const { createNotification } = await import('./notificationController.js')
          const workspaceId = req.body.workspaceId || req.headers['x-workspace-id'] || null
          const notification = await createNotification(id, {
            type: 'system',
            workspaceId,
            title: `Your role has been updated`,
            message: `Now Your Role is "${newRole}". Your Previous Role is "${oldRole}".`
          })
          
          // emit real-time notification to user if online
          if (io && socketId && notification) {
            io.to(socketId).emit('new-notification', {
              _id: notification._id,
              type: 'system',
              title: notification.title,
              message: notification.message,
              workspaceId: notification.workspaceId,
              createdAt: notification.createdAt
            })
          }
        } catch(e) { console.error('role update notify error', e) }
      }

      res.json({msg:"data update successfull",data:newuser})
    } catch (error) {
        res.json({msg:error})
    }
}
export const deleteuser=async(req,res)=>{
    
    try {
        const id=req.params.id
       await User.findByIdAndDelete(id)
       res.json({msg:`data deleted id ${id}`})
    } catch (error) {
        res.json({msg:error})
    }
}
export const getuserbyid=async(req,res)=>{
   try {
  const id= req.params.id
 const data=await User.findById(id)
 res.json({user:data})
   } catch (error) {
    res.json({msg:error})
   }
}

export const uploadAvatar = async (req, res) => {
    try {
        const id = req.params.id
        if (!req.file) return res.status(400).json({ msg: 'File required' })
        const file = req.file
        // store relative path; frontend will resolve it against the API host
        const url = `/uploads/${file.filename}`
        const updated = await User.findByIdAndUpdate(id, { avatar: url }, { new: true }).select('-password')
        res.json({ msg: 'avatar updated', user: updated })
    } catch (err) {
        console.error('uploadAvatar error', err)
        res.status(500).json({ msg: 'Server error' })
    }
}

