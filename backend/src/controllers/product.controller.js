import { createProduct, getAllProducts } from '../services/product.service.js';

export async function listProducts(req, res, next) {
  try {
    const products = await getAllProducts();
    res.json(products);
  } catch (err) {
    next(err);
  }
}

export async function createNewProduct(req, res, next) {
  try {
    // Basic validation
    const { name, sku } = req.body;
    if (!name || !sku) {
      return res.status(400).json({ error: 'Name and SKU are required' });
    }

    const product = await createProduct(req.body, req.user.id);
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
}
