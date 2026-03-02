import express from 'express';
import { createWorkspace, getWorkspaces, getWorkspace, deleteWorkspace, upload } from '../controllers/workspaceController.js';
import protect from '../middlewares/protect.js';

const router = express.Router();

// Create a new workspace
router.post('/', protect, upload.single('image'), createWorkspace);

// Get all workspaces
router.get('/', protect, getWorkspaces);

// Get single workspace
router.get('/:id', protect, getWorkspace);

// Delete workspace (admin only)
router.delete('/:id', protect, deleteWorkspace);

export default router;
