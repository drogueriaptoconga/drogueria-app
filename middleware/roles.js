// middleware/roles.js
module.exports = {
    denyIfAsesor: (req, res, next) => {
        const role = (req.get('x-user-role') || '').toLowerCase();
        if (role === 'asesor') {
            return res.status(403).json({ error: 'Acceso denegado.' });
        }
        next();
    },
    requireAdmin: (req, res, next) => {
        const role = (req.get('x-user-role') || '').toLowerCase();
        if (role !== 'admin') {
            return res.status(403).json({ error: 'Se requieren privilegios de administrador.' });
        }
        next();
    }
};
