import jwt from "jsonwebtoken";
import Invite from "../models/inviteModel.js";
import User from "../models/userModel.js";
import { accessoken, refershtoken } from "../utils/token.js";
import nodemailer from "nodemailer";

const INVITE_SECRET = process.env.INVITE_SECRET || "invite_secret"

export const createInvite = async (req, res) => {
  try {
    const { email, role, workspaceId } = req.body;
    // only admins can invite
    const requesterRole = (req.user?.role || req.user?.Role || '').toString().toLowerCase()
    if (requesterRole !== 'admin') return res.status(403).json({ msg: 'Only admins can invite' })
    if (!email || !role) return res.status(400).json({ msg: "email and role required" })

    // if workspaceId provided, verify requester is workspace creator or global admin
    if (workspaceId) {
      try {
        const Workspace = (await import('../models/workspaceModel.js')).default
        const ws = await Workspace.findById(workspaceId).select('createdBy').lean()
        if (!ws) return res.status(400).json({ msg: 'Workspace not found' })
        const isCreator = String(ws.createdBy) === String(req.user?.id || req.user?._id)
        if (!isCreator && requesterRole !== 'admin') return res.status(403).json({ msg: 'Forbidden to invite to this workspace' })
      } catch (e) {
        console.error('workspace check error', e)
      }
    }

    // create token valid for 24h
    const emailNorm = String(email).toLowerCase()
    const tokenPayload = { email: emailNorm, role }
    if (workspaceId) tokenPayload.workspaceId = workspaceId
    const token = jwt.sign(tokenPayload, INVITE_SECRET, { expiresIn: '24h' })
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const invite = new Invite({ email: emailNorm, role, token, expiresAt, workspace: workspaceId || undefined })
    await invite.save()

    const frontendHost = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`
    const link = `${frontendHost}/accept-invite?token=${encodeURIComponent(token)}`

    // send email via SMTP if configured
    try {
      const host = process.env.EMAIL_HOST
      const port = parseInt(process.env.EMAIL_PORT || '465')
      const secure = (process.env.EMAIL_SECURE || 'true').toString() === 'true'
      const user = process.env.EMAIL_USER
      const pass = process.env.EMAIL_PASS
      const from = process.env.EMAIL_FROM || user

      if (host && user && pass) {
        const transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: { user, pass }
        })

        const html = `
          <p>You were invited to join the app as <strong>${role}</strong>.</p>
          <p>Click the button below to accept the invite (valid 24 hours):</p>
          <p><a href="${link}" style="display:inline-block;padding:10px 16px;background:#6b21a8;color:#fff;border-radius:6px;text-decoration:none">Accept Invite</a></p>
          <p>If the button doesn't work, open this link:<br/>${link}</p>
        `

        await transporter.sendMail({
          from,
          to: email,
          subject: `You're invited as ${role}`,
          html
        })
      } else {
        console.log('SMTP not configured; skipping email send')
      }
    } catch (mailErr) {
      console.error('Failed to send invite email', mailErr)
    }

    console.log(`Invite created for ${email}: ${link}`)

    res.json({ msg: 'Invite created', link, token })
  } catch (error) {
    console.error(error)
    res.status(500).json({ msg: 'Server error' })
  }
}

export const validateInvite = async (req, res) => {
  try {
    const { token } = req.query
    if (!token) return res.status(400).json({ msg: 'token required' })

    const invite = await Invite.findOne({ token })
    if (!invite) return res.status(404).json({ msg: 'Invite not found' })
    if (invite.used) return res.status(400).json({ msg: 'Invite already used' })
    if (new Date() > invite.expiresAt) return res.status(400).json({ msg: 'Invite expired' })

    // verify signature
    try {
      const payload = jwt.verify(token.toString(), INVITE_SECRET)
      // indicate whether a user with this email already exists (frontend will show login flow)
      const existing = await User.findOne({ email: String(payload.email).toLowerCase() }).select('_id').lean();
      return res.json({ email: payload.email, role: payload.role, existingUser: !!existing })
    } catch (err) {
      return res.status(400).json({ msg: 'Invalid or expired token' })
    }
  } catch (error) {
    console.error(error)
    res.status(500).json({ msg: 'Server error' })
  }
}

