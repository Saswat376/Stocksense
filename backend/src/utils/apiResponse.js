export const apiResponse = (res, data, status = 200) => res.status(status).json({ data });
