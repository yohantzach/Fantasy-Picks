import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { authMiddleware } from "../middleware/auth";
import { db } from "../../db";
import { and, eq } from "drizzle-orm";
import { users, paymentProofs } from "@shared/schema";

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads/payment-proofs');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error, '');
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `payment-proof-${req.user.id}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and PDFs are allowed.'));
    }
  }
});

// Submit payment proof
router.post("/submit-proof", authMiddleware, upload.single('proofFile'), async (req, res) => {
  try {
    const { paymentMethod, transactionId, amount, notes, gameweekId, teamNumber } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!paymentMethod || !transactionId || !gameweekId || !teamNumber) {
      return res.status(400).json({
        error: "Payment method, transaction ID, gameweek ID, and team number are required"
      });
    }

    const currentGameweekId = parseInt(gameweekId);
    const currentTeamNumber = parseInt(teamNumber);

    // Check if user already has a pending or approved payment for this team in this gameweek
    const existingProof = await db
      .select()
      .from(paymentProofs)
      .where(
        and(
          eq(paymentProofs.userId, userId),
          eq(paymentProofs.gameweekId, currentGameweekId),
          eq(paymentProofs.teamNumber, currentTeamNumber),
          eq(paymentProofs.status, 'pending')
        )
      )
      .limit(1);

    if (existingProof.length > 0) {
      return res.status(400).json({
        error: `You already have a pending payment verification for team ${currentTeamNumber} in this gameweek`
      });
    }

    // Check if user has already paid for this team in this gameweek
    const approvedProof = await db
      .select()
      .from(paymentProofs)
      .where(
        and(
          eq(paymentProofs.userId, userId),
          eq(paymentProofs.gameweekId, currentGameweekId),
          eq(paymentProofs.teamNumber, currentTeamNumber),
          eq(paymentProofs.status, 'approved')
        )
      )
      .limit(1);

    if (approvedProof.length > 0) {
      return res.status(400).json({
        error: `Payment already completed for team ${currentTeamNumber} in this gameweek`
      });
    }

    // Create payment proof record
    const proofData = {
      userId,
      gameweekId: currentGameweekId,
      teamNumber: currentTeamNumber,
      paymentMethod,
      transactionId,
      amount: parseFloat(amount) || 20,
      notes: notes || null,
      proofFilePath: req.file ? req.file.path : null,
      status: 'pending' as const,
      submittedAt: new Date(),
    };

    const [newProof] = await db
      .insert(paymentProofs)
      .values(proofData)
      .returning();

    res.json({
      message: "Payment proof submitted successfully",
      proofId: newProof.id,
      status: "pending"
    });

  } catch (error) {
    console.error("Payment proof submission error:", error);
    
    // Clean up uploaded file if there was an error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error("Failed to clean up uploaded file:", unlinkError);
      }
    }
    
    res.status(500).json({
      error: "Failed to submit payment proof"
    });
  }
});

// Get payment status for current user for a specific team
router.get("/status/:gameweekId/:teamNumber", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const gameweekId = parseInt(req.params.gameweekId);
    const teamNumber = parseInt(req.params.teamNumber);

    if (isNaN(gameweekId) || isNaN(teamNumber)) {
      return res.status(400).json({
        error: "Invalid gameweek ID or team number"
      });
    }

    // Check if user has approved payment for this specific team
    const approvedProof = await db
      .select({
        id: paymentProofs.id,
        status: paymentProofs.status,
        submittedAt: paymentProofs.submittedAt,
        verifiedAt: paymentProofs.verifiedAt,
        paymentMethod: paymentProofs.paymentMethod,
        amount: paymentProofs.amount,
        teamNumber: paymentProofs.teamNumber
      })
      .from(paymentProofs)
      .where(
        and(
          eq(paymentProofs.userId, userId),
          eq(paymentProofs.gameweekId, gameweekId),
          eq(paymentProofs.teamNumber, teamNumber),
          eq(paymentProofs.status, 'approved')
        )
      )
      .limit(1);

    if (approvedProof.length > 0) {
      return res.json({
        hasPaid: true,
        status: "approved",
        paymentProof: approvedProof[0]
      });
    }

    // Check for pending payment proof
    const pendingProof = await db
      .select({
        id: paymentProofs.id,
        status: paymentProofs.status,
        submittedAt: paymentProofs.submittedAt,
        paymentMethod: paymentProofs.paymentMethod,
        amount: paymentProofs.amount,
        teamNumber: paymentProofs.teamNumber
      })
      .from(paymentProofs)
      .where(
        and(
          eq(paymentProofs.userId, userId),
          eq(paymentProofs.gameweekId, gameweekId),
          eq(paymentProofs.teamNumber, teamNumber),
          eq(paymentProofs.status, 'pending')
        )
      )
      .limit(1);

    if (pendingProof.length > 0) {
      return res.json({
        hasPaid: false,
        status: "pending",
        paymentProof: pendingProof[0]
      });
    }

    // Check for rejected payment proof
    const rejectedProof = await db
      .select({
        id: paymentProofs.id,
        status: paymentProofs.status,
        submittedAt: paymentProofs.submittedAt,
        verifiedAt: paymentProofs.verifiedAt,
        adminNotes: paymentProofs.adminNotes,
        paymentMethod: paymentProofs.paymentMethod,
        amount: paymentProofs.amount,
        teamNumber: paymentProofs.teamNumber
      })
      .from(paymentProofs)
      .where(
        and(
          eq(paymentProofs.userId, userId),
          eq(paymentProofs.gameweekId, gameweekId),
          eq(paymentProofs.teamNumber, teamNumber),
          eq(paymentProofs.status, 'rejected')
        )
      )
      .orderBy(paymentProofs.submittedAt)
      .limit(1);

    if (rejectedProof.length > 0) {
      return res.json({
        hasPaid: false,
        status: "rejected",
        paymentProof: rejectedProof[0]
      });
    }

    res.json({
      hasPaid: false,
      status: "not_submitted"
    });

  } catch (error) {
    console.error("Payment status fetch error:", error);
    res.status(500).json({
      error: "Failed to fetch payment status"
    });
  }
});

// Get payment status for current user (legacy endpoint)
router.get("/status", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's payment status
    const user = await db
      .select({ hasPaid: users.hasPaid })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user[0]?.hasPaid) {
      return res.json({
        hasPaid: true,
        status: "approved"
      });
    }

    // Get pending payment proof
    const pendingProof = await db
      .select({
        id: paymentProofs.id,
        status: paymentProofs.status,
        submittedAt: paymentProofs.submittedAt,
        paymentMethod: paymentProofs.paymentMethod,
        amount: paymentProofs.amount
      })
      .from(paymentProofs)
      .where(eq(paymentProofs.userId, userId))
      .orderBy(paymentProofs.submittedAt)
      .limit(1);

    if (pendingProof.length > 0) {
      return res.json({
        hasPaid: false,
        status: pendingProof[0].status,
        paymentProof: pendingProof[0]
      });
    }

    res.json({
      hasPaid: false,
      status: "not_submitted"
    });

  } catch (error) {
    console.error("Payment status fetch error:", error);
    res.status(500).json({
      error: "Failed to fetch payment status"
    });
  }
});

// Admin endpoint to list pending payment proofs
router.get("/admin/pending", authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: "Admin access required"
      });
    }

    const pendingProofs = await db
      .select({
        id: paymentProofs.id,
        userId: paymentProofs.userId,
        username: users.username,
        email: users.email,
        paymentMethod: paymentProofs.paymentMethod,
        transactionId: paymentProofs.transactionId,
        amount: paymentProofs.amount,
        notes: paymentProofs.notes,
        proofFilePath: paymentProofs.proofFilePath,
        submittedAt: paymentProofs.submittedAt,
        status: paymentProofs.status
      })
      .from(paymentProofs)
      .leftJoin(users, eq(paymentProofs.userId, users.id))
      .where(eq(paymentProofs.status, 'pending'))
      .orderBy(paymentProofs.submittedAt);

    res.json(pendingProofs);

  } catch (error) {
    console.error("Admin pending proofs fetch error:", error);
    res.status(500).json({
      error: "Failed to fetch pending payment proofs"
    });
  }
});

// Admin endpoint to approve/reject payment proof
router.post("/admin/verify/:proofId", authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: "Admin access required"
      });
    }

    const { proofId } = req.params;
    const { action, notes } = req.body; // action: 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        error: "Invalid action. Must be 'approve' or 'reject'"
      });
    }

    // Get payment proof
    const proof = await db
      .select()
      .from(paymentProofs)
      .where(eq(paymentProofs.id, parseInt(proofId)))
      .limit(1);

    if (proof.length === 0) {
      return res.status(404).json({
        error: "Payment proof not found"
      });
    }

    const paymentProof = proof[0];

    if (paymentProof.status !== 'pending') {
      return res.status(400).json({
        error: "Payment proof has already been processed"
      });
    }

    // Update payment proof status
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    
    await db
      .update(paymentProofs)
      .set({
        status: newStatus,
        verifiedAt: new Date(),
        verifiedBy: req.user.id,
        adminNotes: notes || null
      })
      .where(eq(paymentProofs.id, parseInt(proofId)));

    // If approved, update user's payment status and complete team registration
    if (action === 'approve') {
      await db
        .update(users)
        .set({ hasPaid: true })
        .where(eq(users.id, paymentProof.userId));
      
      // Trigger team registration completion if team data is available in session
      // This would need to be handled by the admin notification system
      console.log(`Payment approved for user ${paymentProof.userId}, team number ${paymentProof.teamNumber}`);
    }

    res.json({
      message: `Payment proof ${action}d successfully`,
      status: newStatus
    });

  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({
      error: "Failed to verify payment proof"
    });
  }
});

// Serve uploaded payment proof files (admin only)
router.get("/admin/file/:proofId", authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: "Admin access required"
      });
    }

    const { proofId } = req.params;

    // Get payment proof
    const proof = await db
      .select({ proofFilePath: paymentProofs.proofFilePath })
      .from(paymentProofs)
      .where(eq(paymentProofs.id, parseInt(proofId)))
      .limit(1);

    if (proof.length === 0 || !proof[0].proofFilePath) {
      return res.status(404).json({
        error: "Payment proof file not found"
      });
    }

    const filePath = proof[0].proofFilePath;
    
    // Check if file exists
    try {
      await fs.access(filePath);
      res.sendFile(path.resolve(filePath));
    } catch (error) {
      res.status(404).json({
        error: "File not found on disk"
      });
    }

  } catch (error) {
    console.error("Payment proof file serve error:", error);
    res.status(500).json({
      error: "Failed to serve payment proof file"
    });
  }
});

// Simple confirm endpoint (returns success for compatibility)
router.post("/confirm", (req, res) => {
  res.json({ success: true, message: "Payment confirmed" });
});

export default router;
