
import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get all drivers
router.get('/', async (req, res) => {
  try {
    console.log('👥 Fetching all drivers...');
    
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
    
    const result = await pool.query(query);
    
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

    console.log(`✅ Found ${drivers.length} drivers`);
    res.json(drivers);
  } catch (error) {
    console.error('❌ Error fetching drivers:', error);
    res.status(500).json({ error: 'Erro ao buscar motoristas' });
  }
});

// Get single driver by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
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
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Motorista não encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error fetching driver:', error);
    res.status(500).json({ error: 'Erro ao buscar motorista' });
  }
});

// Create new driver
router.post('/', async (req, res) => {
  try {
    console.log('👥 Creating new driver...');
    
    const { name, license, phone, email, status } = req.body;
    
    // Validate required fields
    if (!name || !license || !phone || !email) {
      return res.status(400).json({ error: 'Campos obrigatórios: nome, CNH, telefone e email' });
    }
    
    const query = `
      INSERT INTO drivers (name, license_number, phone, email, status, hire_date)
      VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      name,
      license,
      phone,
      email,
      status || 'active'
    ]);
    
    console.log('✅ Driver created:', result.rows[0].name);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error creating driver:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Número de CNH já cadastrado' });
    }
    res.status(500).json({ error: 'Erro ao criar motorista' });
  }
});

// Update driver
router.put('/:id', async (req, res) => {
  try {
    console.log('👥 Updating driver:', req.params.id);
    
    const { id } = req.params;
    const { name, license, phone, email, status } = req.body;
    
    const query = `
      UPDATE drivers 
      SET name = $1, license_number = $2, phone = $3, email = $4, status = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `;
    
    const result = await pool.query(query, [name, license, phone, email, status, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Motorista não encontrado' });
    }
    
    console.log('✅ Driver updated:', result.rows[0].name);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating driver:', error);
    res.status(500).json({ error: 'Erro ao atualizar motorista' });
  }
});

// Delete driver
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if driver is assigned to any truck
    const truckCheck = await pool.query('SELECT id FROM trucks WHERE current_driver_id = $1', [id]);
    
    if (truckCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Não é possível excluir motorista que está atribuído a um caminhão' });
    }
    
    const result = await pool.query('DELETE FROM drivers WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Motorista não encontrado' });
    }
    
    console.log('✅ Driver deleted:', result.rows[0].name);
    res.json({ message: 'Motorista excluído com sucesso' });
  } catch (error) {
    console.error('❌ Error deleting driver:', error);
    res.status(500).json({ error: 'Erro ao excluir motorista' });
  }
});

export default router;
