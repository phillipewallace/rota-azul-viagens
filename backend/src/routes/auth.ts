
import express from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log('🔐 Tentativa de login:', { username, password: '***' });

    if (!username || !password) {
      console.log('❌ Username ou password faltando');
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Buscar usuário no banco
    const userQuery = 'SELECT * FROM users WHERE username = $1 AND active = true';
    const userResult = await pool.query(userQuery, [username]);

    console.log('👤 Usuário encontrado:', userResult.rows.length > 0);

    if (userResult.rows.length === 0) {
      console.log('❌ Usuário não encontrado ou inativo');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];
    console.log('🔍 Dados do usuário:', { id: user.id, username: user.username, role: user.role });

    // Verificar senha (comparação direta, sem hash)
    console.log('🔐 Verificando senha...');
    const passwordMatch = password === user.password;
    console.log('✅ Senha correta:', passwordMatch);

    if (!passwordMatch) {
      console.log('❌ Senha incorreta');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Gerar token JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username,
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Retornar dados do usuário (sem a senha)
    const { password: userPassword, ...userWithoutPassword } = user;

    console.log('✅ Login realizado com sucesso para:', username);

    res.json({
      token,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('❌ Erro no login:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verificar token
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Buscar dados atualizados do usuário
    const userQuery = 'SELECT id, username, name, email, role, created_at FROM users WHERE id = $1 AND active = true';
    const userResult = await pool.query(userQuery, [decoded.userId]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({ user: userResult.rows[0] });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
