const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  // Basic Information
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  lastName: {
    type: String,
    trim: true,
    default: '',
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: [/^[\w\.-]+@[\w\.-]+\.\w+$/, 'Please provide a valid email'],
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false,
  },

  // School/University Information
  school: {
    type: String,
    default: 'SkillLoop User',
    trim: true,
  },
  schoolEmail: {
    type: String,
    lowercase: true,
  },

  // Profile Information
  avatar: {
    type: String,
    default: null,
  },
  bio: {
    type: String,
    default: '',
    maxlength: 500,
  },

  // Skills & Expertise
  expertise: [
    {
      skill: {
        type: String,
        trim: true,
      },
      level: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'expert'],
        default: 'intermediate',
      },
      yearsOfExperience: {
        type: Number,
        min: 0,
      },
    },
  ],
  lookingToLearn: [
    {
      skill: {
        type: String,
        trim: true,
      },
      priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium',
      },
    },
  ],

  // Reputation & Ratings
  rating: {
    average: {
      type: Number,
      default: 5.0,
      min: 1,
      max: 5,
    },
    count: {
      type: Number,
      default: 0,
    },
  },
  isVerified: {
    type: Boolean,
    default: false,
  },

  // Account Status
  accountStatus: {
    type: String,
    enum: ['active', 'suspended', 'deleted', 'inactive'],
    default: 'active',
  },

  // Preferences
  notificationPreferences: {
    emailNotifications: {
      type: Boolean,
      default: true,
    },
    matchNotifications: {
      type: Boolean,
      default: true,
    },
    messageNotifications: {
      type: Boolean,
      default: true,
    },
  },
  profileVisibility: {
    type: String,
    enum: ['public', 'private', 'school-only'],
    default: 'public',
  },

  // Social & Connections
  followers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
  following: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
  blockedUsers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],

  // Activity Tracking
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: {
    type: Date,
    default: null,
  },

  // Account Statistics
  totalPostsCreated: {
    type: Number,
    default: 0,
  },
  totalMatches: {
    type: Number,
    default: 0,
  },
  totalMessagesExchanged: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// Method to get public profile (without sensitive data)
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.email;
  return userObject;
};

// Update timestamp on save
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create index on email for faster lookups
userSchema.index({ email: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;
