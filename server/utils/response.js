export const sendSuccess = (res, data, message = "OK", status = 200) => {
  return res.status(status).json({ success: true, message, data });
};

export const sendError = (res, message, status = 500, data = null) => {
  return res.status(status).json({ success: false, message, data });
};
