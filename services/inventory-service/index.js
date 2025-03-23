// inventory-service/index.js
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Connect to MongoDB (use an "inventory" collection)
mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true });

// Define Inventory schema and model (each entry links to a product and has a quantity)
const InventorySchema = new mongoose.Schema({
  productId: mongoose.Types.ObjectId,
  quantity: Number
});
const Inventory = mongoose.model('Inventory', InventorySchema);

const JWT_SECRET = process.env.JWT_SECRET || 'mysecretkey';

// Auth middleware
function authenticateJWT(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}
function authorizeAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  next();
}

// List all inventory records (admin only)
app.get('/inventory', authenticateJWT, authorizeAdmin, async (req, res) => {
  const inventoryList = await Inventory.find();
  res.json(inventoryList);
});

// Get inventory for a specific product (open to allow checking stock by product)
app.get('/inventory/:productId', async (req, res) => {
  const record = await Inventory.findOne({ productId: req.params.productId });
  if (!record) return res.status(404).json({ productId: req.params.productId, quantity: 0 });
  res.json(record);
});

// Create new inventory record (admin only) – e.g., when adding a new product
app.post('/inventory', authenticateJWT, authorizeAdmin, async (req, res) => {
  const { productId, quantity } = req.body;
  const newRecord = new Inventory({ productId, quantity });
  await newRecord.save();
  res.status(201).json(newRecord);
});

// Update inventory for a product (admin only)
app.put('/inventory/:productId', authenticateJWT, authorizeAdmin, async (req, res) => {
  const { quantity } = req.body;
  const updated = await Inventory.findOneAndUpdate(
    { productId: req.params.productId },
    { quantity },
    { new: true }
  );
  if (!updated) {
    return res.sendStatus(404);
  }
  res.json(updated);
});

// Delete an inventory record (admin only)
app.delete('/inventory/:productId', authenticateJWT, authorizeAdmin, async (req, res) => {
  await Inventory.findOneAndDelete({ productId: req.params.productId });
  res.json({ message: 'Inventory record deleted' });
});

app.listen(5003, () => {
  console.log('Inventory service listening on port 5003');
});
