
import express from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log('🔐 [AUTH LOGIN] Tentativa de login iniciada');
    console.log('📝 [AUTH LOGIN] Username:', username);
    console.log('📝 [AUTH LOGIN] Password: ***');

    if (!username || !password) {
      console.log('❌ [AUTH LOGIN] Validação falhou - username ou password faltando');
      return res.status(400).json({ error: 'Username and password are required' });
    }

    console.log('✅ [AUTH LOGIN] Validação inicial passou');

    // Buscar usuário no banco
    console.log('🔍 [AUTH LOGIN] Buscando usuário no banco de dados...');
    const userQuery = 'SELECT * FROM users WHERE username = $1 AND active = true';
    const userResult = await pool.query(userQuery, [username]);

    console.log(`📊 [AUTH LOGIN] Usuários encontrados: ${userResult.rows.length}`);

    if (userResult.rows.length === 0) {
      console.log('❌ [AUTH LOGIN] Usuário não encontrado ou inativo');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];
    console.log(`✅ [AUTH LOGIN] Usuário encontrado: ${user.username} (ID: ${user.id}, Role: ${user.role})`);

    // Verificar senha (comparação direta, sem hash)
    console.log('🔐 [AUTH LOGIN] Verificando senha...');
    const passwordMatch = password === user.password;
    console.log(`🔍 [AUTH LOGIN] Senha correta: ${passwordMatch}`);

    if (!passwordMatch) {
      console.log('❌ [AUTH LOGIN] Senha incorreta');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('✅ [AUTH LOGIN] Autenticação bem-sucedida');

    // Gerar token JWT
    console.log('🎫 [AUTH LOGIN] Gerando token JWT...');
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

    console.log(`✅ [AUTH LOGIN] Login realizado com sucesso para: ${username}`);
    console.log('📤 [AUTH LOGIN] Enviando resposta com token e dados do usuário');

    res.json({
      token,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('❌ [AUTH LOGIN] Erro no login:', error);
    console.error('🔍 [AUTH LOGIN] Stack trace:', error.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verificar token
router.get('/verify', async (req, res) => {
  try {
    console.log('🎫 [AUTH VERIFY] Verificação de token iniciada');
    
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      console.log('❌ [AUTH VERIFY] Token não fornecido');
      return res.status(401).json({ error: 'No token provided' });
    }

    console.log('🔍 [AUTH VERIFY] Token recebido, verificando...');
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    console.log(`✅ [AUTH VERIFY] Token válido para usuário: ${decoded.username} (ID: ${decoded.userId})`);
    
    // Buscar dados atualizados do usuário
    console.log('🔍 [AUTH VERIFY] Buscando dados atualizados do usuário...');
    const userQuery = 'SELECT id, username, name, email, role, created_at FROM users WHERE id = $1 AND active = true';
    const userResult = await pool.query(userQuery, [decoded.userId]);

    if (userResult.rows.length === 0) {
      console.log(`❌ [AUTH VERIFY] Usuário não encontrado: ${decoded.userId}`);
      return res.status(401).json({ error: 'User not found' });
    }

    console.log(`✅ [AUTH VERIFY] Dados do usuário atualizados encontrados: ${userResult.rows[0].username}`);
    res.json({ user: userResult.rows[0] });

  } catch (error) {
    console.error('❌ [AUTH VERIFY] Erro na verificação do token:', error);
    console.error('🔍 [AUTH VERIFY] Stack trace:', error.stack);
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
