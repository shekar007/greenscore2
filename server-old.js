const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// In-memory data store (replace with database in production)
let materials = [];
let sellers = [];
let buyers = [];
let orders = [];
let projects = [];
let users = [];

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

// Authentication endpoints
app.post('/api/auth/login', (req, res) => {
  const { email, password, userType } = req.body;
  const user = users.find(u => u.email === email && u.password === password);
  
  if (user) {
    // Allow access regardless of original registration type
    res.json({ 
      success: true, 
      user: { 
        id: user.id, 
        email: user.email, 
        userType: userType, // Use the requested user type
        originalUserType: user.userType,
        name: user.name,
        companyName: user.companyName
      } 
    });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

app.post('/api/auth/register', (req, res) => {
  const { email, password, name, userType, companyName } = req.body;
  
  // Check if user already exists
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ success: false, message: 'User already exists' });
  }
  
  const user = {
    id: uuidv4(),
    email,
    password, // In production, hash this!
    name,
    userType,
    companyName: companyName || '',
    createdAt: new Date().toISOString()
  };
  
  users.push(user);
  res.json({ success: true, user: { id: user.id, email: user.email, userType: user.userType, name: user.name } });
});

// Project management endpoints
app.get('/api/projects/:sellerId', (req, res) => {
  const { sellerId } = req.params;
  const sellerProjects = projects.filter(project => project.sellerId === sellerId);
  res.json(sellerProjects);
});

app.post('/api/projects', (req, res) => {
  const project = {
    id: uuidv4(),
    ...req.body,
    createdAt: new Date().toISOString()
  };
  projects.push(project);
  res.json({ success: true, project });
});

// Get all categories
app.get('/api/categories', (req, res) => {
  res.json(categories);
});

// Get all materials for buyers (without seller info)
app.get('/api/materials', (req, res) => {
  const { category, search } = req.query;
  // Only show materials marked for resale and available quantity > 0
  let filteredMaterials = materials.filter(material => 
    material.qty > 0 && material.listingType === 'resale'
  );
  
  if (category && category !== 'all') {
    filteredMaterials = filteredMaterials.filter(material => 
      material.category === category
    );
  }
  
  if (search) {
    filteredMaterials = filteredMaterials.filter(material =>
      material.material.toLowerCase().includes(search.toLowerCase()) ||
      (material.brand && material.brand.toLowerCase().includes(search.toLowerCase())) ||
      (material.specs && material.specs.toLowerCase().includes(search.toLowerCase()))
    );
  }
  
  // Remove seller-specific information for buyers
  const buyerMaterials = filteredMaterials.map(({ sellerId, projectId, listingType, ...material }) => material);
  
  res.json(buyerMaterials);
});

// Get seller's materials with filtering
app.get('/api/seller/:sellerId/materials', (req, res) => {
  const { sellerId } = req.params;
  const { projectId, inventoryType, listingType } = req.query;
  
  let sellerMaterials = materials.filter(material => material.sellerId === sellerId);
  
  if (projectId && projectId !== 'all') {
    sellerMaterials = sellerMaterials.filter(material => material.projectId === projectId);
  }
  
  if (inventoryType && inventoryType !== 'all') {
    sellerMaterials = sellerMaterials.filter(material => material.inventoryType === inventoryType);
  }
  
  if (listingType && listingType !== 'all') {
    sellerMaterials = sellerMaterials.filter(material => material.listingType === listingType);
  }
  
  res.json(sellerMaterials);
});

// Update material listing type
app.put('/api/materials/:materialId/listing-type', (req, res) => {
  const { materialId } = req.params;
  const { listingType, targetProjectId } = req.body;
  
  const material = materials.find(m => m.id === materialId);
  if (!material) {
    return res.status(404).json({ error: 'Material not found' });
  }
  
  material.listingType = listingType;
  if (listingType === 'internal_transfer' && targetProjectId) {
    material.targetProjectId = targetProjectId;
  }
  
  res.json({ success: true, material });
});

// Add material
app.post('/api/materials', (req, res) => {
  const material = {
    id: uuidv4(),
    ...req.body,
    createdAt: new Date().toISOString()
  };
  materials.push(material);
  res.json({ success: true, material });
});

