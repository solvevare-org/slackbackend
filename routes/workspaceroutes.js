import express from 'express';
import multer from 'multer';
import path from 'path';
import { createWorkspace, getWorkspaces, getWorkspace, deleteWorkspace, removeWorkspaceMember } from '../controllers/workspaceController.js';
import protect from '../middlewares/protect.js';

const router = express.Router();

const uploadDir = path.join(process.cwd(), 'BACKEND', 'uploads')
const storage = multer.diskStorage({ destination: function(req,file,cb){ cb(null, uploadDir) }, filename: function(req,file,cb){ cb(null, Date.now() + '-' + file.originalname) } })
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } })

// Create a new workspace
router.post('/', protect, upload.single('image'), createWorkspace);

// Get all workspaces
router.get('/', protect, getWorkspaces);

// Remove member from workspace (admin only)
router.delete('/:workspaceId/members/:userId', protect, removeWorkspaceMember);

// Get single workspace
router.get('/:id', protect, getWorkspace);

// Delete workspace (admin only)
router.delete('/:id', protect, deleteWorkspace);

export default router;
