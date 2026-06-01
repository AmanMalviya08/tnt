const express = require("express");
const CartController = require("../controller/cartController");
const cartModel = require("../models/cartModel");

const router = express.Router();
const cartController = new CartController(cartModel);

router.post("/", async (req, res) => {
  try {
    const cart = await cartController.addToCart(req.body);
    // cart=1;

    if (!cart) {
      return res.status(404).json({ success: false, message: "Failed to add item to cart" });
    }

    res.status(200).json({
      success: true,
      data: cart,
      message: "Item added to cart successfully",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const cart = await cartController.getCart(userId);

    res.status(200).json({
      success: true,
      data: cart.data,
      totalItems: cart.totalItems,
      totalPrice: cart.totalPrice,
      message: "Cart fetched successfully",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.patch("/:userId/:cartId", async (req, res) => {
  try {
    const { userId  , cartId} = req.params;
    const cart = await cartController.updateCartItem({
      userId,
      cartId,
      ...req.body,
    });

    res.status(200).json({
      success: true,
      data: cart,
      message: "Cart item updated successfully",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete("/:userId/:cartId", async (req, res) => {
  try {
    const { userId, cartId } = req.params;
    const cart = await cartController.removeFromCart(userId, cartId);

    res.status(200).json({
      success: true,
      data: cart,
      message: "Item removed from cart successfully",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const cart = await cartController.clearCart(userId);

    res.status(200).json({
      success: true,
      data: cart,
      message: "Cart cleared successfully",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;