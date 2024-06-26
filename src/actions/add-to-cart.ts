"use server";

import { cookies } from "next/headers";
import { customAlphabet } from "nanoid";
import {
  getDocs,
  collection,
  query,
  where,
  addDoc,
  updateDoc,
  serverTimestamp,
  setDoc,
  doc,
} from "firebase/firestore";
import { database } from "@/libraries/firebase";
import { revalidatePath } from "next/cache";

export async function AddToCartAction({
  id,
  size,
  color,
}: {
  id: string;
  size: string;
  color: string;
}) {
  const generateNewCart = async () => {
    try {
      const newDeviceIdentifier = customAlphabet(
        "1234567890abcdefghijklmnopqrstuvwxyz",
        32
      )();

      cookies().set({
        name: "device_identifier",
        value: newDeviceIdentifier,
        httpOnly: true,
        path: "/",
      });

      const cartId = customAlphabet("1234567890", 5)();
      const newCartData = {
        device_identifier: newDeviceIdentifier,
        products: [{ id, size, color }],
        date_created: serverTimestamp(),
        last_updated: serverTimestamp(),
      };
      const newCartDocRef = doc(collection(database, "carts"), cartId);
      await setDoc(newCartDocRef, newCartData);

      revalidatePath("/[slug]", "page");

      return {
        success: true,
        message: "Item added to cart",
      };
    } catch (error) {
      console.error("Error generating new cart:", error);
      return {
        success: false,
        message: "Internal Server Error",
      };
    }
  };

  const deviceIdentifier = cookies().get("device_identifier")?.value;

  if (!deviceIdentifier) {
    return await generateNewCart();
  }

  try {
    const collectionRef = collection(database, "carts");
    const snapshot = await getDocs(
      query(collectionRef, where("device_identifier", "==", deviceIdentifier))
    );

    if (snapshot.empty) {
      // If cart not found, generate a new one
      return await generateNewCart();
    } else {
      // If cart found, check if the product is already in the cart
      const cartDoc = snapshot.docs[0].ref;
      const existingProducts = snapshot.docs[0].data().products;

      const existingProductIndex = existingProducts.findIndex(
        (product: { id: string; size: string; color: string }) =>
          product.id === id
      );

      if (existingProductIndex !== -1) {
        // Product already in cart, update its size and color
        existingProducts[existingProductIndex] = { id, size, color };
      } else {
        // Product not in cart, add it to the existing products
        existingProducts.push({ id, size, color });
      }

      await updateDoc(cartDoc, {
        products: existingProducts,
        last_updated: serverTimestamp(),
      });

      revalidatePath("/[slug]", "page");

      return {
        success: true,
        message: "Item added to cart",
      };
    }
  } catch (error) {
    console.error("Error adding product to cart:", error);
    return {
      success: false,
      message: "Internal Server Error",
    };
  }
}