// Enhanced CSV upload endpoint with flexible column extraction
app.post('/api/upload-csv', upload.single('csvFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { sellerId, projectId } = req.body;
  const results = [];
  const errors = [];
  let rowIndex = 0;
  
  // Column mapping for flexible CSV parsing
  const columnMappings = {
    material: ['material', 'item', 'product', 'name', 'description'],
    qty: ['qty', 'qty.', 'quantity', 'amount', 'count'],
    unit: ['unit', 'units', 'measurement', 'uom'],
    brand: ['brand', 'manufacturer', 'make'],
    condition: ['condition', 'state', 'quality'],
    priceToday: ['price today', 'current price', 'selling price', 'price', 'cost'],
    mrp: ['mrp', 'retail price', 'original price', 'list price'],
    pricePurchased: ['price purchased', 'purchase price', 'bought price'],
    inventoryType: ['inventory type', 'type', 'category type'],
    specs: ['specs', 'specifications', 'details', 'description'],
    photo: ['photo', 'image', 'picture', 'url'],
    specsPhoto: ['specs photo', 'spec image', 'specification image']
  };
  
  function findColumnValue(data, fieldMappings) {
    for (const mapping of fieldMappings) {
      const value = data[mapping] || data[mapping.toLowerCase()] || data[mapping.toUpperCase()];
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
    return null;
  }
  
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => {
      rowIndex++;
      
      // Extract material name (mandatory)
      const materialName = findColumnValue(data, columnMappings.material);
      if (!materialName) {
        errors.push(`Row ${rowIndex}: Material name is required`);
        return;
      }
      
      // Extract quantity (mandatory)
      const qtyValue = findColumnValue(data, columnMappings.qty);
      const qty = parseInt(qtyValue) || 0;
      if (qty <= 0) {
        errors.push(`Row ${rowIndex}: Valid quantity is required`);
        return;
      }
      
      // Extract selling price (mandatory)
      const priceValue = findColumnValue(data, columnMappings.priceToday);
      const priceToday = parseFloat(priceValue) || 0;
      if (priceToday <= 0) {
        errors.push(`Row ${rowIndex}: Valid selling price is required`);
        return;
      }
      
      // Create material object with extracted data
      const material = {
        id: uuidv4(),
        sellerId: sellerId,
        projectId: projectId || 'default',
        photo: findColumnValue(data, columnMappings.photo) || '',
        material: materialName,
        unit: findColumnValue(data, columnMappings.unit) || 'pcs',
        qty: qty,
        brand: findColumnValue(data, columnMappings.brand) || '',
        specsPhoto: findColumnValue(data, columnMappings.specsPhoto) || '',
        specs: findColumnValue(data, columnMappings.specs) || '',
        condition: findColumnValue(data, columnMappings.condition) || 'good',
        mrp: parseFloat(findColumnValue(data, columnMappings.mrp)) || 0,
        pricePurchased: parseFloat(findColumnValue(data, columnMappings.pricePurchased)) || 0,
        priceToday: priceToday,
        inventoryValue: priceToday * qty,
        inventoryType: findColumnValue(data, columnMappings.inventoryType) || 'surplus',
        listingType: 'resale', // Default to resale
        category: categorizeItem(materialName),
        createdAt: new Date().toISOString()
      };
      results.push(material);
    })
    .on('end', () => {
      if (errors.length > 0) {
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ 
          error: 'CSV validation failed', 
          errors: errors,
          message: 'Please fix the errors and re-upload the file'
        });
      }
      
      if (results.length === 0) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ 
          error: 'No valid rows found in CSV file',
          message: 'Please ensure your CSV has the required columns: material, quantity, and price'
        });
      }
      
      materials.push(...results);
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      res.json({ 
        success: true, 
        count: results.length, 
        materials: results,
        message: `Successfully imported ${results.length} items`
      });
    })
    .on('error', (error) => {
      fs.unlinkSync(req.file.path);
      res.status(500).json({ error: 'Error processing CSV file' });
    });
});

// Create order
app.post('/api/orders', (req, res) => {
  const { buyerId, items, totalAmount, platformFee } = req.body;
  
  const order = {
    id: uuidv4(),
    buyerId,
    items,
    totalAmount,
    platformFee,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  // Update material quantities
  items.forEach(item => {
    const material = materials.find(m => m.id === item.materialId);
    if (material) {
      material.qty -= item.quantity;
    }
  });
  
  orders.push(order);
  res.json({ success: true, order });
});

// Helper function to categorize items
function categorizeItem(materialName) {
  const name = materialName.toLowerCase();
  
  if (name.includes('door')) return 'Doors';
  if (name.includes('tile') || name.includes('ceramic') || name.includes('marble')) return 'Tiles';
  if (name.includes('handle') || name.includes('knob') || name.includes('lock') || name.includes('hinge')) return 'Handles & Hardware';
  if (name.includes('toilet') || name.includes('sink') || name.includes('basin') || name.includes('faucet')) return 'Toilets & Sanitary';
  if (name.includes('window') || name.includes('glass')) return 'Windows';
  if (name.includes('floor') || name.includes('laminate') || name.includes('vinyl')) return 'Flooring';
  if (name.includes('light') || name.includes('lamp') || name.includes('bulb')) return 'Lighting';
  if (name.includes('paint') || name.includes('primer') || name.includes('varnish')) return 'Paint & Finishes';
  if (name.includes('pipe') || name.includes('plumb')) return 'Plumbing';
  if (name.includes('wire') || name.includes('electric') || name.includes('switch')) return 'Electrical';
  
  return 'Other';
}

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

app.get('/auth.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});

app.listen(PORT, () => {
  console.log(`GreenScore Marketplace server running on port ${PORT}`);
});
