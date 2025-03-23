// user-service/index.js
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Connect to MongoDB (use a "users" collection in the database)
mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true });

// Define User schema and model
const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,       // will store hashed password
  role: { type: String, default: 'client' }  // "client" or "admin"
});
const User = mongoose.model('User', UserSchema);

// JWT secret (shared across services)
const JWT_SECRET = process.env.JWT_SECRET || 'mysecretkey';

// Middleware to authenticate token and attach user to request
function authenticateJWT(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;  // user contains decoded token (e.g., id and role)
    next();
  });
}

// Middleware to authorize only admin role
function authorizeAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.sendStatus(403);
  }
  next();
}

// Registration endpoint (open)
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    // Hash the password before saving for security
    const hashedPw = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPw });  // role defaults to 'client'
    await newUser.save();
    return res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: 'Registration failed' });
  }
});

// Login endpoint (open)
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  // Check password
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  // Create a JWT containing user ID and role
  const token = jwt.sign(
    { id: user._id, role: user.role, name: user.name }, 
    JWT_SECRET, 
    { expiresIn: '1h' }
  );
  res.json({ token, role: user.role, name: user.name });
});

// Get all users (admin only)
app.get('/users', authenticateJWT, authorizeAdmin, async (req, res) => {
  const users = await User.find().select('-password');  // exclude password hash
  res.json(users);
});

// (Optional) other user management routes (admin only)
app.get('/users/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) return res.sendStatus(404);
  res.json(user);
});
app.put('/users/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  const updated = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
  res.json(updated);
});
app.delete('/users/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ message: 'User deleted' });
});

// Start the server
app.listen(5004, () => {
  console.log('User service listening on port 5004');
});
