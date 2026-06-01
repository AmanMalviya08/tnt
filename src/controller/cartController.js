const cartModel = require("../models/cartModel");
const { packageModel } = require("../models/packageModel");

class CartController {
    constructor(model = cartModel) {
        this.model = model;
    }

    async addToCart(payload) {
        let { userId, packageId, quantity = "1", adults = "1", children = "0", checkInDate, selectedAddOns = [] } = payload;

        if (!checkInDate) {
            throw new Error("checkInDate is required");
        }

        quantity = parseInt(quantity, 10);
        adults = parseInt(adults, 10);
        children = parseInt(children, 10);
        if (!userId || typeof userId !== "string" || !userId.trim()) {
            throw new Error("userId is required and must be a non-empty string");
        }

        if (!packageId || typeof packageId !== "string" || !packageId.trim()) {
            throw new Error("packageId is required and must be a non-empty string");
        }
        if (isNaN(quantity) || quantity < 1) {
            throw new Error("quantity must be a positive number");
        }

        if (isNaN(adults) || adults < 1) {
            throw new Error("adults must be at least 1");
        }

        if (isNaN(children) || children < 0) {
            throw new Error("children cannot be negative");
        }
        const checkInDateTime = new Date(checkInDate).getTime()
        // console.log(checkInDate ,"check in date ")
        let today = new Date();
        today.setHours(0, 0, 0, 0)
        const todayTime = today.getTime()
        // console.log(todayTime)
        if (isNaN(checkInDateTime)) {
            throw new Error("Invalid checkInDate format");
        }

        if (checkInDateTime < todayTime) {
            throw new Error("checkInDate cannot be in the past");
        }

        if (!Array.isArray(selectedAddOns)) {
            throw new Error("selectedAddOns must be an array");
        }

        let cartDocument = await this.model.findOne({ userId });

        if (!cartDocument) {
            cartDocument = await this.model.create({
                userId,
                items: [
                    {
                        packageId,
                        quantity,
                        adults,
                        children,
                        checkInDate: new Date(checkInDate),
                        selectedAddOns,
                    },
                ],
            });
            return await cartDocument.populate("items.packageId");
        }


        cartDocument.items.push({
            packageId,
            quantity,
            adults,
            children,
            checkInDate: new Date(checkInDate),
            selectedAddOns,
        });

        await cartDocument.save();
        return await this.model.findOne({ userId }).populate("items.packageId");
    }
    async getCart(userId) {
        const cart = await this.model.findOne({ userId }).populate("items.packageId").lean()

        if (!cart ||  !cart.items?.length) {
            return {
                data: [],
                totalItems: 0,
                totalPrice: 0,
            };
        }

        let totalPrice = 0;
        cart.items.forEach((item) => {
            const basePrice = item.packageId.basePricePerPerson;
            const childPrice = item.packageId.childPrice || basePrice;
            const addOnsTotal = item.selectedAddOns.reduce((sum, addOn) => sum + addOn.price, 0);
               const quantity=item.quantity;

            const itemTotal =
                (basePrice * item.adults + childPrice * item.children + addOnsTotal)*quantity

            item.itemTotal = itemTotal
            totalPrice += itemTotal;
        });

        return {
            data: cart,
            totalItems: cart.items.length,
            totalPrice,
        };
    }

    async updateCartItem(payload) {
        const { userId, cartId, quantity, adults, children, checkInDate, selectedAddOns } = payload;


        const parsedQuantity = quantity ? parseInt(quantity, 10) : null;
        const parsedAdults = adults ? parseInt(adults, 10) : null;
        const parsedChildren = children !== undefined ? parseInt(children, 10) : null;
        const parsedPrice = selectedAddOns
            ? selectedAddOns.map((addOn) => ({
                ...addOn,
                price: parseFloat(addOn.price),
            }))
            : null;

        if (parsedQuantity !== null && (isNaN(parsedQuantity) || parsedQuantity < 1)) {
            throw new Error("quantity must be a positive number");
        }

        if (parsedAdults !== null && (isNaN(parsedAdults) || parsedAdults < 1)) {
            throw new Error("adults must be at least 1");
        }

        if (parsedChildren !== null && (isNaN(parsedChildren) || parsedChildren < 0)) {
            throw new Error("children cannot be negative");
        }

        if (checkInDate) {
            const checkInDateTime = new Date(checkInDate).getTime();
            if (isNaN(checkInDateTime)) {
                throw new Error("Invalid checkInDate format");
            }
        }

        const updateData = {};
        if (parsedQuantity !== null) updateData["items.$.quantity"] = parsedQuantity;
        if (parsedAdults !== null) updateData["items.$.adults"] = parsedAdults;
        if (parsedChildren !== null) updateData["items.$.children"] = parsedChildren;
        if (checkInDate) updateData["items.$.checkInDate"] = new Date(checkInDate);
        if (parsedPrice) updateData["items.$.selectedAddOns"] = parsedPrice;

        const cart = await this.model.findOneAndUpdate(
            { userId, "items._id": cartId },
            { $set: updateData },
            { new: true }
        ).populate("items.packageId").lean();

        if (!cart) {
            throw new Error("Cart or item not found");
        }
          let totalPrice = 0;
       cart.items.forEach((item) => {
            const basePrice = item.packageId.basePricePerPerson;
            const childPrice = item.packageId.childPrice || basePrice;
            const addOnsTotal = item.selectedAddOns.reduce((sum, addOn) => sum + addOn.price, 0);
               const quantity=item.quantity;
               console.log(item.quantity)
            const itemTotal =
                (basePrice * item.adults + childPrice * item.children + addOnsTotal)*quantity
      
            item.itemTotal = itemTotal
            console.log(item.itemTotal)
            totalPrice += itemTotal;
        });

       return {
            data: cart,
            totalItems: cart.items.length,
            totalPrice,
        };
    }

    async removeFromCart(userId, cartId) {
        const cart = await this.model.findOne({ userId: userId, "items._id": cartId });

        if (!cart) {
            throw new Error("Cart not found");
        }

        const updatedCart = await this.model.findOneAndUpdate({
            userId
        },
            {
                $pull: {
                    items: {
                        _id: cartId
                    }
                }

            },
            { new: true }
        )
        return updatedCart
    }

    async clearCart(userId) {

        const clearCart = await this.model.findOneAndUpdate({
            userId
        },
            {
                $set: {
                    items: []
                }
            },
            { new: true }
        )
        return clearCart

    }
}
module.exports = CartController;