const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyAuth, isLoggedIn } = require('../middleware/auth');

// Public routes
router.post('/signup', authController.signup);
router.post('/signin', authController.signin);

// Protected routes
router.post('/signout', verifyAuth, authController.signout);
router.get('/me', verifyAuth, authController.getMe);
router.put('/update-password', verifyAuth, authController.updatePassword);

module.exports = router;
