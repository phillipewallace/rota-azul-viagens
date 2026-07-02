import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get all drivers
router.get('/', async (req, res) => {
  try {
    console.log('👥 [DRIVERS GET] Iniciando busca por todos os motoristas...');
    
    const query = `
      SELECT 
        d.id,
        d.name,
        d.license_number,
        d.license_category,
        d.phone,
        d.email,
        d.hire_date,
        d.status,
        d.created_at,
        COUNT(t.id) as truck_count,
        MAX(t.current_route::text) as current_route,
        0 as total_trips
      FROM drivers d
      LEFT JOIN trucks t ON d.id = t.current_driver_id
      GROUP BY d.id, d.name, d.license_number, d.license_category, d.phone, d.email, d.hire_date, d.status, d.created_at
      ORDER BY d.created_at DESC
    `;
    
    console.log('🔍 [DRIVERS GET] Executando query no banco de dados...');
    const result = await pool.query(query);
    console.log(`📊 [DRIVERS GET] Query executada com sucesso, ${result.rows.length} registros encontrados`);
    
    const drivers = result.rows.map(driver => ({
      id: driver.id,
      name: driver.name,
      license: driver.license_number,
      licenseCategory: driver.license_category,
      phone: driver.phone,
      email: driver.email,
      hireDate: driver.hire_date,
      status: driver.status,
      currentRoute: driver.current_route,
      totalTrips: driver.total_trips || 0,
      truckCount: parseInt(driver.truck_count) || 0,
      source: 'driver' as const,
    }));

    // Também expõe funcionários com cargo Motorista (somente-leitura aqui).
    try {
      const fRes = await pool.query(
        `SELECT id, nome, cpf, telefone, email, admissao, status
           FROM funcionarios
          WHERE cargo = 'Motorista'
          ORDER BY nome ASC`
      );
      for (const f of fRes.rows) {
        drivers.push({
          id: `func:${f.id}`,
          name: f.nome,
          license: f.cpf || '',
          licenseCategory: undefined,
          phone: f.telefone || '',
          email: f.email || '',
          hireDate: f.admissao,
          status: f.status === 'ativo' ? 'active' : 'inactive',
          currentRoute: undefined,
          totalTrips: 0,
          truckCount: 0,
          source: 'funcionario' as const,
        } as any);
      }
    } catch (err) {
      console.warn('[DRIVERS GET] Falha ao anexar funcionários-motoristas:', (err as Error).message);
    }

    res.json(drivers);

  } catch (error) {
    console.error('❌ [DRIVERS GET] Erro ao buscar motoristas:', error);
    console.error('🔍 [DRIVERS GET] Stack trace:', (error as Error).stack);
    res.status(500).json({ error: 'Erro ao buscar motoristas' });
  }
});

// Get single driver by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`👤 [DRIVER GET] Buscando motorista por ID: ${id}`);
    
    const query = `
      SELECT 
        d.*,
        COUNT(t.id) as truck_count,
        COUNT(tr.id) as trip_count
      FROM drivers d
      LEFT JOIN trucks t ON d.id = t.current_driver_id
      LEFT JOIN trips tr ON d.id = tr.driver_id
      WHERE d.id = $1
      GROUP BY d.id
    `;
    
    console.log('🔍 [DRIVER GET] Executando query no banco...');
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      console.log(`❌ [DRIVER GET] Motorista não encontrado: ${id}`);
      return res.status(404).json({ error: 'Motorista não encontrado' });
    }
    
    console.log(`✅ [DRIVER GET] Motorista encontrado: ${result.rows[0].name}`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error(`❌ [DRIVER GET] Erro ao buscar motorista ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro ao buscar motorista' });
  }
});

// Create new driver
router.post('/', async (req, res) => {
  try {
    console.log('👥 [DRIVER CREATE] Iniciando criação de novo motorista...');
    console.log('📝 [DRIVER CREATE] Dados recebidos:', { ...req.body, password: '***' });

    const { name, license, licenseCategory, phone, email, status } = req.body;

    if (!name || !license || !phone || !email) {
      return res.status(400).json({ error: 'Campos obrigatórios: nome, CNH, telefone e email' });
    }

    const query = `
      INSERT INTO drivers (name, license_number, license_category, phone, email, status, hire_date)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)
      RETURNING *
    `;

    const result = await pool.query(query, [
      name,
      license,
      licenseCategory || null,
      phone,
      email,
      status || 'active',
    ]);

    console.log(`✅ [DRIVER CREATE] Motorista criado: ${result.rows[0].name}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ [DRIVER CREATE] Erro ao criar motorista:', error);
    const dbError = error as any;
    if (dbError?.code === '23505') {
      return res.status(400).json({ error: 'Número de CNH já cadastrado' });
    }
    res.status(500).json({ error: 'Erro ao criar motorista' });
  }
});

