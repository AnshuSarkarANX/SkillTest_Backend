function generateOTP() {
  // Hardcoded for testing - replace with service later
  return "123456";

  // Keep this commented for when you integrate a service
  // const crypto = require('crypto');
  // return crypto.randomInt(100000, 999999).toString();
}

module.exports = { generateOTP };
