import { createReceipt } from '../services/receipt.service.js';
import { createDelivery } from '../services/delivery.service.js';
import { createTransfer } from '../services/transfer.service.js';
import { createAdjustment } from '../services/adjustment.service.js';
import { validateMove } from '../services/stock.service.js';

// Helper to auto-validate move after creation for testing purposes
async function handleOperation(req, res, next, serviceFn) {
  try {
    const result = await serviceFn(req.body, req.user.id);
    
    // Auto-validate for simplicity in this phase, 
    // in a real app this might be a separate API call (e.g. POST /moves/:id/validate)
    if (result.id) {
       await validateMove(result.id);
    } else if (result.moveIds) {
       for (const mid of result.moveIds) {
           await validateMove(mid);
       }
    }
    
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export const receiveGoods = (req, res, next) => handleOperation(req, res, next, createReceipt);
export const deliverGoods = (req, res, next) => handleOperation(req, res, next, createDelivery);
export const transferGoods = (req, res, next) => handleOperation(req, res, next, createTransfer);
export const adjustStock = (req, res, next) => handleOperation(req, res, next, createAdjustment);
