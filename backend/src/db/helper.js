const { ObjectId } = require('mongodb');

function asId(v) {
  if (!v) return null;
  try {
    return v instanceof ObjectId ? v : new ObjectId(String(v));
  } catch {
    return null;
  }
}

function isNonEmptyString(s) {
  return typeof s === 'string' && s.trim().length > 0;
}

module.exports = { asId, isNonEmptyString, ObjectId };
