function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Debes iniciar sesión.' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'No tienes permisos para realizar esta acción.' });
        }

        next();
    };
}

const requireAdmin = requireRole('admin');
const requireSellerOrAdmin = requireRole('admin', 'vendedor');

module.exports = {
    requireRole,
    requireAdmin,
    requireSellerOrAdmin,
    denyIfAsesor: requireAdmin
};
