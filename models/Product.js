const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  productType: {
    type: String,
    required: true,
    enum: [
      // Cement
      'Cement (CEM II N)',
      'Cement (CEM III N)',
      // Iron bars
      'Iron Bar 10mm',
      'Iron Bar 12mm',
      'Iron Bar 16mm',
      // Nails (5kg packs)
      'Nails 1 inch (5kg)',
      'Nails 3 inch (5kg)',
      'Nails 4 inch (5kg)',
      'Nails 5 inch (5kg)',
      'Roofing Nails (5kg)',
      // Equipment
      'Wheelbarrow',
      'Wire Mesh',
      // Barbed wire
      'Barbed Wire (High Tensile)',
      'Barbed Wire (Low Tensile)',
      // Iron sheets
      'Iron Sheet (Blue)',
      'Iron Sheet (Red)',
      'Iron Sheet (Green)',
      'Iron Sheet (White)',
      'Iron Sheet (Brown)'
    ]
  },
  category: { 
    type: String 
  },
  unitCost: { 
    type: Number, 
    required: true 
  },
  unitPrice: { 
    type: Number, 
    required: true 
  },
  currentStock: { 
    type: Number, 
    default: 0 
  },
  reorderLevel: { 
    type: Number, 
    default: 15 
  },
  supplier: String,
  sku: String,
  description: String,
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Virtual or derived productName (optional)
productSchema.virtual('productName').get(function() {
  return this.productType;
});

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);