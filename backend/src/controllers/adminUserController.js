// backend/src/controllers/adminUserController.js
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const logger = require('../config/logger');

// Configurar Prisma con driver adapter (Prisma v7)
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Crea un nuevo usuario (TIENDA o LABORATORIO).
 * Solo accesible por ADMIN.
 */
const createUser = async (req, res) => {
  try {
    const { username, password, role, storeId, labId } = req.body;

    // 1. Validar campos obligatorios
    if (!username || !password || !role) {
      return res.status(400).json({ 
        error: 'Usuario, contraseña y rol son obligatorios.' 
      });
    }

    // 2. Validar que el rol sea válido (solo TIENDA o LABORATORIO)
    const validRoles = ['TIENDA', 'LABORATORIO'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        error: `Rol inválido. Debe ser uno de: ${validRoles.join(', ')}` 
      });
    }

    // 3. Validar que no se pueda crear otro ADMIN desde esta interfaz
    if (role === 'ADMIN') {
      return res.status(403).json({ 
        error: 'No se pueden crear usuarios ADMIN desde esta interfaz.' 
      });
    }

    // 4. Validar que el username no exista ya
    const existingUser = await prisma.user.findUnique({
      where: { username: username.toLowerCase() }
    });

    if (existingUser) {
      return res.status(409).json({ 
        error: 'Ya existe un usuario con ese nombre de usuario.' 
      });
    }

    // 5. Validar relaciones según el rol
    if (role === 'TIENDA' && !storeId) {
      return res.status(400).json({ 
        error: 'Los usuarios TIENDA deben estar asociados a una tienda (storeId).' 
      });
    }

    if (role === 'LABORATORIO' && !labId) {
      return res.status(400).json({ 
        error: 'Los usuarios LABORATORIO deben estar asociados a un laboratorio (labId).' 
      });
    }

    // 6. Validar que la tienda exista (si aplica)
    if (storeId) {
      const store = await prisma.store.findUnique({ where: { id: storeId } });
      if (!store) {
        return res.status(400).json({ 
          error: 'La tienda especificada no existe.' 
        });
      }
    }

    // 7. Validar que el laboratorio exista (si aplica)
    if (labId) {
      const lab = await prisma.lab.findUnique({ where: { id: labId } });
      if (!lab) {
        return res.status(400).json({ 
          error: 'El laboratorio especificado no existe.' 
        });
      }
    }

    // 8. Hashear la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // 9. Crear el usuario
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

    // 10. Responder sin exponer la contraseña
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
    return res.status(500).json({ 
      error: 'Error interno del servidor.' 
    });
  }
};

/**
 * Actualiza un usuario existente (username o estado activo).
 * Solo accesible por ADMIN.
 */
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, active } = req.body;

    // 1. Validar que el usuario exista
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({ 
        error: 'Usuario no encontrado.' 
      });
    }

    // 2. Preparar datos de actualización
    const updateData = {};

    // 3. Validar y preparar actualización de username
    if (username !== undefined) {
      if (!username || username.trim() === '') {
        return res.status(400).json({ 
          error: 'El nombre de usuario no puede estar vacío.' 
        });
      }

      // Verificar que el nuevo username no exista en otro usuario
      const userExists = await prisma.user.findFirst({
        where: {
          username: username.toLowerCase(),
          NOT: { id }
        }
      });

      if (userExists) {
        return res.status(409).json({ 
          error: 'Ya existe otro usuario con ese nombre de usuario.' 
        });
      }

      updateData.username = username.toLowerCase();
    }

    // 4. Validar y preparar actualización de estado activo
    if (active !== undefined) {
      if (typeof active !== 'boolean') {
        return res.status(400).json({ 
          error: 'El campo active debe ser un booleano (true/false).' 
        });
      }
      updateData.active = active;
    }

    // 5. Verificar que hay algo que actualizar
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        error: 'No se proporcionaron campos para actualizar.' 
      });
    }

    // 6. Actualizar el usuario
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData
    });

    logger.info(`✅ Usuario actualizado por Admin: ${updatedUser.username}`);

    // 7. Responder sin exponer la contraseña
    return res.status(200).json({
      message: 'Usuario actualizado exitosamente.',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        role: updatedUser.role,
        storeId: updatedUser.storeId,
        labId: updatedUser.labId,
        active: updatedUser.active,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      }
    });

  } catch (error) {
    logger.error(`❌ Error en updateUser: ${error.message}`);
    return res.status(500).json({ 
      error: 'Error interno del servidor.' 
    });
  }
};

/**
 * Resetea la contraseña de un usuario.
 * Solo accesible por ADMIN (RF-01.4 y RF-01.5).
 */
const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    // 1. Validar que se proporcione la nueva contraseña
    if (!newPassword) {
      return res.status(400).json({ 
        error: 'La nueva contraseña es obligatoria.' 
      });
    }

    // 2. Validar longitud mínima de la contraseña
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        error: 'La contraseña debe tener al menos 6 caracteres.' 
      });
    }

    // 3. Validar que el usuario exista
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({ 
        error: 'Usuario no encontrado.' 
      });
    }

    // 4. Hashear la nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 5. Actualizar la contraseña
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword }
    });

    logger.info(`✅ Contraseña reseteada por Admin para usuario: ${existingUser.username}`);

    // 6. Responder con éxito
    return res.status(200).json({
      message: 'Contraseña actualizada exitosamente.',
      user: {
        id: existingUser.id,
        username: existingUser.username,
        role: existingUser.role
      }
    });

  } catch (error) {
    logger.error(`❌ Error en resetPassword: ${error.message}`);
    return res.status(500).json({ 
      error: 'Error interno del servidor.' 
    });
  }
};

module.exports = { 
  createUser, 
  updateUser, 
  resetPassword 
};