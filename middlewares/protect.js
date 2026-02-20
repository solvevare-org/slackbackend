import jwt from "jsonwebtoken";

const protect = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || req.cookies?.token || '';
        if (!authHeader) return res.status(401).json({ msg: 'Unauthorized' });

        // support header `Bearer <token>` or direct token
        const parts = authHeader.split(' ');
        const token = parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : parts[0];
        if (!token) return res.status(401).json({ msg: 'Unauthorized' });

        const payload = jwt.verify(token, process.env.ACCESS_SECRET);
        req.user = payload;
        return next();
    } catch (err) {
        return res.status(401).json({ msg: 'Unauthorized' });
    }
};

export default protect;