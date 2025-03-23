// frontend/src/components/Checkout.js
import React, { useContext } from 'react';
import { CartContext } from '../CartContext';
import { AuthContext } from '../AuthContext';  // holds auth info like token

function Checkout() {
  const { cartItems, clearCart } = useContext(CartContext);
  const { token } = useContext(AuthContext);

  const handleCheckout = () => {
    if (!token) {
      alert('Please log in to place an order');
      return;
    }
    // Prepare order data (e.g., product IDs and quantities)
    const orderData = {
      items: cartItems.map(item => ({ productId: item._id, quantity: item.quantity || 1 }))
    };
    fetch('http://localhost:5002/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`  // include JWT for authentication
      },
      body: JSON.stringify(orderData)
    })
      .then(res => {
        if (!res.ok) throw new Error('Order failed');
        return res.json();
      })
      .then(data => {
        alert('Order placed successfully! Order ID: ' + data._id);
        clearCart();  // empty the cart after successful checkout
      })
      .catch(err => console.error('Checkout error:', err));
  };

  return (
    <div>
      <h2>Checkout</h2>
      {/* Display cart summary */}
      <ul>
        {cartItems.map(item => (
          <li key={item._id}>{item.name} x {item.quantity || 1}</li>
        ))}
      </ul>
      <button onClick={handleCheckout}>Confirm Order</button>
    </div>
  );
}

export default Checkout;
