import User from "../models/userModel.js"
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { accessoken, refershtoken } from "../utils/token.js";
import nodemailer from "nodemailer";

// In-memory OTP store: { email -> { code, expiresAt } }
const otpStore = new Map();

export const sendForgotPasswordOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: 'Email required' });
    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(404).json({ msg: 'No account found with this email' });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    otpStore.set(String(email).toLowerCase(), { code, expiresAt: Date.now() + 10 * 60 * 1000 });

    try {
      const host = process.env.EMAIL_HOST;
      const port = parseInt(process.env.EMAIL_PORT || '465');
      const secure = (process.env.EMAIL_SECURE || 'true') === 'true';
      const emailUser = process.env.EMAIL_USER;
      const pass = process.env.EMAIL_PASS;
      const from = process.env.EMAIL_FROM || emailUser;
      if (host && emailUser && pass) {
        const transporter = nodemailer.createTransport({ host, port, secure, auth: { user: emailUser, pass } });
        await transporter.sendMail({
          from, to: email,
          subject: 'Password Reset Code',
          html: `<div style="font-family:sans-serif;max-width:400px;margin:auto;padding:24px;background:#1a1d21;color:#fff;border-radius:12px">
            <h2 style="color:#a855f7">Password Reset</h2>
            <p>Your verification code is:</p>
            <div style="font-size:36px;font-weight:bold;letter-spacing:12px;color:#a855f7;padding:16px 0">${code}</div>
            <p style="color:#ef4444;font-weight:bold">⚠️ Do NOT share this code with anyone.</p>
            <p style="color:#9ca3af;font-size:12px">This code expires in 10 minutes.</p>
          </div>`
        });
      }
    } catch (e) { console.error('OTP email error', e); }

    console.log(`OTP for ${email}: ${code}`);
    res.json({ msg: 'OTP sent' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: 'Server error' });
  }
};

export const verifyOtpAndResetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) return res.status(400).json({ msg: 'All fields required' });
    const emailKey = String(email).toLowerCase();
    const record = otpStore.get(emailKey);
    if (!record) return res.status(400).json({ msg: 'No OTP found. Request a new one.' });
    if (Date.now() > record.expiresAt) { otpStore.delete(emailKey); return res.status(400).json({ msg: 'OTP expired' }); }
    if (record.code !== String(code)) return res.status(400).json({ msg: 'Invalid code' });

    const salt = await bcryptjs.genSalt(10);
    const hashed = await bcryptjs.hash(newPassword, salt);
    await User.findOneAndUpdate({ email: emailKey }, { password: hashed });
    otpStore.delete(emailKey);
    res.json({ msg: 'Password updated successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: 'Server error' });
  }
};
export const register=async(req,res)=>{
    try {
      // console.log(req.body)
    const data= new User(req.body)//save or validate
   await data.save()//send to database 
   res.json({msg:"register successfull...."})
    } catch (error) {
        res.json({msg:error})
    }
}

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ msg: 'Email and password required' })

    const lookupEmail = String(email).toLowerCase()
    const result = await User.findOne({ email: lookupEmail });
    if (!result) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const match = await bcryptjs.compare(password, result.password);
    if (!match) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const refresh = refershtoken(result);
    const access = accessoken(result);

    res.cookie("refcookie", refresh, { httpsOnly: true });

    res.status(200).json({
      msg: "Login successful",
      access,
      user: {
        id: result._id,
        email: result.email,
        name: result.name,
        role: result.Role,
        avatar: result.avatar
      },
    });

  } catch (error) {
    res.status(500).json({ msg: "Server error" });
  }
};


export const refresh=(req,res)=>{
try {
    const refcookie=req.cookies.refcookie
    const result=jwt.verify(refcookie,process.env.REFRESH_SECRET)
    const newaccess=jwt.sign({id:result.id,email:result.email},process.env.ACCESS_SECRET,{expiresIn:"25s"})
    res.json({access:newaccess})
} catch (error) {
  res.json({msg:"invalid cookie"})
}


}