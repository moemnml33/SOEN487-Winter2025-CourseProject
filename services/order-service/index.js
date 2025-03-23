// order-service/index.js
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const cors = require('cors');
// const axios = require('axios'); // (Optional, for calling inventory service if needed)

const app = express();
app.use(express.json());
app.use(cors());

// Connect to MongoDB (use an "orders" collection)
mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true });

// Define Order schema and model
const OrderSchema = new mongoose.Schema({
  userId: mongoose.Types.ObjectId,
  items: [ 
    { productId: mongoose.Types.ObjectId, quantity: Number } 
  ],
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', OrderSchema);

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

// Create new order (any authenticated user)
app.post('/orders', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const items = req.body.items;
    // (Optional) Check inventory for each item by calling Inventory service before creating order
    // for (let item of items) {
    //   await axios.post(`http://inventory-service:5003/inventory/reserve`, { 
    //     productId: item.productId, quantity: item.quantity 
    //   });
    // }
    const order = new Order({ userId, items });
    await order.save();
    res.status(201).json(order);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Could not create order' });
  }
});

// Get all orders (admin only)
app.get('/orders', authenticateJWT, authorizeAdmin, async (req, res) => {
  const orders = await Order.find();
  res.json(orders);
});

// Get a single order by ID (admin only for now)
app.get('/orders/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.sendStatus(404);
  res.json(order);
});

// Update order (admin only, e.g., update status)
app.put('/orders/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  const updated = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!updated) return res.sendStatus(404);
  res.json(updated);
});

// Delete order (admin only)
app.delete('/orders/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  await Order.findByIdAndDelete(req.params.id);
  res.json({ message: 'Order deleted' });
});

app.listen(5002, () => {
  console.log('Order service listening on port 5002');
});
