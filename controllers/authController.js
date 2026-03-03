import User from "../models/userModel.js"
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { accessoken, refershtoken } from "../utils/token.js";

export const register = async (req, res) => {
  try {
    // console.log(req.body)
    const data = new User(req.body)//save or validate
    await data.save()//send to database 
    res.json({ msg: "register successfull...." })
  } catch (error) {
    res.json({ msg: error })
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

    res.cookie("refcookie", refresh, { httpOnly: true });

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

export const googleAuth = async (req, res) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;

    // Check if Google OAuth is configured
    if (!clientId || clientId === 'your_google_client_id_here') {
      return res.status(400).json({
        msg: 'Google OAuth not configured. Please add GOOGLE_CLIENT_ID to .env file'
      });
    }

    // Redirect to Google OAuth
    const backendUrl = process.env.BACKEND_URL;
    const redirectUri = encodeURIComponent(`${backendUrl}/api/auth/google/callback`);
    const scope = encodeURIComponent('email profile');
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
    res.redirect(googleAuthUrl);
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ msg: 'Google auth failed' });
  }
};

export const googleCallback = async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:6007'}/login?error=no_code`);

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:6007'}/login?error=oauth_not_configured`);
    }

    // Exchange code for tokens
    const backendUrl = process.env.BACKEND_URL;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${backendUrl}/api/auth/google/callback`,
        grant_type: 'authorization_code'
      })
    });

    const tokens = await tokenResponse.json();
    if (!tokens.access_token) return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:6007'}/login?error=token_failed`);

    // Get user info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });

    const googleUser = await userInfoResponse.json();
    if (!googleUser.email) return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:6007'}/login?error=no_email`);

    // Check if user exists in database
    const lookupEmail = String(googleUser.email).toLowerCase();
    const user = await User.findOne({ email: lookupEmail });

    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:6007'}/login?error=not_invited`);
    }

    // Generate tokens
    const refresh = refershtoken(user);
    const access = accessoken(user);

    res.cookie('refcookie', refresh, { httpOnly: true });

    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:6007'}/auth/callback?token=${access}&user=${encodeURIComponent(JSON.stringify({ id: user._id, email: user.email, name: user.name, role: user.Role, avatar: user.avatar }))}`);
  } catch (error) {
    console.error('Google callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:6007'}/login?error=server_error`);
  }
};

export const refresh = (req, res) => {
  try {
    const refcookie = req.cookies.refcookie
    const result = jwt.verify(refcookie, process.env.REFRESH_SECRET)
    const newaccess = jwt.sign({ id: result.id, email: result.email }, process.env.ACCESS_SECRET, { expiresIn: "25s" })
    res.json({ access: newaccess })
  } catch (error) {
    res.json({ msg: "invalid cookie" })
  }


}