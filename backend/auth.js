const admin = require("./firebase");

/**
 * Middleware to authenticate Firebase ID tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @return {void}
 */
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No authentication token provided",
      });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid authentication token",
    });
  }
};

/**
 * Middleware to ensure user can only access their own data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @return {void}
 */
const authorizeUser = (req, res, next) => {
  try {
    const {uid: tokenUserId} = req.user;
    const requestUserId = req.params.userId || req.body.userId;

    if (!requestUserId) {
      return next();
    }

    if (tokenUserId !== requestUserId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    next();
  } catch (error) {
    console.error("Authorization error:", error);
    return res.status(403).json({
      success: false,
      message: "Authorization failed",
    });
  }
};

module.exports = {
  authenticateUser,
  authorizeUser,
};