export const previewInvite = async (req, res) => {
  try {
    const { email, role } = req.query
    // only admins
    const requesterRole = (req.user?.role || req.user?.Role || '').toString().toLowerCase()
    if (requesterRole !== 'admin') return res.status(403).json({ msg: 'Only admins can preview invites' })
    if (!email || !role) return res.status(400).json({ msg: 'email and role required' })

    const token = jwt.sign({ email, role }, INVITE_SECRET, { expiresIn: '24h' })
    const frontendHost = process.env.FRONTEND_URL || 'https://localhost:5173'
    const link = `${frontendHost}/accept-invite?token=${encodeURIComponent(token)}`
    return res.json({ link, token })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ msg: 'Server error' })
  }
}

export const acceptInviteRegister = async (req, res) => {
  try {
    const { token } = req.query
    const { name, password } = req.body
    if (!token) return res.status(400).json({ msg: 'token required' })
    const invite = await Invite.findOne({ token })
    if (!invite) return res.status(404).json({ msg: 'Invite not found' })
    if (invite.used) return res.status(400).json({ msg: 'Invite already used' })
    if (new Date() > invite.expiresAt) return res.status(400).json({ msg: 'Invite expired' })

    // verify token
    let payload
    try {
      payload = jwt.verify(token.toString(), INVITE_SECRET)
    } catch (err) {
      return res.status(400).json({ msg: 'Invalid or expired token' })
    }

    // ensure not existing user
    const existing = await User.findOne({ email: payload.email })
    if (existing) return res.status(400).json({ msg: 'User already exists' })

    // create user with role from invite; normalize email
    try {
      const user = new User({ name, email: String(payload.email).toLowerCase(), password, Role: payload.role })
      await user.save()

      // if invite targets a workspace, add the created user to that workspace
      try {
        const workspaceId = payload.workspaceId || invite.workspace
        if (workspaceId) {
          const Workspace = (await import('../models/workspaceModel.js')).default
          await Workspace.findByIdAndUpdate(workspaceId, { $addToSet: { members: user._id } })
          // emit event to workspace room if io available
          try {
            const io = req.app.get('io')
            if (io) io.to(String(workspaceId)).emit('workspace-member-added', { user: { id: user._id, name: user.name } })
          } catch (e) {}
        }
      } catch (e) {
        console.error('Failed to add user to workspace', e)
      }

      invite.used = true
      await invite.save()

      const refresh = refershtoken(user)
      const access = accessoken(user)
      // set refresh cookie
      res.cookie('refcookie', refresh, { httpsOnly: true })
      return res.status(201).json({ msg: 'User created', access, user: { id: user._id, email: user.email, name: user.name, role: user.Role } })
    } catch (err) {
      console.error('User create error', err)
      // send mongoose validation errors if present
      if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(e => e.message)
        return res.status(400).json({ msg: messages.join('; ') })
      }
      return res.status(500).json({ msg: 'Server error' })
    }
  } catch (error) {
    console.error(error)
    res.status(500).json({ msg: 'Server error' })
  }
}

export const acceptInviteExisting = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ msg: 'token required' });

    // invite record
    const invite = await Invite.findOne({ token });
    if (!invite) return res.status(404).json({ msg: 'Invite not found' });
    if (invite.used) return res.status(400).json({ msg: 'Invite already used' });
    if (new Date() > invite.expiresAt) return res.status(400).json({ msg: 'Invite expired' });

    // verify token signature
    let payload;
    try {
      payload = jwt.verify(token.toString(), INVITE_SECRET);
    } catch (err) {
      return res.status(400).json({ msg: 'Invalid or expired token' });
    }

    // require authenticated user (protect middleware should set req.user)
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ msg: 'Authentication required' });

    // add the existing user to the workspace if invite targets one
    try {
      const workspaceId = payload.workspaceId || invite.workspace;
      if (workspaceId) {
        const Workspace = (await import('../models/workspaceModel.js')).default;
        const ws = await Workspace.findByIdAndUpdate(workspaceId, { $addToSet: { members: userId } }, { new: true }).select('name').lean();
        // mark invite used
        invite.used = true;
        await invite.save();

        // emit event
        try {
          const io = req.app.get('io');
          if (io) io.to(String(workspaceId)).emit('workspace-member-added', { user: { id: userId } });
        } catch (e) {}

        return res.json({ msg: 'User added to workspace', workspaceId, workspaceName: ws?.name });
      }

      // If no workspace targeted, simply mark invite used and respond
      invite.used = true;
      await invite.save();
      return res.json({ msg: 'Invite accepted' });
    } catch (e) {
      console.error('Failed to add existing user to workspace', e);
      return res.status(500).json({ msg: 'Server error' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Server error' });
  }
}

export default { createInvite, validateInvite, acceptInviteRegister }
