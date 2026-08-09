function resolveProductConflict(existingProduct, allowOverwrite) {
  if (!existingProduct) {
    return { action: 'create' };
  }

  if (allowOverwrite) {
    return { action: 'update', existingProductId: existingProduct.id };
  }

  return { action: 'reject', existingProduct };
}

module.exports = { resolveProductConflict };
