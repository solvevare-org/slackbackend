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
     const newuser=await User.findByIdAndUpdate(id,updata,{new:true})
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
        const url = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`
        const updated = await User.findByIdAndUpdate(id, { avatar: url }, { new: true }).select('-password')
        res.json({ msg: 'avatar updated', user: updated })
    } catch (err) {
        console.error('uploadAvatar error', err)
        res.status(500).json({ msg: 'Server error' })
    }
}

