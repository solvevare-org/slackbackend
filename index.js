

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
dotenv.config()
const app=express()
app.use(express.json())
app.use(cookie())

app.use(cors({
  origin: "http://localhost:5173", // your frontend port
  credentials: true
}));


app.use('/api', router)
// Also mount router at root to support legacy requests to /auth/*
app.use(router)
const PORT = process.env.PORT || 9000
dbConnect().then(()=>{
  const server = http.createServer(app)
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET','POST']
    }
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
              try { socket.join(String(g._id)) } catch(e){}
            })
          }).catch(()=>{})
        } catch(e){}
        // send current online list and lastSeen map to the newly connected socket
        try {
          socket.emit('online-list', { online: Array.from(onlineUsers.keys()), lastSeen: Object.fromEntries(lastSeen) })
        } catch (e) {}
        // broadcast to other clients that this user is now online
        try {
          io.emit('user-online', String(payload.id))
        } catch (e) {}
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

    socket.on('private message', async ({ content, to }) => {
      try {
        const fromId = socket.user.id
        const fromName = socket.user.name || ''
        const targetSocket = onlineUsers.get(String(to))

        // persist message
        const m = new Message({ from: fromId, to, content })
        const saved = await m.save()

        const payload = { content, from: fromId, fromName, to, createdAt: saved.createdAt }
        // emit to recipient if online
        if (targetSocket) {
          io.to(targetSocket).emit('private message', payload)
        }
        // also emit to sender socket for local echo
        socket.emit('private message', payload)
      } catch (err) {
        console.error('private message error', err)
      }
    })

    socket.on('group message', async ({ content, group: groupId }) => {
      try {
        const fromId = socket.user.id
        const fromName = socket.user.name || ''
        const group = await Group.findById(groupId)
        if (!group) return

        // permission: if community and onlyAdminCanPost true -> check admin
        if (group.type === 'community' && group.onlyAdminCanPost) {
          const isAdmin = (group.admins || []).map(String).includes(String(fromId))
          if (!isAdmin) return
        }

        const gm = new GroupMessage({ from: fromId, group: groupId, content })
        const saved = await gm.save()

        const payload = { content, from: fromId, fromName, group: groupId, createdAt: saved.createdAt }
        // emit to group room
        io.to(String(groupId)).emit('group message', payload)
      } catch (err) {
        console.error('group message error', err)
      }
    })

    // allow client to explicitly join a group room (useful right after creation)
    socket.on('join group', (groupId) => {
      try {
        if (groupId) socket.join(String(groupId))
      } catch (e) {}
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
      } catch (e) {}
    })
  })

  server.listen(PORT, ()=>{
    console.log(`server running `+PORT)
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
