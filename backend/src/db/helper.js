const { ObjectId } = require('mongodb');

function asId(val) {
  if (!val) return null;
  try {
    if (val instanceof ObjectId) return val;
    if (typeof val === 'string' && ObjectId.isValid(val)) {
      return new ObjectId(val);
    }
    return null;
  } catch {
    return null;
  }
}

function isNonEmptyString(x) {
  return typeof x === 'string' && x.trim().length > 0;
}

module.exports = { asId, isNonEmptyString };