// Update driver
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`👥 [DRIVER UPDATE] Atualizando ${id}`);

    const { name, license, licenseCategory, phone, email, status } = req.body;

    const query = `
      UPDATE drivers
      SET name = $1,
          license_number = $2,
          license_category = $3,
          phone = $4,
          email = $5,
          status = $6,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `;

    const result = await pool.query(query, [
      name,
      license,
      licenseCategory || null,
      phone,
      email,
      status,
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Motorista não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(`❌ [DRIVER UPDATE] Erro:`, error);
    res.status(500).json({ error: 'Erro ao atualizar motorista' });
  }
});

// Check driver dependencies before deletion
router.get('/:id/dependencies', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 [DRIVER DEPS] Verificando dependências do motorista: ${id}`);
    
    const trucksQuery = await pool.query('SELECT id, name, plate FROM trucks WHERE current_driver_id = $1', [id]);
    const tripsQuery = await pool.query('SELECT COUNT(*) as count FROM trips WHERE driver_id = $1', [id]);
    
    console.log(`📊 [DRIVER DEPS] Caminhões vinculados: ${trucksQuery.rows.length}`);
    console.log(`📊 [DRIVER DEPS] Viagens registradas: ${tripsQuery.rows[0]?.count || 0}`);
    
    const dependencies = {
      trucks: trucksQuery.rows,
      tripsCount: parseInt(tripsQuery.rows[0].count) || 0,
      canDelete: trucksQuery.rows.length === 0
    };
    
    console.log(`✅ [DRIVER DEPS] Dependências verificadas - Pode excluir: ${dependencies.canDelete}`);
    res.json(dependencies);
  } catch (error) {
    console.error(`❌ [DRIVER DEPS] Erro ao verificar dependências ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro ao verificar dependências' });
  }
});

// Delete driver with smart handling
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { force } = req.query;
    const forceDelete = force === 'true';
    
    console.log(`🗑️ [DRIVER DELETE] Iniciando exclusão do motorista ${id}, force: ${forceDelete}`);
    
    // Start transaction
    console.log('🔄 [DRIVER DELETE] Iniciando transação...');
    await client.query('BEGIN');
    
    // Check if driver exists
    console.log('🔍 [DRIVER DELETE] Verificando se motorista existe...');
    const driverCheck = await client.query('SELECT name FROM drivers WHERE id = $1', [id]);
    if (driverCheck.rows.length === 0) {
      console.log(`❌ [DRIVER DELETE] Motorista não encontrado: ${id}`);
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Motorista não encontrado' });
    }
    
    const driverName = driverCheck.rows[0].name;
    console.log(`✅ [DRIVER DELETE] Motorista encontrado: ${driverName}`);
    
    // Check for truck dependencies
    console.log('🔍 [DRIVER DELETE] Verificando dependências de caminhões...');
    const truckCheck = await client.query('SELECT id, name, plate FROM trucks WHERE current_driver_id = $1', [id]);
    console.log(`📊 [DRIVER DELETE] Caminhões vinculados encontrados: ${truckCheck.rows.length}`);
    
    if (truckCheck.rows.length > 0) {
      if (forceDelete) {
        // Remove driver assignment from trucks first
        console.log(`🔄 [DRIVER DELETE] Forçando desvinculação de ${truckCheck.rows.length} caminhões...`);
        truckCheck.rows.forEach(truck => {
          console.log(`   🚛 Desvinculando: ${truck.name} (${truck.plate})`);
        });
        
        await client.query('UPDATE trucks SET current_driver_id = NULL WHERE current_driver_id = $1', [id]);
        console.log(`✅ [DRIVER DELETE] ${truckCheck.rows.length} caminhões desvinculados com sucesso`);
      } else {
        console.log(`❌ [DRIVER DELETE] Exclusão cancelada - motorista vinculado a caminhões`);
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Motorista está vinculado a caminhões',
          details: {
            trucks: truckCheck.rows,
            requiresForce: true,
            message: 'Para excluir, primeiro desvincule o motorista dos caminhões ou use a opção de desvinculação automática'
          }
        });
      }
    }
    
    // Now safe to delete the driver
    console.log('🗑️ [DRIVER DELETE] Executando exclusão do motorista...');
    const result = await client.query('DELETE FROM drivers WHERE id = $1 RETURNING *', [id]);
    
    // Commit transaction
    console.log('✅ [DRIVER DELETE] Confirmando transação...');
    await client.query('COMMIT');
    
    console.log(`✅ [DRIVER DELETE] Motorista excluído com sucesso: ${result.rows[0].name}`);
    
    res.json({ 
      message: 'Motorista excluído com sucesso'
    });
  } catch (error) {
    // Rollback transaction on error
    console.log('🔄 [DRIVER DELETE] Erro detectado, fazendo rollback...');
    await client.query('ROLLBACK');
    console.error(`❌ [DRIVER DELETE] Erro ao excluir motorista ${req.params.id}:`, error);
    console.error('🔍 [DRIVER DELETE] Stack trace:', (error as Error).stack);
    res.status(500).json({ error: 'Erro ao excluir motorista' });
  } finally {
    console.log('🔓 [DRIVER DELETE] Liberando conexão do banco...');
    client.release();
  }
});

export default router;
