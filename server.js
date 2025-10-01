const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Import our new modules
const Database = require('./database');
const FileParser = require('./fileParser');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database and file parser
const db = new Database();
const fileParser = new FileParser();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Enhanced multer configuration for multiple file types
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}-${originalName}`);
  }
});

// File filter for supported types
const fileFilter = (req, file, cb) => {
  const supportedTypes = fileParser.getSupportedTypes();
  const fileType = fileParser.getFileType(file.originalname, file.mimetype);
  
  if (fileType) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type. Please upload CSV, Excel (.xlsx/.xls), PDF, or ZIP files.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Material categories
const categories = [
  'Doors',
  'Tiles', 
  'Handles & Hardware',
  'Toilets & Sanitary',
  'Windows',
  'Flooring',
  'Lighting',
  'Paint & Finishes',
  'Plumbing',
  'Electrical',
  'Other'
];

// API Routes

// User validation endpoint
app.get('/api/users/:userId/validate', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log('🔍 Validating user:', userId);
    
    const user = await db.findUserById(userId);
    
    if (user) {
      console.log('✅ User validation successful:', user.email);
      res.json({ success: true, user: { id: user.id, email: user.email, name: user.name } });
    } else {
      console.log('❌ User not found:', userId);
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error('❌ Error validating user:', error);
    res.status(500).json({ success: false, message: 'Validation error' });
  }
});

// Authentication endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, userType } = req.body;
    
    const user = await db.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isValidPassword = await db.verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Use the registered user type for redirect, not the login selection
    res.json({ 
      success: true, 
      user: { 
        id: user.id, 
        email: user.email, 
        userType: user.user_type, // Use the registered user type for proper redirect
        originalUserType: user.user_type,
        name: user.name,
        companyName: user.company_name
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, userType, companyName } = req.body;
    
    // Check if user already exists
    const existingUser = await db.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }
    
    const userData = {
      id: uuidv4(),
      email,
      password,
      name,
      userType,
      companyName: companyName || ''
    };
    
    const user = await db.createUser(userData);
    res.json({ 
      success: true, 
      user: { 
        id: user.id, 
        email: user.email, 
        userType: user.userType, 
        name: user.name,
        companyName: user.companyName
      } 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Project management endpoints
app.get('/api/projects/:sellerId', async (req, res) => {
  try {
    const { sellerId } = req.params;
    const projects = await db.getProjectsBySeller(sellerId);
    res.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const projectData = {
      id: uuidv4(),
      ...req.body,
    };
    
    const project = await db.createProject(projectData);
    res.json({ success: true, project });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all categories
app.get('/api/categories', (req, res) => {
  res.json(categories);
});

// Get all materials for buyers (without seller info)
app.get('/api/materials', async (req, res) => {
  try {
    const { category, search } = req.query;
    const filters = { category, search };
    
    const materials = await db.getMaterialsForBuyers(filters);
    res.json(materials);
  } catch (error) {
    console.error('Get materials error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get seller's materials with filtering
app.get('/api/seller/:sellerId/materials', async (req, res) => {
  try {
    const { sellerId } = req.params;
    const { projectId, inventoryType, listingType } = req.query;
    
    const filters = { projectId, inventoryType, listingType };
    const materials = await db.getMaterialsBySeller(sellerId, filters);
    
    res.json(materials);
  } catch (error) {
    console.error('Get seller materials error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Lock material for editing
app.post('/api/materials/:materialId/lock', async (req, res) => {
  try {
    const { materialId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID required' });
    }
    
    const result = await db.lockMaterialForEdit(materialId, userId);
    res.json(result);
  } catch (error) {
    console.error('Lock material error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Unlock material after editing
app.post('/api/materials/:materialId/unlock', async (req, res) => {
  try {
    const { materialId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID required' });
    }
    
    const result = await db.unlockMaterial(materialId, userId);
    res.json(result);
  } catch (error) {
    console.error('Unlock material error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update material with lock check
app.put('/api/materials/:materialId/edit', async (req, res) => {
  try {
    const { materialId } = req.params;
    const { userId, ...updateData } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID required' });
    }
    
    const result = await db.updateMaterialWithLock(materialId, userId, updateData);
    res.json(result);
  } catch (error) {
    console.error('Update material error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Check if material is locked
app.get('/api/materials/:materialId/lock-status', async (req, res) => {
  try {
    const { materialId } = req.params;
    const lockStatus = await db.isMaterialLocked(materialId);
    res.json(lockStatus);
  } catch (error) {
    console.error('Check lock status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete material (seller can only delete their own materials)
app.delete('/api/seller/:sellerId/materials/:materialId', async (req, res) => {
  try {
    const { sellerId, materialId } = req.params;
    const result = await db.deleteMaterialBySeller(materialId, sellerId);
    res.json(result);
  } catch (error) {
    console.error('Delete material error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update material listing type
app.put('/api/materials/:materialId/listing-type', async (req, res) => {
  try {
    const { materialId } = req.params;
    const { listingType, targetProjectId } = req.body;
    
    await db.updateMaterialListingType(materialId, listingType, targetProjectId);
    res.json({ success: true });
  } catch (error) {
    console.error('Update listing type error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add single material
app.post('/api/materials', async (req, res) => {
  try {
    const materialData = {
      id: uuidv4(),
      ...req.body,
    };
    
    const material = await db.createMaterial(materialData);
    res.json({ success: true, material });
  } catch (error) {
    console.error('Create material error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete material (for sellers - own materials only)
app.delete('/api/materials/:materialId', async (req, res) => {
  try {
    const { materialId } = req.params;
    const { sellerId } = req.body;
    
    if (!sellerId) {
      return res.status(400).json({ success: false, error: 'Seller ID is required' });
    }
    
    const result = await db.deleteMaterialBySeller(materialId, sellerId);
    res.json({ success: true, message: 'Material deleted successfully' });
  } catch (error) {
    console.error('❌ Delete material error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to delete material' });
  }
});

// Internal transfer endpoints
app.post('/api/internal-transfer', async (req, res) => {
  try {
    const { userId, materialId, fromProjectId, toProjectId, quantityTransferred, notes } = req.body;
    
    // Validate required fields
    if (!userId || !materialId || !fromProjectId || !toProjectId || !quantityTransferred) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }
    
    if (quantityTransferred <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Transfer quantity must be greater than 0' 
      });
    }
    
    if (fromProjectId === toProjectId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot transfer to the same project' 
      });
    }
    
    const transferData = {
      id: uuidv4(),
      userId,
      materialId,
      fromProjectId,
      toProjectId,
      quantityTransferred: parseInt(quantityTransferred),
      notes
    };
    
    console.log('🔄 Creating internal transfer:', transferData);
    
    const result = await db.createInternalTransfer(transferData);
    
    console.log('✅ Transfer completed:', result);
    res.json(result);
    
  } catch (error) {
    console.error('❌ Error creating internal transfer:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to create internal transfer' 
    });
  }
});

// Get transfer history for a user
app.get('/api/internal-transfers/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log('📋 Fetching transfer history for user:', userId);
    
    const transfers = await db.getInternalTransfersByUser(userId);
    
    console.log('✅ Found transfers:', transfers.length);
    res.json(transfers);
    
  } catch (error) {
    console.error('❌ Error fetching transfer history:', error);
    res.status(500).json({ error: 'Failed to fetch transfer history' });
  }
});

// Update material listing type and acquisition status
app.put('/api/materials/:materialId/listing-type', async (req, res) => {
  try {
    const { materialId } = req.params;
    const { listingType, acquisitionType } = req.body;
    
    console.log('🔄 Updating material listing:', { materialId, listingType, acquisitionType });
    
    const result = await db.updateMaterialListing(materialId, listingType, acquisitionType);
    
    console.log('✅ Material listing updated:', result);
    res.json({ success: true });
    
  } catch (error) {
    console.error('❌ Error updating material listing:', error);
    res.status(500).json({ error: 'Failed to update material listing' });
  }
});

// Notification endpoints
app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { unread_only } = req.query;
    
    const notifications = await db.getUserNotifications(userId, unread_only === 'true');
    
    res.json({ success: true, notifications });
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
});

app.post('/api/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { title, message, type, data } = req.body;
    
    const result = await db.createNotification(userId, title, message, type, data);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error creating notification:', error);
    res.status(500).json({ success: false, error: 'Failed to create notification' });
  }
});

app.put('/api/notifications/:notificationId/read', async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const result = await db.markNotificationAsRead(notificationId);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    res.status(500).json({ success: false, error: 'Failed to mark notification as read' });
  }
});

app.put('/api/notifications/:userId/mark-all-read', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await db.markAllNotificationsAsRead(userId);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error);
    res.status(500).json({ success: false, error: 'Failed to mark all notifications as read' });
  }
});

// Enhanced file upload endpoint supporting CSV, Excel, and PDF
app.post('/api/upload-file', upload.single('file'), async (req, res) => {
  console.log('🔥 UPLOAD REQUEST RECEIVED');
  console.log('📁 File:', req.file ? req.file.originalname : 'NO FILE');
  console.log('👤 Seller ID:', req.body.sellerId);
  console.log('🏗️ Project ID:', req.body.projectId);
  
  try {
    if (!req.file) {
      console.log('❌ ERROR: No file uploaded');
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded',
        message: 'Please select a file to upload'
      });
    }

    const { sellerId, projectId } = req.body;
    console.log('✅ Validating request data...');
    
    if (!sellerId) {
      console.log('❌ ERROR: Seller ID missing');
      return res.status(400).json({
        success: false,
        error: 'Seller ID is required',
        message: 'Please provide seller information'
      });
    }

    if (!projectId) {
      console.log('❌ ERROR: Project ID missing');
      return res.status(400).json({
        success: false,
        error: 'Project ID is required', 
        message: 'Please select a project before uploading'
      });
    }
    
    console.log('✅ Request validation passed');

    // Determine file type
    const fileType = fileParser.getFileType(req.file.originalname, req.file.mimetype);
    console.log('🔍 Detected file type:', fileType);
    
    if (!fileType) {
      console.log('❌ ERROR: Unsupported file type');
      fs.unlinkSync(req.file.path); // Clean up
      return res.status(400).json({
        success: false,
        error: 'Unsupported file type',
        message: 'Please upload CSV, Excel (.xlsx/.xls), PDF, or ZIP files only'
      });
    }

    console.log(`🔄 Processing ${fileType.toUpperCase()} file: ${req.file.originalname}`);

    // Parse the file
    console.log('📊 Starting file parsing...');
    const parseResult = await fileParser.parseFile(
      req.file.path, 
      fileType, 
      sellerId, 
      projectId
    );
    
    console.log('📊 Parse result:', {
      success: parseResult.success,
      materialsCount: parseResult.materials?.length || 0,
      errors: parseResult.errors?.length || 0
    });

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error,
        message: 'Failed to parse file',
        errors: parseResult.errors
      });
    }

    // If no valid materials found
    if (parseResult.materials.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid materials found',
        message: 'Please ensure your file contains valid material data with required columns: material name, quantity, and price',
        errors: parseResult.errors
      });
    }

    // If there are errors but some materials were processed
    if (parseResult.errors.length > 0) {
      // Save successful materials to database
      if (parseResult.materials.length > 0) {
        await db.createMaterialsBulk(parseResult.materials);
      }

      // Log the upload
      await db.createUploadLog({
        id: uuidv4(),
        userId: sellerId,
        projectId: projectId,
        filename: req.file.originalname,
        fileType: fileType,
        totalRows: parseResult.totalRows,
        successfulRows: parseResult.successfulRows,
        failedRows: parseResult.failedRows,
        errors: parseResult.errors
      });

      return res.status(206).json({ // 206 Partial Content
        success: true,
        partialSuccess: true,
        count: parseResult.successfulRows,
        totalRows: parseResult.totalRows,
        failedRows: parseResult.failedRows,
        materials: parseResult.materials,
        errors: parseResult.errors.slice(0, 10), // Limit errors shown
        message: `Successfully imported ${parseResult.successfulRows} items. ${parseResult.failedRows} items had errors.`
      });
    }

    // All materials processed successfully
    console.log('💾 Saving materials to database...');
    console.log('📊 Materials to save:', parseResult.materials.length);
    
    const dbResult = await db.createMaterialsBulk(parseResult.materials);
    console.log('✅ Database save result:', dbResult);

    // Log the successful upload
    console.log('📝 Creating upload log...');
    await db.createUploadLog({
      id: uuidv4(),
      userId: sellerId,
      projectId: projectId,
      filename: req.file.originalname,
      fileType: fileType,
      totalRows: parseResult.totalRows,
      successfulRows: parseResult.successfulRows,
      failedRows: 0,
      errors: []
    });

    console.log('🎉 UPLOAD COMPLETED SUCCESSFULLY!');
    console.log('📊 Final stats:', {
      totalMaterials: parseResult.materials.length,
      fileName: req.file.originalname,
      fileType: fileType.toUpperCase()
    });

    res.json({ 
      success: true, 
      count: parseResult.materials.length,
      materials: parseResult.materials,
      message: `Successfully imported ${parseResult.materials.length} items from ${fileType.toUpperCase()} file`
    });

  } catch (error) {
    console.error('File upload error:', error);
    
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ 
      success: false,
      error: 'Server error during file processing',
      message: 'An error occurred while processing your file. Please try again.',
      details: error.message
    });
  }
});

// Get supported file types endpoint
app.get('/api/supported-file-types', (req, res) => {
  res.json(fileParser.getSupportedTypes());
});

// Create order request (buyers request to purchase at seller's price)
app.post('/api/order-requests', async (req, res) => {
  try {
    const { buyerId, materialId, quantity, companyName, contactPerson, email, phone, deliveryAddress, deliveryNotes } = req.body;
    
    console.log('🛒 Processing order request:', { buyerId, materialId, quantity });
    
    // Validate request data
    if (!materialId || !quantity) {
      return res.status(400).json({ success: false, error: 'Missing required order information' });
    }
    
    // Get material info to find seller and price
    const material = await new Promise((resolve, reject) => {
      db.db.get('SELECT * FROM materials WHERE id = ?', [materialId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!material) {
      return res.status(404).json({ success: false, error: 'Material not found' });
    }
    
    if (quantity > material.quantity) {
      return res.status(400).json({ success: false, error: 'Insufficient quantity available' });
    }
    
    const unitPrice = material.price_today;
    const totalAmount = unitPrice * quantity;
    
    const requestData = {
      materialId,
      buyerId,
      sellerId: material.seller_id,
      quantity,
      unitPrice,
      totalAmount,
      companyName,
      contactPerson,
      email,
      phone,
      deliveryAddress,
      deliveryNotes
    };
    
    const requestResult = await db.createOrderRequest(requestData);
    
    if (requestResult.success) {
      // Only create notification if this is not part of a batch
      const batchId = req.body.batchId;
      if (!batchId) {
        await db.createNotification(material.seller_id, 'New Order Request!', 
          `Order request for ${material.material} - ${quantity} units at ₹${unitPrice}/unit = ₹${totalAmount.toFixed(2)}`, 'order_request', {
            requestId: requestResult.requestId,
            materialId,
            buyerId,
            quantity,
            unitPrice,
            totalAmount,
            buyerInfo: { companyName, contactPerson, email, phone, deliveryAddress }
          });
      }
      
      res.json({ 
        success: true, 
        message: 'Order request submitted successfully',
        requestId: requestResult.requestId,
        material: material.material,
        sellerId: material.seller_id
      });
    } else {
      res.status(500).json({ success: false, error: 'Failed to create order request' });
    }
    
  } catch (error) {
    console.error('❌ Create order request error:', error);
    res.status(500).json({ success: false, error: 'Failed to process order request' });
  }
});

// Create batch order notification
app.post('/api/order-requests/batch-notification', async (req, res) => {
  try {
    const { sellerId, buyerId, companyName, items, totalAmount } = req.body;
    
    const itemCount = items.length;
    const itemSummary = items.slice(0, 3).map(item => item.material).join(', ');
    const moreItems = itemCount > 3 ? ` and ${itemCount - 3} more items` : '';
    
    await db.createNotification(sellerId, 'New Order Request!', 
      `${companyName} ordered ${itemCount} items (${itemSummary}${moreItems}) - Total: ₹${totalAmount.toFixed(2)}`, 
      'order_request', {
        batchOrder: true,
        buyerId,
        items,
        totalAmount,
        buyerInfo: { companyName }
      });
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Batch notification error:', error);
    res.status(500).json({ success: false, error: 'Failed to create notification' });
  }
});

// Get order requests for seller
app.get('/api/seller/:sellerId/order-requests', async (req, res) => {
  try {
    const { sellerId } = req.params;
    const requests = await db.getOrderRequestsBySeller(sellerId);
    res.json({ success: true, requests });
  } catch (error) {
    console.error('❌ Get order requests error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch order requests' });
  }
});

// Get order requests for specific material
app.get('/api/material/:materialId/order-requests', async (req, res) => {
  try {
    const { materialId } = req.params;
    const requests = await db.getOrderRequestsForMaterial(materialId);
    res.json({ success: true, requests });
  } catch (error) {
    console.error('❌ Get material order requests error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch material order requests' });
  }
});

// Approve order request (and create order)
app.put('/api/order-requests/:requestId/approve', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { sellerNotes } = req.body;
    
    const result = await db.approveOrderRequest(requestId, sellerNotes);
    
    if (result.success) {
      console.log(`Order request ${requestId} approved`);
      
      res.json({ 
        success: true, 
        message: 'Order request approved successfully',
        results: result.results
      });
    } else {
      res.status(500).json({ success: false, error: 'Failed to approve order request' });
    }
  } catch (error) {
    console.error('❌ Approve order request error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to approve order request' });
  }
});

// Bulk approve order requests
app.put('/api/order-requests/bulk-approve', async (req, res) => {
  try {
    const { requestIds, sellerNotes } = req.body;
    
    if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No request IDs provided' });
    }
    
    const result = await db.approveOrderRequests(requestIds, sellerNotes || 'Bulk approved by seller');
    
    if (result.success) {
      console.log(`Bulk approval: ${result.totalApproved}/${result.totalProcessed} requests approved`);
      
      res.json({ 
        success: true, 
        message: `Successfully processed ${result.totalProcessed} requests. ${result.totalApproved} approved.`,
        results: result.results,
        totalProcessed: result.totalProcessed,
        totalApproved: result.totalApproved
      });
    } else {
      res.status(500).json({ success: false, error: 'Failed to approve order requests' });
    }
  } catch (error) {
    console.error('❌ Bulk approve order requests error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to approve order requests' });
  }
});

// Decline order request
app.put('/api/order-requests/:requestId/decline', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { sellerNotes } = req.body;
    
    const result = await db.declineOrderRequest(requestId, sellerNotes);
    
    if (result.success) {
      res.json({ success: true, message: 'Order request declined successfully' });
    } else {
      res.status(500).json({ success: false, error: 'Failed to decline order request' });
    }
  } catch (error) {
    console.error('❌ Decline order request error:', error);
    res.status(500).json({ success: false, error: 'Failed to decline order request' });
  }
});

// Get transaction history for seller
app.get('/api/seller/:sellerId/transactions', async (req, res) => {
  try {
    const { sellerId } = req.params;
    const transactions = await db.getTransactionHistory(sellerId);
    res.json({ success: true, transactions });
  } catch (error) {
    console.error('❌ Get transaction history error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch transaction history' });
  }
});

// Get orders for seller
app.get('/api/seller/:sellerId/orders', async (req, res) => {
  try {
    const { sellerId } = req.params;
    const orders = await db.getOrdersBySeller(sellerId);
    res.json(orders);
  } catch (error) {
    console.error('❌ Get seller orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Export seller orders as CSV
app.get('/api/seller/:sellerId/orders/export', async (req, res) => {
  try {
    const { sellerId } = req.params;
    const orders = await db.getOrdersBySeller(sellerId);
    
    // Create CSV content
    const headers = [
      'Order ID', 'Transaction Date & Time', 'Status', 'Material', 'Quantity', 'Unit Price',
      'Total Amount', 'Platform Fee', 'Buyer Name', 'Buyer Company',
      'Shipping Address', 'Delivery Notes'
    ];
    
    const csvRows = [headers.join(',')];
    
    orders.forEach(order => {
      const row = [
        order.id.substring(0, 8),
        new Date(order.created_at).toLocaleString(),
        order.status,
        order.material_name || '',
        order.quantity,
        order.unit_price || '',
        order.total_amount || '',
        order.platform_fee || '',
        order.buyer_name || '',
        order.buyer_company || '',
        (order.shipping_address || '').replace(/,/g, ';'),
        (order.delivery_notes || '').replace(/,/g, ';')
      ];
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=order-history.csv');
    res.send(csvContent);
    
  } catch (error) {
    console.error('❌ Export order history error:', error);
    res.status(500).json({ error: 'Failed to export order history' });
  }
});

// Export transaction history as CSV
app.get('/api/seller/:sellerId/transactions/export', async (req, res) => {
  try {
    const { sellerId } = req.params;
    const transactions = await db.getTransactionHistory(sellerId);
    
    // Create CSV content
    const headers = [
      'Date', 'Transaction Type', 'Material', 'Listing ID', 'Quantity', 
      'Unit Price', 'Total Amount', 'Buyer Name', 'Buyer Company', 
      'Delivery Address', 'Notes'
    ];
    
    const csvRows = [headers.join(',')];
    
    transactions.forEach(tx => {
      const row = [
        new Date(tx.created_at).toLocaleDateString(),
        tx.transaction_type,
        tx.material_name,
        tx.listing_id || '',
        tx.quantity,
        tx.unit_price || '',
        tx.total_amount || '',
        tx.buyer_name || '',
        tx.buyer_company || '',
        tx.delivery_address || '',
        (tx.notes || '').replace(/,/g, ';') // Replace commas to avoid CSV issues
      ];
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=transaction-history.csv');
    res.send(csvContent);
    
  } catch (error) {
    console.error('❌ Export transaction history error:', error);
    res.status(500).json({ success: false, error: 'Failed to export transaction history' });
  }
});

// Admin routes
app.get('/api/admin/stats', async (req, res) => {
  try {
    const stats = await db.getSystemStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('❌ Get admin stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch system stats' });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await db.getAllUsers();
    res.json({ success: true, users });
      } catch (error) {
    console.error('❌ Get all users error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

app.get('/api/admin/materials', async (req, res) => {
  try {
    const materials = await db.getAllMaterials();
    res.json({ success: true, materials });
  } catch (error) {
    console.error('❌ Get all materials error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch materials' });
  }
});

app.get('/api/admin/order-requests', async (req, res) => {
  try {
    const requests = await db.getAllOrderRequests();
    res.json({ success: true, requests });
  } catch (error) {
    console.error('❌ Get all order requests error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch order requests' });
  }
});

app.get('/api/admin/orders', async (req, res) => {
  try {
    const orders = await db.getAllOrders();
    res.json({ success: true, orders });
  } catch (error) {
    console.error('❌ Get all orders error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

app.delete('/api/admin/materials/:materialId', async (req, res) => {
  try {
    const { materialId } = req.params;
    const result = await db.deleteMaterial(materialId);
    res.json({ success: true, message: 'Material deleted successfully' });
  } catch (error) {
    console.error('❌ Delete material error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete material' });
  }
});

app.put('/api/admin/materials/:materialId', async (req, res) => {
  try {
    const { materialId } = req.params;
    const updateData = req.body;
    const result = await db.updateMaterial(materialId, updateData);
    res.json({ success: true, message: 'Material updated successfully' });
  } catch (error) {
    console.error('❌ Update material error:', error);
    res.status(500).json({ success: false, error: 'Failed to update material' });
  }
});

// Admin user management endpoints
app.put('/api/admin/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;
    const result = await db.updateUser(userId, updateData);
    res.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    console.error('❌ Update user error:', error);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

app.delete('/api/admin/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    // Delete user and all their associated data
    await db.deleteUserAndData(userId);
    res.json({ success: true, message: 'User and associated data deleted successfully' });
  } catch (error) {
    console.error('❌ Delete user error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
});

// Admin order status update
app.put('/api/admin/orders/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const result = await db.updateOrderStatus(orderId, status);
    res.json({ success: true, message: 'Order status updated successfully' });
  } catch (error) {
    console.error('❌ Update order status error:', error);
    res.status(500).json({ success: false, error: 'Failed to update order status' });
  }
});

// Admin order request management
app.put('/api/admin/order-requests/:requestId/approve', async (req, res) => {
  try {
    const { requestId } = req.params;
    await db.updateOrderRequestStatus(requestId, 'approved');
    res.json({ success: true, message: 'Order request approved successfully' });
  } catch (error) {
    console.error('❌ Approve request error:', error);
    res.status(500).json({ success: false, error: 'Failed to approve request' });
  }
});

app.put('/api/admin/order-requests/:requestId/reject', async (req, res) => {
  try {
    const { requestId } = req.params;
    await db.updateOrderRequestStatus(requestId, 'declined');
    res.json({ success: true, message: 'Order request rejected successfully' });
  } catch (error) {
    console.error('❌ Reject request error:', error);
    res.status(500).json({ success: false, error: 'Failed to reject request' });
  }
});

// Admin export endpoints
app.get('/api/admin/export/users', async (req, res) => {
  try {
    const users = await db.getAllUsers();
    
    const headers = ['Name', 'Email', 'Company', 'User Type', 'Projects', 'Materials', 'Orders', 'Created Date', 'Status'];
    const csvRows = [headers.join(',')];
    
    users.forEach(user => {
      const row = [
        user.name,
        user.email,
        user.company_name || '',
        user.user_type,
        user.project_count,
        user.material_count,
        user.order_count,
        new Date(user.created_at).toLocaleDateString(),
        user.verification_status
      ];
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=users-report.csv');
    res.send(csvContent);
  } catch (error) {
    console.error('❌ Export users error:', error);
    res.status(500).json({ success: false, error: 'Failed to export users' });
  }
});

app.get('/api/admin/export/materials', async (req, res) => {
  try {
    const materials = await db.getAllMaterials();
    
    const headers = [
      'Material', 'Listing ID', 'Item ID', 'Seller', 'Company', 'Project', 'Category', 
      'Quantity', 'Unit', 'Price', 'Status', 'Pending Requests', 'Completed Orders', 'Created Date'
    ];
    const csvRows = [headers.join(',')];
    
    materials.forEach(material => {
      const row = [
        material.material,
        material.listing_id || '',
        material.id,
        material.seller_name,
        material.seller_company || '',
        material.project_name || '',
        material.category,
        material.quantity,
        material.unit,
        material.price_today,
        material.listing_type,
        material.pending_requests,
        material.completed_orders,
        new Date(material.created_at).toLocaleDateString()
      ];
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=materials-report.csv');
    res.send(csvContent);
  } catch (error) {
    console.error('❌ Export materials error:', error);
    res.status(500).json({ success: false, error: 'Failed to export materials' });
  }
});

app.get('/api/admin/export/order-requests', async (req, res) => {
  try {
    const requests = await db.getAllOrderRequests();
    
    const headers = [
      'Request ID', 'Material', 'Listing ID', 'Buyer', 'Buyer Company', 'Seller', 'Seller Company',
      'Quantity', 'Unit Price', 'Total Amount', 'Status', 'Delivery Address', 'Request Date & Time'
    ];
    const csvRows = [headers.join(',')];
    
    requests.forEach(request => {
      const row = [
        request.id,
        request.material_name,
        request.listing_id || '',
        request.buyer_name,
        request.buyer_company || '',
        request.seller_name,
        request.seller_company || '',
        request.quantity,
        request.unit_price,
        request.total_amount,
        request.status,
        request.delivery_address || '',
        new Date(request.created_at).toLocaleString()
      ];
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=order-requests-report.csv');
    res.send(csvContent);
  } catch (error) {
    console.error('❌ Export order requests error:', error);
    res.status(500).json({ success: false, error: 'Failed to export order requests' });
  }
});

app.get('/api/admin/export/orders', async (req, res) => {
  try {
    const orders = await db.getAllOrders();
    
    const headers = [
      'Order ID', 'Material', 'Listing ID', 'Buyer', 'Buyer Company', 'Seller', 'Seller Company',
      'Quantity', 'Unit Price', 'Total Amount', 'Platform Fee', 'Status', 'Transaction Date & Time'
    ];
    const csvRows = [headers.join(',')];
    
    orders.forEach(order => {
      const row = [
        order.id,
        order.material_name,
        order.listing_id || '',
        order.buyer_name,
        order.buyer_company || '',
        order.seller_name,
        order.seller_company || '',
        order.quantity,
        order.unit_price,
        order.total_amount,
        order.platform_fee,
        order.status,
        new Date(order.created_at).toLocaleString()
      ];
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=orders-report.csv');
    res.send(csvContent);
  } catch (error) {
    console.error('❌ Export orders error:', error);
    res.status(500).json({ success: false, error: 'Failed to export orders' });
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve main pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/seller', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'seller.html'));
});

app.get('/buyer', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'buyer.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/auth.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    database: 'connected',
    supportedFileTypes: Object.keys(fileParser.getSupportedTypes())
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large',
        message: 'File size must be less than 50MB'
      });
    }
  }
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  db.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 GreenScore Enhanced Marketplace server running on port ${PORT}`);
  console.log(`📁 Supported file types: CSV, Excel (.xlsx/.xls), PDF, ZIP`);
  console.log(`💾 Database: SQLite with persistent storage`);
  console.log(`🔒 Security: Password hashing enabled`);
  console.log(`\n🔑 ADMIN ACCESS CREDENTIALS:`);
  console.log(`   Username: admin@greenscore.com`);
  console.log(`   Password: admin123`);
  console.log(`   Access: http://localhost:${PORT}/admin`);
  console.log(`\n🌐 Available Pages:`);
  console.log(`   Homepage: http://localhost:${PORT}/`);
  console.log(`   Seller Portal: http://localhost:${PORT}/seller`);
  console.log(`   Buyer Portal: http://localhost:${PORT}/buyer`);
  console.log(`   Admin Panel: http://localhost:${PORT}/admin`);
  console.log(`   Authentication: http://localhost:${PORT}/auth.html`);
});
