// backend/src/controllers/adminUserController.js
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const logger = require('../config/logger');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Obtiene todos los usuarios del sistema.
 */
const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        active: true,
        storeId: true,
        labId: true,
        createdAt: true,
        store: { select: { id: true, name: true, accn: true } },
        lab: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ users });
  } catch (error) {
    logger.error(`[getUsers] Error: ${error.message}`);
    return res.status(500).json({ error: 'Error al obtener los usuarios.' });
  }
};

/**
 * Crea un nuevo usuario (TIENDA o LABORATORIO).
 */
const createUser = async (req, res) => {
  try {
    const { username, password, role, storeId, labId } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Usuario, contraseña y rol son obligatorios.' });
    }

    const validRoles = ['TIENDA', 'LABORATORIO'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Rol inválido. Debe ser uno de: ${validRoles.join(', ')}` });
    }

    if (role === 'ADMIN') {
      return res.status(403).json({ error: 'No se pueden crear usuarios ADMIN desde esta interfaz.' });
    }

    const existingUser = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    if (existingUser) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese nombre de usuario.' });
    }

    if (role === 'TIENDA' && !storeId) {
      return res.status(400).json({ error: 'Los usuarios TIENDA deben estar asociados a una tienda (storeId).' });
    }
    if (role === 'LABORATORIO' && !labId) {
      return res.status(400).json({ error: 'Los usuarios LABORATORIO deben estar asociados a un laboratorio (labId).' });
    }

    if (storeId) {
      const store = await prisma.store.findUnique({ where: { id: storeId } });
      if (!store) return res.status(400).json({ error: 'La tienda especificada no existe.' });
    }
    if (labId) {
      const lab = await prisma.lab.findUnique({ where: { id: labId } });
      if (!lab) return res.status(400).json({ error: 'El laboratorio especificado no existe.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        username: username.toLowerCase(),
        password: hashedPassword,
        role,
        storeId: storeId || null,
        labId: labId || null,
        active: true
      }
    });

    logger.info(`✅ Usuario creado por Admin: ${newUser.username} (${role})`);

    return res.status(201).json({
      message: 'Usuario creado exitosamente.',
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        storeId: newUser.storeId,
        labId: newUser.labId,
        active: newUser.active,
        createdAt: newUser.createdAt
      }
    });
  } catch (error) {
    logger.error(`❌ Error en createUser: ${error.message}`);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

/**
 * Actualiza un usuario existente (username o estado activo).
 */
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, active } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const updateData = {};

    if (username !== undefined) {
      if (!username || username.trim() === '') {
        return res.status(400).json({ error: 'El nombre de usuario no puede estar vacío.' });
      }
      const userExists = await prisma.user.findFirst({
        where: { username: username.toLowerCase(), NOT: { id } }
      });
      if (userExists) {
        return res.status(409).json({ error: 'Ya existe otro usuario con ese nombre de usuario.' });
      }
      updateData.username = username.toLowerCase();
    }

    if (active !== undefined) {
      if (typeof active !== 'boolean') {
        return res.status(400).json({ error: 'El campo active debe ser un booleano (true/false).' });
      }
      updateData.active = active;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron campos para actualizar.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData
    });

    logger.info(`✅ Usuario actualizado por Admin: ${updatedUser.username}`);

    return res.status(200).json({
      message: 'Usuario actualizado exitosamente.',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        role: updatedUser.role,
        active: updatedUser.active
      }
    });
  } catch (error) {
    logger.error(`❌ Error en updateUser: ${error.message}`);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

/**
 * Resetea la contraseña de un usuario.
 */
const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
    }

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword }
    });

    logger.info(`✅ Contraseña reseteada por Admin para usuario: ${existingUser.username}`);

    return res.status(200).json({
      message: 'Contraseña actualizada exitosamente.',
      user: { id: existingUser.id, username: existingUser.username, role: existingUser.role }
    });
  } catch (error) {
    logger.error(`❌ Error en resetPassword: ${error.message}`);
    return res.status(500).json({ error: 'Error interno delฯ servidor.' });
  }
};

module.exports = {
  getUsers,      // ← NUEVO
  createUser,
  updateUser,
  resetPassword
};