import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { pool } from '../config/database';
import { JWT_SECRET } from '../middleware/requireAuth';

const router = express.Router();

const BCRYPT_ROUNDS = 10;
const isBcryptHash = (s: string) => typeof s === 'string' && /^\$2[aby]\$/.test(s);

// Login endpoint — aceita username (users) OU CPF (funcionários com acesso ao Ponto).
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // 1) Tenta como usuário do sistema principal
    const userQuery = 'SELECT * FROM users WHERE username = $1 AND active = true';
    const userResult = await pool.query(userQuery, [username]);

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      let passwordMatch = false;
      if (isBcryptHash(user.password)) {
        passwordMatch = await bcrypt.compare(password, user.password);
      } else {
        passwordMatch = password === user.password;
        if (passwordMatch) {
          try {
            const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
            await pool.query('UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hashed, user.id]);
          } catch (e) { console.error('⚠️  [AUTH] Falha ao migrar hash:', e); }
        }
      }
      if (!passwordMatch) return res.status(401).json({ error: 'Invalid credentials' });

      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      const { password: _pw, ...userWithoutPassword } = user;
      return res.json({ token, user: userWithoutPassword });
    }

    // 2) Tenta como funcionário (login por CPF — só acessa o Ponto)
    const cpfDigits = String(username).replace(/\D/g, '');
    if (cpfDigits.length >= 11) {
      const funcRes = await pool.query(
        `SELECT * FROM funcionarios
         WHERE regexp_replace(coalesce(cpf,''), '\\D', '', 'g') = $1
           AND status = 'ativo' AND password_hash IS NOT NULL
         LIMIT 1`,
        [cpfDigits]
      );
      if (funcRes.rows.length > 0) {
        const f = funcRes.rows[0];
        const ok = await bcrypt.compare(password, f.password_hash);
        if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign(
          { userId: f.id, username: f.cpf, role: 'funcionario', funcionario_id: f.id },
          JWT_SECRET,
          { expiresIn: '12h' }
        );
        return res.json({
          token,
          user: {
            id: f.id,
            username: f.cpf,
            name: f.nome,
            email: f.email,
            role: 'funcionario',
            funcionario_id: f.id,
          },
        });
      }
    }

    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (error) {
    console.error('❌ [AUTH LOGIN] Erro:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verificar token
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (decoded.role === 'funcionario') {
      const r = await pool.query(
        `SELECT id, nome AS name, cpf AS username, email FROM funcionarios
         WHERE id = $1 AND status = 'ativo'`,
        [decoded.userId]
      );
      if (!r.rows.length) return res.status(401).json({ error: 'User not found' });
      return res.json({ user: { ...r.rows[0], role: 'funcionario', funcionario_id: r.rows[0].id } });
    }

    const userQuery = 'SELECT id, username, name, email, role, created_at FROM users WHERE id = $1 AND active = true';
    const userResult = await pool.query(userQuery, [decoded.userId]);
    if (userResult.rows.length === 0) return res.status(401).json({ error: 'User not found' });
    res.json({ user: userResult.rows[0] });
  } catch (error) {
    console.error('❌ [AUTH VERIFY] Erro:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});


// Verificar token
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userQuery = 'SELECT id, username, name, email, role, created_at FROM users WHERE id = $1 AND active = true';
    const userResult = await pool.query(userQuery, [decoded.userId]);
    if (userResult.rows.length === 0) return res.status(401).json({ error: 'User not found' });
    res.json({ user: userResult.rows[0] });
  } catch (error) {
    console.error('❌ [AUTH VERIFY] Erro:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
