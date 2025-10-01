const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

class Database {
  constructor() {
    this.db = new sqlite3.Database(path.join(__dirname, 'greenscore.db'), (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
      } else {
        console.log('Connected to SQLite database');
        this.initTables();
      }
    });
  }

  initTables() {
    // Users table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        company_name TEXT,
        phone TEXT,
        user_type TEXT NOT NULL, -- 'seller', 'buyer', 'admin'
        verification_status TEXT DEFAULT 'pending',
        is_active BOOLEAN DEFAULT 1,
        last_login DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create default admin user if not exists (password: admin123)
    this.db.get('SELECT id FROM users WHERE user_type = "admin"', [], (err, row) => {
      if (!err && !row) {
        this.db.run(`
          INSERT INTO users (id, email, password_hash, name, user_type, verification_status, company_name)
          VALUES ('admin-default', 'admin@greenscore.com', '$2b$10$HTv86gjRUEzPswiVvRt2C.ZRXj17Khej34qyTBz3XHo9MCuCpnyuS', 'System Admin', 'admin', 'verified', 'GreenScore System')
        `, (err) => {
          if (err) {
            console.error('Error creating admin user:', err);
          } else {
            console.log('✅ Default admin user created: admin@greenscore.com / admin123');
          }
        });
      }
    });

    // Projects table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        seller_id TEXT NOT NULL,
        name TEXT NOT NULL,
        location TEXT,
        description TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (seller_id) REFERENCES users (id)
      )
    `);

    // Materials table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS materials (
        id TEXT PRIMARY KEY,
        listing_id TEXT UNIQUE, -- Add unique listing ID for seller reference
        seller_id TEXT NOT NULL,
        project_id TEXT,
        material TEXT NOT NULL,
        brand TEXT,
        category TEXT,
        condition TEXT DEFAULT 'good',
        quantity INTEGER NOT NULL,
        unit TEXT DEFAULT 'pcs',
        price_today REAL NOT NULL,
        mrp REAL DEFAULT 0,
        price_purchased REAL DEFAULT 0,
        inventory_value REAL DEFAULT 0,
        inventory_type TEXT DEFAULT 'surplus',
        listing_type TEXT DEFAULT 'resale',
        acquisition_type TEXT DEFAULT 'purchased',
        specs TEXT,
        photo TEXT,
        specs_photo TEXT,
        dimensions TEXT,
        weight REAL,
        location_details TEXT,
        is_being_edited BOOLEAN DEFAULT 0,
        edit_started_at DATETIME,
        edited_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (seller_id) REFERENCES users (id),
        FOREIGN KEY (project_id) REFERENCES projects (id),
        FOREIGN KEY (edited_by) REFERENCES users (id)
      )
    `);

    // Order requests table (simple purchase requests)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS order_requests (
        id TEXT PRIMARY KEY,
        material_id TEXT NOT NULL,
        buyer_id TEXT NOT NULL,
        seller_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL, -- Seller's listed price
        total_amount REAL NOT NULL,
        status TEXT DEFAULT 'pending', -- pending, approved, declined, partially_approved
        buyer_company TEXT,
        buyer_contact_person TEXT,
        buyer_email TEXT,
        buyer_phone TEXT,
        delivery_address TEXT,
        delivery_notes TEXT,
        seller_notes TEXT,
        fulfilled_quantity INTEGER, -- For partial fulfillment tracking
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        approved_at DATETIME,
        FOREIGN KEY (material_id) REFERENCES materials (id),
        FOREIGN KEY (buyer_id) REFERENCES users (id),
        FOREIGN KEY (seller_id) REFERENCES users (id)
      )
    `);

    // Orders table (for approved order requests)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        order_request_id TEXT NOT NULL,
        buyer_id TEXT NOT NULL,
        seller_id TEXT NOT NULL,
        material_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total_amount REAL NOT NULL,
        platform_fee REAL NOT NULL,
        status TEXT DEFAULT 'confirmed', -- confirmed, shipped, delivered, completed
        shipping_address TEXT,
        delivery_notes TEXT,
        tracking_number TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        shipped_at DATETIME,
        delivered_at DATETIME,
        FOREIGN KEY (order_request_id) REFERENCES order_requests (id),
        FOREIGN KEY (material_id) REFERENCES materials (id),
        FOREIGN KEY (buyer_id) REFERENCES users (id),
        FOREIGN KEY (seller_id) REFERENCES users (id)
      )
    `);

    // Order items table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        material_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders (id),
        FOREIGN KEY (material_id) REFERENCES materials (id)
      )
    `);

    // Upload logs table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS upload_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT,
        filename TEXT NOT NULL,
        file_type TEXT NOT NULL,
        total_rows INTEGER,
        successful_rows INTEGER,
        failed_rows INTEGER,
        errors TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (project_id) REFERENCES projects (id)
      )
    `);

    // Internal transfers table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS internal_transfers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        material_id TEXT NOT NULL,
        from_project_id TEXT NOT NULL,
        to_project_id TEXT NOT NULL,
        quantity_transferred INTEGER NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (material_id) REFERENCES materials (id),
        FOREIGN KEY (from_project_id) REFERENCES projects (id),
        FOREIGN KEY (to_project_id) REFERENCES projects (id)
      )
    `);

    // Notifications table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        read BOOLEAN DEFAULT 0,
        data TEXT,
        related_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    // Transaction history table for comprehensive tracking
    this.db.run(`
      CREATE TABLE IF NOT EXISTS transaction_history (
        id TEXT PRIMARY KEY,
        seller_id TEXT NOT NULL,
        material_id TEXT,
        listing_id TEXT,
        transaction_type TEXT NOT NULL, -- 'sale', 'internal_transfer', 'listing_created', 'listing_updated'
        buyer_id TEXT, -- For sales
        order_id TEXT, -- For sales
        from_project_id TEXT, -- For transfers
        to_project_id TEXT, -- For transfers
        quantity INTEGER NOT NULL,
        unit_price REAL,
        total_amount REAL,
        material_name TEXT NOT NULL,
        buyer_company TEXT,
        buyer_contact TEXT,
        delivery_address TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (seller_id) REFERENCES users (id),
        FOREIGN KEY (material_id) REFERENCES materials (id),
        FOREIGN KEY (buyer_id) REFERENCES users (id),
        FOREIGN KEY (order_id) REFERENCES orders (id)
      )
    `);

    console.log('Database tables initialized');
  }

  // User methods
  async createUser(userData) {
    const { email, password, name, userType, companyName } = userData;
    const passwordHash = await bcrypt.hash(password, 10);
    
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO users (id, email, password_hash, name, company_name, user_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([userData.id, email, passwordHash, name, companyName || '', userType], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: userData.id, email, name, userType, companyName });
        }
      });
      stmt.finalize();
    });
  }

  async findUserByEmail(email) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async findUserById(id) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  // Project methods
  async createProject(projectData) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO projects (id, seller_id, name, location, description)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        projectData.id, 
        projectData.sellerId, 
        projectData.name, 
        projectData.location || '', 
        projectData.description || ''
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(projectData);
        }
      });
      stmt.finalize();
    });
  }

  async getProjectsBySeller(sellerId) {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM projects WHERE seller_id = ? ORDER BY created_at DESC', [sellerId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Generate unique listing ID
  generateListingId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `GS-${timestamp}-${random}`.toUpperCase();
  }

  // Material methods
  async createMaterial(materialData) {
    return new Promise((resolve, reject) => {
      const listingId = this.generateListingId();
      const stmt = this.db.prepare(`
        INSERT INTO materials (
          id, listing_id, seller_id, project_id, material, brand, category, condition,
          quantity, unit, price_today, mrp, price_purchased, inventory_value,
          inventory_type, listing_type, specs, photo, specs_photo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        materialData.id, listingId, materialData.sellerId, materialData.projectId,
        materialData.material, materialData.brand || '', materialData.category || 'Other',
        materialData.condition || 'good', materialData.qty, materialData.unit || 'pcs',
        materialData.priceToday, materialData.mrp || 0, materialData.pricePurchased || 0,
        materialData.inventoryValue || 0, materialData.inventoryType || 'surplus',
        materialData.listingType || 'resale', materialData.specs || '',
        materialData.photo || '', materialData.specsPhoto || ''
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({...materialData, listingId});
        }
      });
      stmt.finalize();
    });
  }

  async getMaterialsBySeller(sellerId, filters = {}) {
    let query = 'SELECT * FROM materials WHERE seller_id = ?';
    let params = [sellerId];

    if (filters.projectId && filters.projectId !== 'all') {
      query += ' AND project_id = ?';
      params.push(filters.projectId);
    }

    if (filters.inventoryType && filters.inventoryType !== 'all') {
      query += ' AND inventory_type = ?';
      params.push(filters.inventoryType);
    }

    if (filters.listingType && filters.listingType !== 'all') {
      query += ' AND listing_type = ?';
      params.push(filters.listingType);
    }

    query += ' ORDER BY created_at DESC';

    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // Convert database fields to frontend-compatible names
          const materials = rows.map(row => ({
            ...row,
            qty: row.quantity,
            projectId: row.project_id,
            priceToday: row.price_today,
            pricePurchased: row.price_purchased,
            inventoryValue: row.inventory_value,
            inventoryType: row.inventory_type,
            listingType: row.listing_type,
            acquisitionType: row.acquisition_type,
            specsPhoto: row.specs_photo,
            is_being_edited: row.is_being_edited,
            createdAt: row.created_at
          }));
          resolve(materials);
        }
      });
    });
  }

  async getMaterialsForBuyers(filters = {}) {
    let query = `
      SELECT m.*, p.name as project_name 
      FROM materials m 
      LEFT JOIN projects p ON m.project_id = p.id 
      WHERE m.quantity > 0 AND m.listing_type = 'resale' AND (m.acquisition_type IS NULL OR m.acquisition_type != 'acquired')
    `;
    let params = [];

    if (filters.category && filters.category !== 'all') {
      query += ' AND m.category = ?';
      params.push(filters.category);
    }

    if (filters.search) {
      query += ' AND (m.material LIKE ? OR m.brand LIKE ? OR m.specs LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY m.created_at DESC';

    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // Convert quantity back to qty and include seller info for notifications
          const materials = rows.map(row => ({
            id: row.id,
            material: row.material,
            brand: row.brand,
            category: row.category,
            condition: row.condition,
            qty: row.quantity,
            unit: row.unit,
            priceToday: row.price_today,
            specs: row.specs,
            photo: row.photo,
            sellerId: row.seller_id, // Include seller ID for notifications
            is_being_edited: row.is_being_edited,
            createdAt: row.created_at
          }));
          resolve(materials);
        }
      });
    });
  }

  async updateMaterialListingType(materialId, listingType, targetProjectId = null) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        UPDATE materials 
        SET listing_type = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      stmt.run([listingType, materialId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ success: true });
        }
      });
      stmt.finalize();
    });
  }

  // Bulk insert materials
  async createMaterialsBulk(materialsData) {
    console.log('💾 DATABASE: Starting bulk insert of', materialsData.length, 'materials');
    
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO materials (
          id, listing_id, seller_id, project_id, material, brand, category, condition,
          quantity, unit, price_today, mrp, price_purchased, inventory_value,
          inventory_type, listing_type, specs, photo, specs_photo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        materialsData.forEach(material => {
          const listingId = this.generateListingId();
          stmt.run([
            material.id, listingId, material.sellerId, material.projectId,
            material.material, material.brand || '', material.category || 'Other',
            material.condition || 'good', material.qty, material.unit || 'pcs',
            material.priceToday, material.mrp || 0, material.pricePurchased || 0,
            material.inventoryValue || 0, material.inventoryType || 'surplus',
            material.listingType || 'resale', material.specs || '',
            material.photo || '', material.specsPhoto || ''
          ]);
        });

        this.db.run('COMMIT', (err) => {
          if (err) {
            console.log('❌ DATABASE: Commit failed:', err.message);
            reject(err);
          } else {
            console.log('✅ DATABASE: Successfully saved', materialsData.length, 'materials');
            resolve({ success: true, count: materialsData.length });
          }
        });
      });

      stmt.finalize();
    });
  }

  // Upload log methods
  async createUploadLog(logData) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO upload_logs (id, user_id, project_id, filename, file_type, total_rows, successful_rows, failed_rows, errors)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        logData.id, logData.userId, logData.projectId, logData.filename,
        logData.fileType, logData.totalRows, logData.successfulRows,
        logData.failedRows, JSON.stringify(logData.errors || [])
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(logData);
        }
      });
      stmt.finalize();
    });
  }

  close() {
    this.db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('Database connection closed');
      }
    });
  }

  // Internal transfer methods
  async createInternalTransfer(transferData) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        try {
          // First, check if source material has enough quantity
          this.db.get(
            'SELECT * FROM materials WHERE id = ? AND seller_id = ?',
            [transferData.materialId, transferData.userId],
            (err, material) => {
              if (err) {
                this.db.run('ROLLBACK');
                return reject(err);
              }
              
              if (!material) {
                this.db.run('ROLLBACK');
                return reject(new Error('Material not found'));
              }
              
              if (material.quantity < transferData.quantityTransferred) {
                this.db.run('ROLLBACK');
                return reject(new Error('Insufficient quantity available'));
              }
              
              // Create transfer record
              const stmt1 = this.db.prepare(`
                INSERT INTO internal_transfers (
                  id, user_id, material_id, from_project_id, to_project_id,
                  quantity_transferred, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
              `);
              
              stmt1.run([
                transferData.id,
                transferData.userId,
                transferData.materialId,
                transferData.fromProjectId,
                transferData.toProjectId,
                transferData.quantityTransferred,
                transferData.notes || ''
              ], (err) => {
                if (err) {
                  this.db.run('ROLLBACK');
                  return reject(err);
                }
                
                                  // Update source material quantity
                const stmt2 = this.db.prepare(`
                  UPDATE materials SET quantity = quantity - ?
                  WHERE id = ? AND seller_id = ?
                `);
                
                stmt2.run([
                  transferData.quantityTransferred,
                  transferData.materialId,
                  transferData.userId
                ], (err) => {
                  if (err) {
                    this.db.run('ROLLBACK');
                    return reject(err);
                  }
                  
                  // Remove source material if quantity becomes zero
                  const stmt2b = this.db.prepare(`
                    DELETE FROM materials WHERE id = ? AND quantity <= 0
                  `);
                  
                  stmt2b.run([transferData.materialId], (err) => {
                    if (err) {
                      console.warn('Warning: Could not remove zero-quantity material:', err);
                      // Don't fail the transaction for this
                    }
                  });
                  
                  // Check if we need to create a new material entry or update existing one
                  this.db.get(
                    'SELECT * FROM materials WHERE seller_id = ? AND project_id = ? AND material = ? AND brand = ? AND condition = ?',
                    [transferData.userId, transferData.toProjectId, material.material, material.brand, material.condition],
                    (err, existingMaterial) => {
                      if (err) {
                        this.db.run('ROLLBACK');
                        return reject(err);
                      }
                      
                      if (existingMaterial) {
                        // Update existing material in destination project
                        const stmt3 = this.db.prepare(`
                          UPDATE materials SET quantity = quantity + ?
                          WHERE id = ?
                        `);
                        
                        stmt3.run([transferData.quantityTransferred, existingMaterial.id], (err) => {
                          if (err) {
                            this.db.run('ROLLBACK');
                            return reject(err);
                          }
                          
                          // Add transaction history and notification
                          this.addTransferHistory(transferData, material, () => {
                            this.db.run('COMMIT');
                            resolve({ success: true, transferId: transferData.id });
                          });
                        });
                      } else {
                        // Create new material entry in destination project
                        const { v4: uuidv4 } = require('uuid');
                        const newMaterialId = uuidv4();
                        
                        const stmt4 = this.db.prepare(`
                          INSERT INTO materials (
                            id, seller_id, project_id, material, brand, category, condition,
                            quantity, unit, price_today, mrp, price_purchased, inventory_value,
                            inventory_type, listing_type, acquisition_type, specs, photo, specs_photo, dimensions, weight
                          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `);
                        
                        stmt4.run([
                          newMaterialId,
                          transferData.userId,
                          transferData.toProjectId,
                          material.material,
                          material.brand,
                          material.category,
                          material.condition,
                          transferData.quantityTransferred,
                          material.unit,
                          material.price_today,
                          material.mrp,
                          material.price_purchased,
                          material.price_today * transferData.quantityTransferred,
                          material.inventory_type,
                          'acquired', // Set as acquired for transferred items
                          'acquired', // Set acquisition_type as acquired
                          material.specs,
                          material.photo,
                          material.specs_photo,
                          material.dimensions,
                          material.weight
                        ], (err) => {
                          if (err) {
                            this.db.run('ROLLBACK');
                            return reject(err);
                          }
                          
                          // Add transaction history and notification
                          this.addTransferHistory(transferData, material, () => {
                            this.db.run('COMMIT');
                            resolve({ success: true, transferId: transferData.id });
                          });
                        });
                      }
                    }
                  );
                });
              });
            }
          );
        } catch (error) {
          this.db.run('ROLLBACK');
          reject(error);
        }
      });
    });
  }

  addTransferHistory(transferData, material, callback) {
    const { v4: uuidv4 } = require('uuid');
    const thId = uuidv4();
    
    // Create transaction history record
    this.db.run(
      `INSERT INTO transaction_history (
        id, seller_id, material_id, listing_id, transaction_type,
        from_project_id, to_project_id, quantity, material_name, notes,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        thId,
        transferData.userId,
        transferData.materialId,
        material.listing_id,
        'internal_transfer',
        transferData.fromProjectId,
        transferData.toProjectId,
        transferData.quantityTransferred,
        material.material,
        transferData.notes || ''
      ],
      (err) => {
        if (err) {
          console.error('Failed to create transaction history:', err);
        }
        
        // Get project names for notifications
        this.db.get('SELECT name FROM projects WHERE id = ?', [transferData.fromProjectId], (err, fromProject) => {
          this.db.get('SELECT name FROM projects WHERE id = ?', [transferData.toProjectId], (err, toProject) => {
            const fromProjectName = fromProject ? fromProject.name : 'Unknown Project';
            const toProjectName = toProject ? toProject.name : 'Unknown Project';
            
            // Create notification for the sender (same as receiver for internal transfer)
            const notifId1 = uuidv4();
            this.db.run(
              `INSERT INTO notifications (
                id, user_id, title, message, type, related_id
              ) VALUES (?, ?, ?, ?, ?, ?)`,
              [
                notifId1,
                transferData.userId,
                'Internal Transfer Completed',
                `Successfully transferred ${transferData.quantityTransferred} units of ${material.material} from ${fromProjectName} to ${toProjectName}`,
                'internal_transfer',
                transferData.id
              ],
              (err) => {
                if (err) {
                  console.error('Failed to create notification:', err);
                }
              }
            );
            
            // Create order request entry for internal transfer (for history tracking)
            const requestId = uuidv4();
            this.db.run(
              `INSERT INTO order_requests (
                id, material_id, buyer_id, seller_id, quantity, unit_price, total_amount,
                status, buyer_company, buyer_contact_person, buyer_email, buyer_phone,
                delivery_address, delivery_notes, seller_notes, created_at, approved_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
              [
                requestId,
                transferData.materialId,
                transferData.userId, // Same user is both buyer and seller for internal transfer
                transferData.userId,
                transferData.quantityTransferred,
                0, // Internal transfer has no price
                0,
                'approved',
                'Internal Transfer',
                fromProjectName,
                '',
                '',
                toProjectName,
                transferData.notes || 'Internal stock movement',
                `Transfer from ${fromProjectName} to ${toProjectName}`
              ],
              (err) => {
                if (err) {
                  console.error('Failed to create order request for transfer:', err);
                }
                
                if (callback) callback();
              }
            );
          });
        });
      }
    );
  }

  async getInternalTransfersByUser(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          t.*,
          m.material as material_name,
          m.brand as material_brand,
          fp.name as from_project_name,
          tp.name as to_project_name
        FROM internal_transfers t
        JOIN materials m ON t.material_id = m.id
        JOIN projects fp ON t.from_project_id = fp.id
        JOIN projects tp ON t.to_project_id = tp.id
        WHERE t.user_id = ?
        ORDER BY t.created_at DESC
      `;
      
      this.db.all(query, [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async updateMaterialListing(materialId, listingType, acquisitionType = null) {
    return new Promise((resolve, reject) => {
      let query = 'UPDATE materials SET listing_type = ?';
      let params = [listingType];
      
      if (acquisitionType) {
        query += ', acquisition_type = ?';
        params.push(acquisitionType);
      }
      
      query += ' WHERE id = ?';
      params.push(materialId);
      
      this.db.run(query, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ success: true, changes: this.changes });
        }
      });
    });
  }

  async updateMaterialQuantityAfterPurchase(materialId, quantityPurchased) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        // First, get current material info
        this.db.get('SELECT * FROM materials WHERE id = ?', [materialId], (err, material) => {
          if (err) {
            this.db.run('ROLLBACK');
            return reject(err);
          }
          
          if (!material) {
            this.db.run('ROLLBACK');
            return reject(new Error('Material not found'));
          }
          
          if (material.quantity < quantityPurchased) {
            this.db.run('ROLLBACK');
            return reject(new Error('Insufficient quantity available'));
          }
          
          const newQuantity = material.quantity - quantityPurchased;
          
          if (newQuantity <= 0) {
            // If quantity becomes zero or less, mark as sold and set quantity to 0
            this.db.run(
              'UPDATE materials SET quantity = 0, listing_type = ? WHERE id = ?',
              ['sold', materialId],
              (err) => {
                if (err) {
                  this.db.run('ROLLBACK');
                  return reject(err);
                }
                
                this.db.run('COMMIT');
                console.log(`🏷️ Material ${materialId} marked as SOLD (quantity: 0)`);
                resolve({ success: true, newQuantity: 0, status: 'sold' });
              }
            );
          } else {
            // Just update the quantity
            this.db.run(
              'UPDATE materials SET quantity = ? WHERE id = ?',
              [newQuantity, materialId],
              (err) => {
                if (err) {
                  this.db.run('ROLLBACK');
                  return reject(err);
                }
                
                this.db.run('COMMIT');
                console.log(`📦 Material ${materialId} quantity updated: ${newQuantity} remaining`);
                resolve({ success: true, newQuantity: newQuantity, status: 'available' });
              }
            );
          }
        });
      });
    });
  }

  // Notification methods
  async createNotification(userId, title, message, type = 'info', data = null) {
    return new Promise((resolve, reject) => {
      const { v4: uuidv4 } = require('uuid');
      const id = uuidv4();
      
      this.db.run(
        'INSERT INTO notifications (id, user_id, title, message, type, data) VALUES (?, ?, ?, ?, ?, ?)',
        [id, userId, title, message, type, data ? JSON.stringify(data) : null],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ success: true, notificationId: id });
          }
        }
      );
    });
  }

  async getUserNotifications(userId, unreadOnly = false) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM notifications WHERE user_id = ?';
      if (unreadOnly) {
        query += ' AND read = 0';
      }
      query += ' ORDER BY created_at DESC';
      
      this.db.all(query, [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const notifications = rows.map(row => ({
            ...row,
            data: row.data ? JSON.parse(row.data) : null,
            read: Boolean(row.read)
          }));
          resolve(notifications);
        }
      });
    });
  }

  async markNotificationAsRead(notificationId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE notifications SET read = 1 WHERE id = ?',
        [notificationId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ success: true, changes: this.changes });
          }
        }
      );
    });
  }

  async markAllNotificationsAsRead(userId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE notifications SET read = 1 WHERE user_id = ?',
        [userId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ success: true, changes: this.changes });
          }
        }
      );
    });
  }

  // Order request management methods
  async createOrderRequest(requestData) {
    return new Promise((resolve, reject) => {
      const { v4: uuidv4 } = require('uuid');
      const requestId = uuidv4();
      
      // First get material details for notification
      this.db.get(
        'SELECT material, listing_id FROM materials WHERE id = ?',
        [requestData.materialId],
        (err, material) => {
          if (err) {
            return reject(err);
          }
          
          // Create the order request
          this.db.run(
            `INSERT INTO order_requests (
              id, material_id, buyer_id, seller_id, quantity, unit_price, total_amount,
              buyer_company, buyer_contact_person, buyer_email, buyer_phone,
              delivery_address, delivery_notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              requestId, requestData.materialId, requestData.buyerId, requestData.sellerId, 
              requestData.quantity, requestData.unitPrice, requestData.totalAmount,
              requestData.companyName, requestData.contactPerson, requestData.email, 
              requestData.phone, requestData.deliveryAddress, requestData.deliveryNotes || ''
            ],
            (err) => {
              if (err) {
                return reject(err);
              }
              
              // Create notification for seller
              const notificationId = uuidv4();
              this.db.run(
                `INSERT INTO notifications (
                  id, user_id, title, message, type, related_id
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                  notificationId,
                  requestData.sellerId,
                  'New Order Request!',
                  `${requestData.contactPerson || 'A buyer'} from ${requestData.companyName || 'Unknown Company'} wants to purchase ${requestData.quantity} units of ${material?.material || 'your material'} (${material?.listing_id || 'N/A'})`,
                  'new_order_request',
                  requestId
                ],
                (err) => {
                  // Don't fail if notification fails
                  if (err) {
                    console.error('Failed to create seller notification:', err);
                  }
                  
                  resolve({ success: true, requestId });
                }
              );
            }
          );
        }
      );
    });
  }

  async getOrderRequestsBySeller(sellerId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          r.*,
          m.material as material_name,
          m.listing_id,
          m.unit,
          m.price_today as current_price,
          m.quantity as available_qty,
          m.seller_id,
          u.name as buyer_name
        FROM order_requests r
        JOIN materials m ON r.material_id = m.id
        JOIN users u ON r.buyer_id = u.id
        WHERE m.seller_id = ? AND r.status = 'pending'
        ORDER BY r.created_at DESC
      `;
      
      this.db.all(query, [sellerId], (err, rows) => {
        if (err) {
          console.error('Database error in getOrderRequestsBySeller:', err);
          reject(err);
        } else {
          console.log(`Found ${rows.length} order requests for seller ${sellerId}`);
          resolve(rows);
        }
      });
    });
  }

  async getOrderRequestsForMaterial(materialId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          r.*,
          u.name as buyer_name,
          u.email as buyer_user_email
        FROM order_requests r
        JOIN users u ON r.buyer_id = u.id
        WHERE r.material_id = ? AND r.status = 'pending'
        ORDER BY r.created_at DESC
      `;
      
      this.db.all(query, [materialId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async approveOrderRequests(requestIds, sellerNotes = '') {
    // Handle bulk approvals with FCFS logic in a single transaction
    if (!Array.isArray(requestIds)) {
      requestIds = [requestIds];
    }
    
    return new Promise((resolve, reject) => {
      const results = [];
      let processedCount = 0;
      let successCount = 0;
      
      this.db.serialize(() => {
        // Start a single transaction for all approvals
        this.db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            console.error('Failed to begin transaction:', err);
            return reject(err);
          }
          
          // Get all requests with their details, sorted by created_at (FCFS)
          const placeholders = requestIds.map(() => '?').join(',');
          const query = `
            SELECT or_table.*, m.quantity as available_quantity, m.material as material_name
            FROM order_requests or_table
            JOIN materials m ON or_table.material_id = m.id
            WHERE or_table.id IN (${placeholders})
            ORDER BY or_table.created_at ASC
          `;
          
          this.db.all(query, requestIds, (err, requests) => {
            if (err) {
              this.db.run('ROLLBACK');
              return reject(err);
            }
            
            if (!requests || requests.length === 0) {
              this.db.run('ROLLBACK');
              return reject(new Error('No order requests found'));
            }
            
            // Group requests by material_id to handle inventory properly
            const materialGroups = {};
            requests.forEach(req => {
              if (!materialGroups[req.material_id]) {
                materialGroups[req.material_id] = {
                  availableQty: req.available_quantity,
                  requests: []
                };
              }
              materialGroups[req.material_id].requests.push(req);
            });
            
            // Process each material group
            const processNextMaterial = (materialIds) => {
              if (materialIds.length === 0) {
                // All materials processed, commit transaction
                this.db.run('COMMIT', (err) => {
                  if (err) {
                    console.error('Failed to commit transaction:', err);
                    return reject(err);
                  }
                  resolve({ 
                    success: true, 
                    results,
                    totalProcessed: processedCount,
                    totalApproved: successCount
                  });
                });
                return;
              }
              
              const materialId = materialIds[0];
              const group = materialGroups[materialId];
              let remainingQty = group.availableQty;
              
              // Process requests for this material in FCFS order
              const processNextRequest = (index) => {
                if (index >= group.requests.length || remainingQty === 0) {
                  // Done with this material, update its quantity
                  const totalUsed = group.availableQty - remainingQty;
                  if (totalUsed > 0) {
                    const newQty = remainingQty;
                    this.db.run(
                      newQty === 0 
                        ? 'UPDATE materials SET quantity = ?, listing_type = ? WHERE id = ?'
                        : 'UPDATE materials SET quantity = ? WHERE id = ?',
                      newQty === 0 
                        ? [0, 'sold', materialId]
                        : [newQty, materialId],
                      (err) => {
                        if (err) {
                          console.error('Failed to update material quantity:', err);
                        }
                        // Move to next material
                        processNextMaterial(materialIds.slice(1));
                      }
                    );
                  } else {
                    // No quantity was used, move to next material
                    processNextMaterial(materialIds.slice(1));
                  }
                  return;
                }
                
                const request = group.requests[index];
                processedCount++;
                
                // Determine fulfillment quantity
                const fulfilledQty = Math.min(remainingQty, request.quantity);
                
                if (fulfilledQty === 0) {
                  // No quantity left, mark as declined due to stock
                  this.db.run(
                    'UPDATE order_requests SET status = ?, seller_notes = ? WHERE id = ?',
                    ['declined', 'Out of stock - no quantity available', request.id],
                    (err) => {
                      if (err) {
                        console.error('Failed to decline request:', err);
                      }
                      results.push({
                        requestId: request.id,
                        status: 'declined',
                        reason: 'Out of stock'
                      });
                      processNextRequest(index + 1);
                    }
                  );
                } else {
                  // Process approval (full or partial)
                  const isPartial = fulfilledQty < request.quantity;
                  const status = isPartial ? 'partially_approved' : 'approved';
                  const notes = isPartial 
                    ? `${sellerNotes} [Partial: ${fulfilledQty}/${request.quantity} units fulfilled]`
                    : sellerNotes;
                  
                  // Update order request
                  this.db.run(
                    'UPDATE order_requests SET status = ?, approved_at = CURRENT_TIMESTAMP, seller_notes = ?, fulfilled_quantity = ? WHERE id = ?',
                    [status, notes, fulfilledQty, request.id],
                    (err) => {
                      if (err) {
                        console.error('Failed to update request:', err);
                        processNextRequest(index + 1);
                        return;
                      }
                      
                      // Create order
                      const { v4: uuidv4 } = require('uuid');
                      const orderId = uuidv4();
                      const adjustedTotal = (fulfilledQty / request.quantity) * request.total_amount;
                      const platformFee = adjustedTotal * 0.05;
                      
                      this.db.run(
                        `INSERT INTO orders (
                          id, order_request_id, buyer_id, seller_id, material_id, quantity, 
                          unit_price, total_amount, platform_fee, shipping_address, delivery_notes
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                          orderId, request.id, request.buyer_id, request.seller_id, 
                          request.material_id, fulfilledQty, request.unit_price, 
                          adjustedTotal, platformFee, request.delivery_address, 
                          request.delivery_notes
                        ],
                        (err) => {
                          if (err) {
                            console.error('Failed to create order:', err);
                            processNextRequest(index + 1);
                            return;
                          }
                          
                          // Create notification
                          const notifId = uuidv4();
                          const notifMessage = isPartial 
                            ? `Your order for ${request.material_name} has been partially fulfilled. ${fulfilledQty}/${request.quantity} units approved. Order ID: ${orderId}`
                            : `Your order for ${fulfilledQty} units of ${request.material_name} has been approved. Order ID: ${orderId}`;
                          
                          this.db.run(
                            `INSERT INTO notifications (id, user_id, title, message, type, related_id) 
                             VALUES (?, ?, ?, ?, ?, ?)`,
                            [
                              notifId, request.buyer_id,
                              isPartial ? 'Order Partially Fulfilled!' : 'Order Approved!',
                              notifMessage, 'order_approved', orderId
                            ],
                            (err) => {
                              if (err) {
                                console.error('Failed to create notification:', err);
                              }
                              
                              // Update remaining quantity for next iteration
                              remainingQty -= fulfilledQty;
                              successCount++;
                              
                              results.push({
                                requestId: request.id,
                                orderId,
                                status: status,
                                fulfilledQty,
                                requestedQty: request.quantity,
                                isPartial
                              });
                              
                              processNextRequest(index + 1);
                            }
                          );
                        }
                      );
                    }
                  );
                }
              };
              
              // Start processing requests for this material
              processNextRequest(0);
            };
            
            // Start processing materials
            processNextMaterial(Object.keys(materialGroups));
          });
        });
      });
    });
  }

  async approveOrderRequest(requestId, sellerNotes = '') {
    // Single approval - delegate to bulk function
    return this.approveOrderRequests([requestId], sellerNotes);
  }

  async declineOrderRequest(requestId, sellerNotes = '') {
    return new Promise((resolve, reject) => {
      // First get the order request details for notification
      this.db.get('SELECT * FROM order_requests WHERE id = ?', [requestId], (err, request) => {
        if (err) {
          return reject(err);
        }
        
        if (!request) {
          return reject(new Error('Order request not found'));
        }
        
        // Update the order request status
        this.db.run(
          'UPDATE order_requests SET status = ?, seller_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['declined', sellerNotes, requestId],
          (err) => {
            if (err) {
              return reject(err);
            }
            
            // Create notification for buyer
            const { v4: uuidv4 } = require('uuid');
            const notificationId = uuidv4();
            this.db.run(
              `INSERT INTO notifications (
                id, user_id, title, message, type, related_id
              ) VALUES (?, ?, ?, ?, ?, ?)`,
              [
                notificationId,
                request.buyer_id,
                'Order Request Declined',
                `Your order request for ${request.quantity} units has been declined by the seller. Reason: ${sellerNotes || 'No reason provided'}`,
                'order_declined',
                requestId
              ],
              (err) => {
                // Don't fail if notification fails
                if (err) {
                  console.error('Failed to create buyer notification:', err);
                }
                
                resolve({ success: true, changes: 1 });
              }
            );
          }
        );
      });
    });
  }


  async updateOrderStatus(orderId, status, sellerNotes = '') {
    return new Promise((resolve, reject) => {
      const updateTime = status === 'approved' ? 'approved_at = CURRENT_TIMESTAMP,' : 
                        status === 'completed' ? 'completed_at = CURRENT_TIMESTAMP,' : '';
      
      this.db.run(
        `UPDATE orders SET 
          status = ?, 
          seller_notes = ?, 
          ${updateTime}
          updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [status, sellerNotes, orderId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ success: true, changes: this.changes });
          }
        }
      );
    });
  }

  async getOrdersBySeller(sellerId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          o.*,
          m.material as material_name,
          m.listing_id,
          m.unit,
          u.name as buyer_name,
          u.company_name as buyer_company
        FROM orders o
        JOIN materials m ON o.material_id = m.id
        JOIN users u ON o.buyer_id = u.id
        WHERE o.seller_id = ?
        ORDER BY o.created_at DESC
      `;
      
      this.db.all(query, [sellerId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getTransactionHistory(sellerId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          th.*,
          CASE 
            WHEN th.buyer_id IS NOT NULL THEN u.name 
            ELSE NULL 
          END as buyer_name,
          fp.name as from_project_name,
          tp.name as to_project_name
        FROM transaction_history th
        LEFT JOIN users u ON th.buyer_id = u.id
        LEFT JOIN projects fp ON th.from_project_id = fp.id
        LEFT JOIN projects tp ON th.to_project_id = tp.id
        WHERE th.seller_id = ?
        ORDER BY th.created_at DESC
      `;
      
      this.db.all(query, [sellerId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async createTransactionRecord(transactionData) {
    return new Promise((resolve, reject) => {
      const { v4: uuidv4 } = require('uuid');
      const transactionId = uuidv4();
      
      this.db.run(
        `INSERT INTO transaction_history (
          id, seller_id, material_id, listing_id, transaction_type, buyer_id, order_id,
          from_project_id, to_project_id, quantity, unit_price, total_amount,
          material_name, buyer_company, buyer_contact, delivery_address, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transactionId, transactionData.sellerId, transactionData.materialId,
          transactionData.listingId, transactionData.transactionType, transactionData.buyerId,
          transactionData.orderId, transactionData.fromProjectId, transactionData.toProjectId,
          transactionData.quantity, transactionData.unitPrice, transactionData.totalAmount,
          transactionData.materialName, transactionData.buyerCompany, transactionData.buyerContact,
          transactionData.deliveryAddress, transactionData.notes || ''
        ],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ success: true, transactionId });
          }
        }
      );
    });
  }

  // Admin methods
  async getAllUsers() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          u.*,
          COUNT(DISTINCT p.id) as project_count,
          COUNT(DISTINCT m.id) as material_count,
          COUNT(DISTINCT o.id) as order_count
        FROM users u
        LEFT JOIN projects p ON u.id = p.seller_id
        LEFT JOIN materials m ON u.id = m.seller_id
        LEFT JOIN orders o ON u.id = o.buyer_id OR u.id = o.seller_id
        WHERE u.user_type != 'admin'
        GROUP BY u.id
        ORDER BY u.created_at DESC
      `;
      
      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getAllMaterials() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          m.*,
          u.name as seller_name,
          u.company_name as seller_company,
          p.name as project_name,
          COUNT(DISTINCT or.id) as pending_requests,
          COUNT(DISTINCT o.id) as completed_orders
        FROM materials m
        JOIN users u ON m.seller_id = u.id
        LEFT JOIN projects p ON m.project_id = p.id
        LEFT JOIN order_requests or ON m.id = or.material_id AND or.status = 'pending'
        LEFT JOIN orders o ON m.id = o.material_id
        GROUP BY m.id
        ORDER BY m.created_at DESC
      `;
      
      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getAllOrderRequests() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          r.*,
          m.material as material_name,
          m.listing_id,
          u_buyer.name as buyer_name,
          u_buyer.company_name as buyer_company,
          u_seller.name as seller_name,
          u_seller.company_name as seller_company
        FROM order_requests r
        JOIN materials m ON r.material_id = m.id
        JOIN users u_buyer ON r.buyer_id = u_buyer.id
        JOIN users u_seller ON r.seller_id = u_seller.id
        ORDER BY r.created_at DESC
      `;
      
      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getAllOrders() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          o.*,
          m.material as material_name,
          m.listing_id,
          u_buyer.name as buyer_name,
          u_buyer.company_name as buyer_company,
          u_seller.name as seller_name,
          u_seller.company_name as seller_company
        FROM orders o
        JOIN materials m ON o.material_id = m.id
        JOIN users u_buyer ON o.buyer_id = u_buyer.id
        JOIN users u_seller ON o.seller_id = u_seller.id
        ORDER BY o.created_at DESC
      `;
      
      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async deleteMaterial(materialId) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM materials WHERE id = ?', [materialId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ success: true, changes: this.changes });
        }
      });
    });
  }

  async deleteMaterialBySeller(materialId, sellerId) {
    return new Promise((resolve, reject) => {
      // First check if the material belongs to this seller
      this.db.get('SELECT id, seller_id FROM materials WHERE id = ?', [materialId], (err, material) => {
        if (err) {
          return reject(err);
        }
        
        if (!material) {
          return reject(new Error('Material not found'));
        }
        
        if (material.seller_id !== sellerId) {
          return reject(new Error('Unauthorized: You can only delete your own materials'));
        }
        
        // Delete the material
        this.db.run('DELETE FROM materials WHERE id = ? AND seller_id = ?', [materialId, sellerId], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ success: true, changes: this.changes });
          }
        });
      });
    });
  }

  async updateMaterial(materialId, updateData) {
    return new Promise((resolve, reject) => {
      const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
      const values = Object.values(updateData);
      values.push(materialId);
      
      this.db.run(
        `UPDATE materials SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values,
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ success: true, changes: this.changes });
          }
        }
      );
    });
  }

  // Lock material for editing
  async lockMaterialForEdit(materialId, userId) {
    return new Promise((resolve, reject) => {
      // First check if material is already being edited
      this.db.get('SELECT is_being_edited, edited_by, edit_started_at FROM materials WHERE id = ?', [materialId], (err, material) => {
        if (err) {
          return reject(err);
        }
        
        if (!material) {
          return reject(new Error('Material not found'));
        }
        
        // Check if already being edited by someone else
        if (material.is_being_edited && material.edited_by !== userId) {
          // Check if edit session has timed out (15 minutes)
          const editStarted = new Date(material.edit_started_at);
          const now = new Date();
          const diffMinutes = (now - editStarted) / 1000 / 60;
          
          if (diffMinutes < 15) {
            return reject(new Error('Material is currently being edited by another user'));
          }
        }
        
        // Lock the material for editing
        this.db.run(
          'UPDATE materials SET is_being_edited = 1, edited_by = ?, edit_started_at = CURRENT_TIMESTAMP WHERE id = ?',
          [userId, materialId],
          function(err) {
            if (err) {
              reject(err);
            } else {
              resolve({ success: true, locked: true });
            }
          }
        );
      });
    });
  }

  // Unlock material after editing
  async unlockMaterial(materialId, userId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE materials SET is_being_edited = 0, edited_by = NULL, edit_started_at = NULL WHERE id = ? AND (edited_by = ? OR edited_by IS NULL)',
        [materialId, userId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ success: true, unlocked: true, changes: this.changes });
          }
        }
      );
    });
  }

  // Update material with edit lock check
  async updateMaterialWithLock(materialId, userId, updateData) {
    return new Promise((resolve, reject) => {
      // First check if user has lock on this material
      this.db.get('SELECT is_being_edited, edited_by FROM materials WHERE id = ?', [materialId], (err, material) => {
        if (err) {
          return reject(err);
        }
        
        if (!material) {
          return reject(new Error('Material not found'));
        }
        
        // Check if material is locked by another user
        if (material.is_being_edited && material.edited_by !== userId) {
          return reject(new Error('Material is being edited by another user'));
        }
        
        // Update the material
        const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
        const values = Object.values(updateData);
        values.push(materialId);
        
        this.db.run(
          `UPDATE materials SET ${fields}, updated_at = CURRENT_TIMESTAMP, is_being_edited = 0, edited_by = NULL, edit_started_at = NULL WHERE id = ?`,
          values,
          function(err) {
            if (err) {
              reject(err);
            } else {
              resolve({ success: true, changes: this.changes });
            }
          }
        );
      });
    });
  }

  // Check if material is locked for editing
  async isMaterialLocked(materialId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT is_being_edited, edited_by, edit_started_at FROM materials WHERE id = ?',
        [materialId],
        (err, row) => {
          if (err) {
            reject(err);
          } else if (!row) {
            resolve({ locked: false });
          } else {
            // Check if edit session has timed out (15 minutes)
            if (row.is_being_edited) {
              const editStarted = new Date(row.edit_started_at);
              const now = new Date();
              const diffMinutes = (now - editStarted) / 1000 / 60;
              
              if (diffMinutes >= 15) {
                // Session timed out, automatically unlock
                this.db.run(
                  'UPDATE materials SET is_being_edited = 0, edited_by = NULL, edit_started_at = NULL WHERE id = ?',
                  [materialId],
                  () => {
                    resolve({ locked: false, timedOut: true });
                  }
                );
              } else {
                resolve({ 
                  locked: true, 
                  editedBy: row.edited_by,
                  editStartedAt: row.edit_started_at
                });
              }
            } else {
              resolve({ locked: false });
            }
          }
        }
      );
    });
  }

  async getSystemStats() {
    return new Promise((resolve, reject) => {
      const queries = [
        'SELECT COUNT(*) as total_users FROM users WHERE user_type != "admin"',
        'SELECT COUNT(*) as total_materials FROM materials',
        'SELECT COUNT(*) as pending_requests FROM order_requests WHERE status = "pending"',
        'SELECT COUNT(*) as completed_orders FROM orders',
        'SELECT SUM(total_amount) as total_revenue FROM orders',
        'SELECT COUNT(*) as total_transfers FROM internal_transfers'
      ];
      
      Promise.all(queries.map(query => 
        new Promise((res, rej) => {
          this.db.get(query, [], (err, row) => {
            if (err) rej(err);
            else res(row);
          });
        })
      )).then(results => {
        resolve({
          totalUsers: results[0].total_users,
          totalMaterials: results[1].total_materials,
          pendingRequests: results[2].pending_requests,
          completedOrders: results[3].completed_orders,
          totalRevenue: results[4].total_revenue || 0,
          totalTransfers: results[5].total_transfers
        });
      }).catch(reject);
    });
  }

  async updateUser(userId, updateData) {
    return new Promise((resolve, reject) => {
      const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
      const values = Object.values(updateData);
      values.push(userId);
      
      this.db.run(
        `UPDATE users SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values,
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ success: true, changes: this.changes });
          }
        }
      );
    });
  }

  async deleteUserAndData(userId) {
    return new Promise((resolve, reject) => {
      // Start a transaction to delete user and all associated data
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        // Delete user's materials
        this.db.run('DELETE FROM materials WHERE seller_id = ?', [userId], (err) => {
          if (err) {
            this.db.run('ROLLBACK');
            return reject(err);
          }
          
          // Delete user's projects
          this.db.run('DELETE FROM projects WHERE seller_id = ?', [userId], (err) => {
            if (err) {
              this.db.run('ROLLBACK');
              return reject(err);
            }
            
            // Delete user's orders
            this.db.run('DELETE FROM orders WHERE buyer_id = ? OR seller_id = ?', [userId, userId], (err) => {
              if (err) {
                this.db.run('ROLLBACK');
                return reject(err);
              }
              
              // Delete user's order requests
              this.db.run('DELETE FROM order_requests WHERE buyer_id = ? OR seller_id = ?', [userId, userId], (err) => {
                if (err) {
                  this.db.run('ROLLBACK');
                  return reject(err);
                }
                
                // Finally, delete the user
                this.db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
                  if (err) {
                    this.db.run('ROLLBACK');
                    return reject(err);
                  }
                  
                  this.db.run('COMMIT');
                  resolve({ success: true });
                });
              });
            });
          });
        });
      });
    });
  }

  async updateOrderStatus(orderId, status) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, orderId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ success: true, changes: this.changes });
          }
        }
      );
    });
  }
}

module.exports = Database;
