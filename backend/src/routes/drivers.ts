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
        d.current_route,
        d.total_trips,
        d.created_at,
        COUNT(t.id) as truck_count
      FROM drivers d
      LEFT JOIN trucks t ON d.id = t.current_driver_id
      GROUP BY d.id, d.name, d.license_number, d.license_category, d.phone, d.email, d.hire_date, d.status, d.current_route, d.total_trips, d.created_at
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
      truckCount: parseInt(driver.truck_count) || 0
    }));

    console.log(`✅ [DRIVERS GET] Dados processados e enviados: ${drivers.length} motoristas`);
    drivers.forEach(driver => {
      console.log(`   📋 Motorista: ${driver.name} (ID: ${driver.id}) - Status: ${driver.status} - Caminhões: ${driver.truckCount}`);
    });
    
    res.json(drivers);
  } catch (error) {
    console.error('❌ [DRIVERS GET] Erro ao buscar motoristas:', error);
    console.error('🔍 [DRIVERS GET] Stack trace:', error.stack);
    res.status(500).json({ error: 'Erro ao buscar motoristas' });
  }
});

// Check driver dependencies using new database function
router.get('/:id/dependencies', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 [DRIVER DEPS] Verificando dependências do motorista: ${id}`);
    
    const query = `SELECT check_deletion_dependencies('drivers', $1::uuid) as dependencies`;
    const result = await pool.query(query, [id]);
    
    const dependencies = result.rows[0].dependencies;
    console.log(`✅ [DRIVER DEPS] Dependências verificadas:`, dependencies);
    
    res.json(dependencies);
  } catch (error) {
    console.error(`❌ [DRIVER DEPS] Erro ao verificar dependências ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro ao verificar dependências' });
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
    
    const { name, license, phone, email, status } = req.body;
    
    // Validate required fields
    if (!name || !license || !phone || !email) {
      console.log('❌ [DRIVER CREATE] Validação falhou - campos obrigatórios faltando');
      return res.status(400).json({ error: 'Campos obrigatórios: nome, CNH, telefone e email' });
    }
    
    console.log('✅ [DRIVER CREATE] Validação dos campos passou');
    
    const query = `
      INSERT INTO drivers (name, license_number, phone, email, status, hire_date)
      VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
      RETURNING *
    `;
    
    console.log('🔍 [DRIVER CREATE] Executando INSERT no banco...');
    const result = await pool.query(query, [
      name,
      license,
      phone,
      email,
      status || 'active'
    ]);
    
    console.log(`✅ [DRIVER CREATE] Motorista criado com sucesso: ${result.rows[0].name} (ID: ${result.rows[0].id})`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ [DRIVER CREATE] Erro ao criar motorista:', error);
    if (error.code === '23505') {
      console.log('🔍 [DRIVER CREATE] Erro de duplicação - CNH já cadastrada');
      return res.status(400).json({ error: 'Número de CNH já cadastrado' });
    }
    res.status(500).json({ error: 'Erro ao criar motorista' });
  }
});

// Update driver
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`👥 [DRIVER UPDATE] Iniciando atualização do motorista: ${id}`);
    console.log('📝 [DRIVER UPDATE] Dados recebidos:', req.body);
    
    const { name, license, phone, email, status } = req.body;
    
    const query = `
      UPDATE drivers 
      SET name = $1, license_number = $2, phone = $3, email = $4, status = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `;
    
    console.log('🔍 [DRIVER UPDATE] Executando UPDATE no banco...');
    const result = await pool.query(query, [name, license, phone, email, status, id]);
    
    if (result.rows.length === 0) {
      console.log(`❌ [DRIVER UPDATE] Motorista não encontrado: ${id}`);
      return res.status(404).json({ error: 'Motorista não encontrado' });
    }
    
    console.log(`✅ [DRIVER UPDATE] Motorista atualizado: ${result.rows[0].name}`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error(`❌ [DRIVER UPDATE] Erro ao atualizar motorista ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro ao atualizar motorista' });
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
    if (truckCheck.rows.length > 0) {
      console.log(`📊 [DRIVER DELETE] Caminhões desvinculados: ${truckCheck.rows.length}`);
    }
    
    res.json({ 
      message: 'Motorista excluído com sucesso',
      unassignedTrucks: truckCheck.rows.length 
    });
  } catch (error) {
    // Rollback transaction on error
    console.log('🔄 [DRIVER DELETE] Erro detectado, fazendo rollback...');
    await client.query('ROLLBACK');
    console.error(`❌ [DRIVER DELETE] Erro ao excluir motorista ${req.params.id}:`, error);
    console.error('🔍 [DRIVER DELETE] Stack trace:', error.stack);
    res.status(500).json({ error: 'Erro ao excluir motorista' });
  } finally {
    console.log('🔓 [DRIVER DELETE] Liberando conexão do banco...');
    client.release();
  }
});

export default router;
