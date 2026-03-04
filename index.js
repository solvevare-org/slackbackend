

import express, { Router } from "express";
import dotenv from "dotenv";
import router from "./router/router.js";
import dbConnect from "./db/connect.js";
import cookie from "cookie-parser";
import cors from "cors";
import http from 'http'
import { Server } from 'socket.io'
import Message from './models/messageModel.js'
import Group from './models/groupModel.js'
import GroupMessage from './models/groupMessageModel.js'
import jwt from 'jsonwebtoken'
import User from './models/userModel.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// ensure we load .env relative to this file (works even when node cwd differs)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '.env') })
const app = express()
app.use(express.json())
app.use(cookie())

app.use((req, res, next) => {
  const origin = req.headers.origin;
  console.log(`[CORS DEBUG] Request from Origin: ${origin} | Method: ${req.method} | URL: ${req.url}`);

  const allowedOrigins = [
    process.env.FRONTEND_URL,
    "http://localhost:6007",
    "http://localhost:5173",
  ].filter(Boolean);

  if (allowedOrigins.includes(origin) || (origin && origin.startsWith('http://localhost:'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // Allow server-to-server
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    // For security, if not in whitelist but we want it working for the user for now:
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});


app.use('/api', router)
// Also mount router at root to support legacy requests to /auth/*
app.use(router)
const PORT = process.env.PORT
dbConnect().then(() => {
  const server = http.createServer(app)
  const io = new Server(server, {
    cors: {
      origin: [
        process.env.FRONTEND_URL,
        "http://localhost:6003",
        "http://localhost:6007",
        "http://localhost:5173",
        "http://72.60.97.98:6007",
      ].filter(Boolean),
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  })

  // map of userId -> socketId
  const onlineUsers = new Map()
  // map of userId -> lastSeen timestamp (ms)
  const lastSeen = new Map()
  // expose io and onlineUsers to app for route handlers
  app.set('io', io)
  app.set('onlineUsers', onlineUsers)

  // serve uploaded files
  const uploadsPath = path.join(process.cwd(), 'BACKEND', 'uploads')
  try {
    fs.mkdirSync(uploadsPath, { recursive: true })
  } catch (e) {
    console.error('Failed creating uploads directory', e)
  }
  // serve uploaded files with proper content type
  app.use('/uploads', express.static(uploadsPath))

  io.on('connection', (socket) => {
    console.log('socket connected', socket.id)

    // authenticate socket via token in handshake
    const token = socket.handshake?.auth?.token
    let socketUser = null
    if (token) {
      try {
        const payload = jwt.verify(token, process.env.ACCESS_SECRET)
        socketUser = payload
        onlineUsers.set(String(payload.id), socket.id)
        socket.user = payload
        // join socket to all groups the user is member of
        try {
          Group.find({ members: payload.id }).select('_id').lean().then(groups => {
            groups.forEach(g => {
              try { socket.join(String(g._id)) } catch (e) { }
            })
          }).catch(() => { })
          // also join workspace rooms the user is member of
          try {
            import('./models/workspaceModel.js').then(({ default: Workspace }) => {
              Workspace.find({ members: payload.id }).select('_id').lean().then(wss => {
                wss.forEach(w => { try { socket.join(String(w._id)) } catch (e) { } })
              }).catch(() => { })
            }).catch(() => { })
          } catch (e) { }
        } catch (e) { }
        // send current online list and lastSeen map to the newly connected socket
        try {
          socket.emit('online-list', { online: Array.from(onlineUsers.keys()), lastSeen: Object.fromEntries(lastSeen) })
        } catch (e) { }
        // broadcast to other clients that this user is now online
        try {
          io.emit('user-online', String(payload.id))
        } catch (e) { }
      } catch (e) {
        console.log('socket auth failed', e.message)
        socket.disconnect(true)
        return
      }
    } else {
      // no token provided; disconnect
      socket.disconnect(true)
      return
    }

    socket.on('private message', async ({ content, to, file, workspaceId }) => {
      try {
        const fromId = socket.user.id
        const fromUser = await User.findById(fromId).select('name avatar')
        const fromName = fromUser?.name || ''
        const fromAvatar = fromUser?.avatar || null
        const targetSocket = onlineUsers.get(String(to))

        console.log('private message received', { from: fromId, to, workspaceId, content: content ? String(content).slice(0, 200) : null, hasFile: !!file })

        // persist message (include file metadata and workspace if provided)
        const payloadDoc = { from: fromId, to, content }
        if (workspaceId) payloadDoc.workspace = workspaceId
        if (file && typeof file === 'object') payloadDoc.file = file

        const m = new Message(payloadDoc)
        const saved = await m.save()
        if (!saved || !saved._id) {
          console.error('Failed to save message', { payloadDoc })
          socket.emit('error', { msg: 'Failed to save message' })
          return
        }

        console.log('message saved', { id: String(saved._id) })

        // construct payload matching API GET shape
        const out = {
          id: saved._id,
          from: String(saved.from),
          fromName,
          fromAvatar,
          to: String(saved.to),
          content: saved.content,
          file: saved.file || null,
          workspace: saved.workspace ? String(saved.workspace) : null,
          createdAt: saved.createdAt
        }

        // emit to recipient if online AND their socket is joined to the same workspace room (enforces workspace separation)
        if (targetSocket && io) {
          if (saved.workspace) {
            const room = io.sockets.adapter.rooms.get(String(saved.workspace))
            if (room && room.has(targetSocket)) {
              io.to(targetSocket).emit('private message', out)
            } else {
              // Recipient not in workspace room, save notification
              try {
                const { createNotification } = await import('./controllers/notificationController.js')
                await createNotification(to, {
                  type: 'private',
                  from: fromId,
                  workspaceId: saved.workspace,
                  title: `DM from ${fromName}`,
                  message: content
                })
              } catch (e) {}
            }
          } else {
            // fallback: send directly
            io.to(targetSocket).emit('private message', out)
          }
        } else if (!targetSocket && saved.workspace) {
          // User offline, save notification
          try {
            const { createNotification } = await import('./controllers/notificationController.js')
            await createNotification(to, {
              type: 'private',
              from: fromId,
              workspaceId: saved.workspace,
              title: `DM from ${fromName}`,
              message: content
            })
          } catch (e) {}
        }

        // echo back to sender
        socket.emit('private message', out)
      } catch (err) {
        console.error('private message error', err)
        try { socket.emit('error', { msg: 'private message failed', error: String(err) }) } catch (e) { }
      }
    })

    socket.on('group message', async ({ content, group: groupId, file }) => {
      try {
        const fromId = socket.user.id
        const fromUser = await User.findById(fromId).select('name avatar')
        const fromName = fromUser?.name || ''
        const fromAvatar = fromUser?.avatar || null
        const group = await Group.findById(groupId)
        if (!group) return

        // Check if user is member of group
        const isMember = (group.members || []).map(String).includes(String(fromId))
        if (!isMember) {
          socket.emit('error', { msg: 'You are not authorized to send messages in this group' })
          return
        }

        // permission: if community and onlyAdminCanPost true -> check admin
        if (group.type === 'community' && group.onlyAdminCanPost) {
          const isAdmin = (group.admins || []).map(String).includes(String(fromId))
          if (!isAdmin) return
        }

        const payloadDoc = { from: fromId, group: groupId, content }
        if (file && typeof file === 'object') payloadDoc.file = file
        const gm = new GroupMessage(payloadDoc)
        const saved = await gm.save()

        const payload = { content, from: fromId, fromName, fromAvatar, group: groupId, file: saved.file || null, createdAt: saved.createdAt }
        
        // Send to all members in the group room
        io.to(String(groupId)).emit('group message', payload)
        
        // Save notification for members not in workspace room
        if (group.workspace) {
          try {
            const { createNotification } = await import('./controllers/notificationController.js')
            const workspaceRoom = io.sockets.adapter.rooms.get(String(group.workspace))
            for (const memberId of group.members) {
              if (String(memberId) === String(fromId)) continue
              const memberSocket = onlineUsers.get(String(memberId))
              if (!memberSocket || !workspaceRoom || !workspaceRoom.has(memberSocket)) {
                await createNotification(memberId, {
                  type: 'group',
                  from: fromId,
                  groupId: groupId,
                  workspaceId: group.workspace,
                  title: `${fromName} in ${group.name}`,
                  message: content
                })
              }
            }
          } catch (e) {}
        }
      } catch (err) {
        console.error('group message error', err)
      }
    })

    // allow client to explicitly join a group room (useful right after creation)
    socket.on('join group', (groupId) => {
      try {
        if (groupId) socket.join(String(groupId))
      } catch (e) { }
    })

    socket.on('disconnect', () => {
      // remove user from map if present and notify others
      try {
        if (socket.user && socket.user.id) {
          const uid = String(socket.user.id)
          onlineUsers.delete(uid)
          const ts = Date.now()
          lastSeen.set(uid, ts)
          io.emit('user-offline', { id: uid, lastSeen: ts })
        } else {
          for (const [uid, sid] of onlineUsers.entries()) {
            if (sid === socket.id) {
              onlineUsers.delete(uid)
              const ts = Date.now()
              lastSeen.set(uid, ts)
              io.emit('user-offline', { id: uid, lastSeen: ts })
            }
          }
        }
      } catch (e) { }
    })
  })

  server.listen(PORT, () => {
    console.log(`server running ` + PORT)
  })
  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Kill the process using that port or set a different PORT in your .env and restart.`)
      process.exit(1)
    } else {
      console.error('Server error', err)
      process.exit(1)
    }
  })
})
