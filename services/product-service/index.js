// product-service/index.js
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Connect to MongoDB (use a "products" collection)
mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true });

// Define Product schema and model
const ProductSchema = new mongoose.Schema({
  name: String,
  price: Number,
  description: String,
  category: String,
  stock: Number            // stock quantity; could also be managed separately by inventory service
});
const Product = mongoose.model('Product', ProductSchema);

// JWT setup
const JWT_SECRET = process.env.JWT_SECRET || 'mysecretkey';
function authenticateJWT(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();  // allow no-token for public GET requests
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}
function authorizeAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.sendStatus(403);
  }
  next();
}

// Routes
// List or search products (public)
app.get('/products', authenticateJWT, async (req, res) => {
  const query = {};
  if (req.query.search) {
    // Case-insensitive search on name or description
    query.$or = [
      { name: new RegExp(req.query.search, 'i') },
      { description: new RegExp(req.query.search, 'i') }
    ];
  }
  const products = await Product.find(query);
  res.json(products);
});

// Get single product by ID (public)
app.get('/products/:id', authenticateJWT, async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.sendStatus(404);
  res.json(product);
});

// Create new product (admin only)
app.post('/products', authenticateJWT, authorizeAdmin, async (req, res) => {
  try {
    const newProd = new Product(req.body);
    await newProd.save();
    res.status(201).json(newProd);
  } catch (err) {
    res.status(400).json({ error: 'Product creation failed' });
  }
});

// Update product (admin only)
app.put('/products/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  const updated = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!updated) return res.sendStatus(404);
  res.json(updated);
});

// Delete product (admin only)
app.delete('/products/:id', authenticateJWT, authorizeAdmin, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ message: 'Product deleted' });
});

// Start the server
app.listen(5001, () => {
  console.log('Product service listening on port 5001');
});
