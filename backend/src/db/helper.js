//Imports
const { ObjectId } = require('mongodb');

//Helper to force values into valid ObjectID
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

//return strings with non whitespace
function isNonEmptyString(x) {
  return typeof x === 'string' && x.trim().length > 0;
}

//export helpers
module.exports = { asId, isNonEmptyString };
