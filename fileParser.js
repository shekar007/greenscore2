const fs = require('fs');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const pdfParse = require('pdf-parse');
const { v4: uuidv4 } = require('uuid');
const ImageExtractor = require('./imageExtractor');
const yauzl = require('yauzl');
const path = require('path');

class FileParser {
  constructor() {
    // Initialize image extractor
    this.imageExtractor = new ImageExtractor();
    
    // Column mapping for flexible parsing
    this.columnMappings = {
      material: ['material', 'item', 'product', 'name', 'description', 'item name', 'product name', 'material name'],
      qty: ['qty', 'qty.', 'quantity', 'amount', 'count', 'stock', 'available', 'units'],
      unit: ['unit', 'units', 'measurement', 'uom', 'unit of measure'],
      brand: ['brand', 'manufacturer', 'make', 'company'],
      condition: ['condition', 'state', 'quality', 'grade'],
      priceToday: ['price today', 'current price', 'selling price', 'price', 'cost', 'unit price', 'rate'],
      mrp: ['mrp', 'retail price', 'original price', 'list price', 'msrp'],
      pricePurchased: ['price purchased', 'purchase price', 'bought price', 'cost price'],
      inventoryType: ['inventory type', 'type', 'category type', 'stock type'],
      specs: ['specs', 'specifications', 'details', 'description', 'features'],
      photo: ['photo', 'image', 'picture', 'url', 'image url', 'photo url'],
      specsPhoto: ['specs photo', 'spec image', 'specification image', 'tech sheet'],
      category: ['category', 'group', 'class', 'type'],
      dimensions: ['dimensions', 'size', 'measurements', 'length x width', 'l x w x h'],
      weight: ['weight', 'mass', 'kg', 'lbs', 'pounds']
    };
  }

  async parseFile(filePath, fileType, sellerId, projectId) {
    try {
      let data = [];
      let errors = [];
      let totalRows = 0;

      let imageMap = {};
      let extractedImages = [];
      
      switch (fileType.toLowerCase()) {
        case 'csv':
          ({ data, errors, totalRows } = await this.parseCSV(filePath));
          break;
        case 'xlsx':
        case 'xls':
          ({ data, errors, totalRows, extractedImages, imageMap } = await this.parseExcel(filePath));
          break;
        case 'pdf':
          ({ data, errors, totalRows } = await this.parsePDF(filePath));
          break;
        case 'zip':
          ({ data, errors, totalRows, extractedImages, imageMap } = await this.parseZip(filePath));
          break;
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }

      // Process and validate the extracted data
      const processedMaterials = [];
      let rowIndex = 0;

      for (const row of data) {
        rowIndex++;
        try {
          let material;
          
          // For PDF data, row is already processed by processInventoryItem
          if (fileType === 'pdf' && typeof row === 'object' && row.material) {
            material = {
              id: uuidv4(),
              sellerId: sellerId,
              projectId: projectId || 'default',
              ...row,
              createdAt: new Date().toISOString()
            };
          } else {
            // For CSV/Excel data, use processRow
            material = this.processRow(row, sellerId, projectId, rowIndex);
            
            // Handle image assignment with proper priority:
            // 1. Use mapped image from photo column (for ZIP files)
            // 2. Use 'photo' column as URL (for direct URLs)
            // 3. Use extracted embedded image as fallback
            // 4. Set placeholder if neither available
            if (material) {
              // Check if we have a mapped image for this row (from ZIP photo column)
              if (imageMap[rowIndex]) {
                material.photo = imageMap[rowIndex];
                console.log(`📸 Assigned mapped image to row ${rowIndex}: ${material.photo}`);
              } else if (material.photo && material.photo !== '' && material.photo !== 'n/a' && 
                         (material.photo.startsWith('http') || material.photo.startsWith('/'))) {
                // Photo column contains a URL, use it directly
                console.log(`📷 Using photo column URL for row ${rowIndex}: ${material.photo}`);
              } else {
                // No mapped image and no valid URL, set empty for placeholder
                material.photo = '';
                console.log(`🖼️ No image available for row ${rowIndex} - will use frontend placeholder`);
              }
            }
          }
          
          if (material) {
            processedMaterials.push(material);
          }
        } catch (error) {
          errors.push(`Row ${rowIndex}: ${error.message}`);
        }
      }

      return {
        success: true,
        materials: processedMaterials,
        totalRows: totalRows,
        successfulRows: processedMaterials.length,
        failedRows: errors.length,
        errors: errors
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        materials: [],
        totalRows: 0,
        successfulRows: 0,
        failedRows: 0,
        errors: [error.message]
      };
    }
  }

  async parseCSV(filePath) {
    return new Promise((resolve, reject) => {
      const data = [];
      const errors = [];
      let totalRows = 0;

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          totalRows++;
          data.push(row);
        })
        .on('end', () => {
          resolve({ data, errors, totalRows });
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  async parseExcel(filePath) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0]; // Use first sheet
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON with null for empty cells instead of empty strings
      const data = XLSX.utils.sheet_to_json(worksheet, { defval: null });
      
      // Extract images from Excel file
      console.log('🖼️ Extracting embedded images from Excel...');
      let extractedImages = [];
      let imageMap = {};
      
      try {
        extractedImages = await this.imageExtractor.extractImagesFromExcel(filePath);
        
        if (extractedImages.length > 0) {
          // Map images to rows (sequential mapping)
          imageMap = this.imageExtractor.mapImagesToRows(extractedImages, data.length);
          console.log(`✅ Successfully extracted ${extractedImages.length} images`);
        } else {
          console.log('ℹ️ No images found in Excel file');
        }
      } catch (imageError) {
        console.error('❌ Error extracting images:', imageError.message);
        // Continue without images - don't fail the entire parsing
      }
      
      return {
        data: data,
        errors: [],
        totalRows: data.length,
        extractedImages: extractedImages,
        imageMap: imageMap
      };
    } catch (error) {
      throw new Error(`Error parsing Excel file: ${error.message}`);
    }
  }

  async parsePDF(filePath) {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      
      // Extract text and try to parse as table data
      const text = pdfData.text;
      const lines = text.split('\n').filter(line => line.trim());
      
      // Try to detect table structure
      const data = this.extractTableFromPDFText(lines);
      
      return {
        data: data,
        errors: data.length === 0 ? ['Could not extract tabular data from PDF'] : [],
        totalRows: data.length
      };
    } catch (error) {
      throw new Error(`Error parsing PDF file: ${error.message}`);
    }
  }

  async parseZip(filePath) {
    try {
      console.log('📦 Extracting ZIP file...');
      
      // Create temporary directory for extraction
      const tempDir = path.join(__dirname, 'temp', Date.now().toString());
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const extractedFiles = await this.extractZipFile(filePath, tempDir);
      
      // Find Excel file and images folder
      let excelFile = null;
      let imagesDir = null;
      
      for (const file of extractedFiles) {
        // Skip Mac metadata files
        if (path.basename(file).startsWith('._')) {
          continue;
        }
        
        if (file.endsWith('.xlsx') || file.endsWith('.xls')) {
          excelFile = file;
          console.log(`📊 Found Excel file: ${file}`);
        }
      }
      
      // Find images directory (could be at root or in subfolder)
      const possibleImageDirs = [
        path.join(tempDir, 'images'),
        path.join(tempDir, 'Images'),
        path.join(tempDir, 'test_folder', 'images'),
        path.join(tempDir, 'test_folder', 'Images')
      ];
      
      for (const dirPath of possibleImageDirs) {
        if (fs.existsSync(dirPath)) {
          imagesDir = dirPath;
          console.log(`🖼️ Found images directory: ${dirPath}`);
          break;
        }
      }
      
      if (!excelFile) {
        throw new Error('No Excel file found in ZIP archive');
      }
      
      console.log(`📊 Found Excel file: ${path.basename(excelFile)}`);
      console.log(`🖼️ Images directory: ${imagesDir ? 'Found' : 'Not found'}`);
      
      // Parse the Excel file
      const workbook = XLSX.readFile(excelFile);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { defval: null });
      
      // Process images from the images folder
      let imageMap = {};
      let extractedImages = [];
      
      if (imagesDir && fs.existsSync(imagesDir)) {
        console.log('🖼️ Processing images from ZIP...');
        const imageFiles = fs.readdirSync(imagesDir).filter(file => 
          /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file)
        );
        
        console.log(`Found ${imageFiles.length} image files`);
        
        // Copy images to uploads/images and create mapping
        const uploadsImagesDir = path.join(__dirname, 'uploads', 'images');
        if (!fs.existsSync(uploadsImagesDir)) {
          fs.mkdirSync(uploadsImagesDir, { recursive: true });
        }
        
        for (const imageFile of imageFiles) {
          const sourcePath = path.join(imagesDir, imageFile);
          const uniqueName = `${uuidv4()}${path.extname(imageFile)}`;
          const destPath = path.join(uploadsImagesDir, uniqueName);
          
          // Copy image file
          fs.copyFileSync(sourcePath, destPath);
          
          extractedImages.push({
            originalName: imageFile,
            fileName: uniqueName,
            filePath: destPath,
            relativePath: `uploads/images/${uniqueName}`,
            webPath: `/uploads/images/${uniqueName}`
          });
          
          console.log(`📸 Copied ${imageFile} → ${uniqueName}`);
        }
        
        // Create image mapping based on photo column values
        imageMap = this.createImageMapFromPhotoColumn(data, extractedImages);
      }
      
      // Clean up temporary directory
      this.cleanupDirectory(tempDir);
      
      return {
        data: data,
        errors: [],
        totalRows: data.length,
        extractedImages: extractedImages,
        imageMap: imageMap
      };
      
    } catch (error) {
      throw new Error(`Error parsing ZIP file: ${error.message}`);
    }
  }

  extractTableFromPDFText(lines) {
    const data = [];
    
    // For this specific inventory format, we'll look for patterns
    // The header pattern is: PhotoMaterialUnitQty.BrandSpecs photoSpecsConditionMRPPrice PurchasedPrice today
    let headerFound = false;
    let itemFields = [];
    let collectingItem = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (!line) continue;

      // Detect header row
      if (line.includes('PhotoMaterial') && line.includes('Price today')) {
        headerFound = true;
        continue;
      }

      if (!headerFound) continue;

      // Check if this line looks like the start of a new item
      const isNewItemStart = this.looksLikeMaterialName(line) && 
                            (itemFields.length === 0 || this.hasEnoughDataForItem(itemFields));
      
      if (isNewItemStart && itemFields.length > 0) {
        // Process previous item
        const processedItem = this.processInventoryItem(itemFields);
        if (processedItem) {
          data.push(processedItem);
        }
        itemFields = [];
      }
      
      // Add line to current item
      itemFields.push(line);
      collectingItem = true;
      
      // Check if we have enough data and next line starts a new item
      if (this.hasEnoughDataForItem(itemFields) && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine && this.looksLikeMaterialName(nextLine)) {
          // Process current item
          const processedItem = this.processInventoryItem(itemFields);
          if (processedItem) {
            data.push(processedItem);
          }
          itemFields = [];
          collectingItem = false;
        }
      }
    }

    // Process last item if exists
    if (itemFields.length > 0) {
      const processedItem = this.processInventoryItem(itemFields);
      if (processedItem) {
        data.push(processedItem);
      }
    }

    return data;
  }

  hasEnoughDataForItem(fields) {
    // Check if we have enough data to constitute an item
    // Need: material name, some numbers (qty, prices), and possibly inventory type
    let hasNumbers = false;
    let hasText = false;
    let hasInventoryType = false;
    
    for (const field of fields) {
      if (/^\d+(\.\d+)?$/.test(field.trim())) {
        hasNumbers = true;
      } else if (/^[A-Za-z\s]+$/.test(field.trim()) && field.trim().length > 2) {
        hasText = true;
      } else if (/^[A-Z]{1,3}$/.test(field.trim())) {
        hasInventoryType = true;
      }
    }
    
    return hasText && hasNumbers && fields.length >= 5;
  }

  looksLikeMaterialName(line) {
    // Material names are usually descriptive and longer
    if (line.length < 3) return false;
    
    // Common material indicators
    const materialKeywords = [
      'basin', 'shower', 'pipe', 'flange', 'elbow', 'sink', 'cabin', 'tanker', 
      'lock', 'hinge', 'door', 'window', 'tile', 'faucet', 'tap', 'valve',
      'counter', 'health', 'metro', 'overhead', 'bottle', 'trap', 'cp', 'ss'
    ];
    
    const lowerLine = line.toLowerCase();
    return materialKeywords.some(keyword => lowerLine.includes(keyword)) ||
           line.match(/^[A-Za-z\s]{5,}/); // At least 5 characters of text
  }

  looksLikeEndOfItem(currentLine, nextLine) {
    // End of item indicators
    if (!nextLine) return true;
    
    // If next line looks like a new material
    if (this.looksLikeMaterialName(nextLine)) return true;
    
    // If current line has inventory type indicators (B, BA, D, L, etc.)
    if (/^[A-Z]{1,3}$/.test(currentLine.trim())) return true;
    
    return false;
  }

  processInventoryItem(fields) {
    if (fields.length < 3) return null;
    
    // Reconstruct material name from potentially split fields
    let material = '';
    let numbers = [];
    let textFields = [];
    let unit = 'No.';
    let inventoryType = 'surplus';
    let condition = 'good';
    
    // First pass: categorize fields
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i].trim();
      if (!field) continue;
      
      if (/^\d+$/.test(field)) {
        numbers.push(parseInt(field));
      } else if (/^\d+(\.\d+)?$/.test(field)) {
        numbers.push(parseFloat(field));
      } else if (field === 'No.' || field === 'Pcs' || field === 'Kg' || field === 'Ltr') {
        unit = field;
      } else if (/^[A-Z]{1,3}$/.test(field)) {
        inventoryType = this.mapInventoryType(field);
      } else if (field.toLowerCase().includes('new') || field.toLowerCase().includes('good') || 
                 field.toLowerCase().includes('old') || field.toLowerCase().includes('packed')) {
        condition = field.toLowerCase().includes('new') ? 'new' : 
                   field.toLowerCase().includes('good') ? 'good' :
                   field.toLowerCase().includes('packed') ? 'good' : 'used';
      } else if (/^[A-Za-z\s]+$/.test(field) && field.length > 1) {
        textFields.push(field);
      }
    }
    
    // Reconstruct material name from text fields (exclude brand-like single words)
    if (textFields.length > 0) {
      // If first text field looks like a material description, use it
      if (textFields[0].length > 5 || textFields.length === 1) {
        material = textFields[0];
      } else {
        // Combine multiple short text fields
        material = textFields.slice(0, 2).join(' ');
      }
    }
    
    // Find brand (usually a single word that's not the material)
    let brand = '';
    for (const text of textFields) {
      if (text !== material && text.length > 2 && /^[A-Za-z]+$/.test(text)) {
        brand = text;
        break;
      }
    }
    
    // Extract quantities and prices from numbers
    // Sort numbers to identify patterns
    const sortedNumbers = [...numbers].sort((a, b) => a - b);
    
    let qty = 0;
    let priceToday = 0;
    let mrp = 0;
    let pricePurchased = 0;
    
    if (sortedNumbers.length >= 2) {
      // Assume smallest number is quantity (if reasonable)
      const potentialQty = sortedNumbers[0];
      if (potentialQty > 0 && potentialQty < 1000) {
        qty = potentialQty;
        
        // Remaining numbers are likely prices
        const priceNumbers = sortedNumbers.slice(1);
        if (priceNumbers.length >= 1) {
          priceToday = priceNumbers[priceNumbers.length - 1]; // Highest price as current price
          if (priceNumbers.length >= 2) {
            pricePurchased = priceNumbers[0]; // Lowest as purchased price
          }
          if (priceNumbers.length >= 3) {
            mrp = Math.max(...priceNumbers); // Highest as MRP
          }
        }
      } else {
        // If first number is too large for quantity, try second smallest
        if (sortedNumbers.length >= 2) {
          const secondSmallest = sortedNumbers[1];
          if (secondSmallest > 0 && secondSmallest < 1000) {
            qty = secondSmallest;
            const remainingNumbers = sortedNumbers.filter(n => n !== secondSmallest);
            if (remainingNumbers.length > 0) {
              priceToday = remainingNumbers[remainingNumbers.length - 1];
              if (remainingNumbers.length >= 2) {
                pricePurchased = remainingNumbers[0];
              }
            }
          }
        }
      }
    }
    
    // Fallback: if still no reasonable quantity found, try to extract from the data pattern
    if (qty === 0 && numbers.length > 0) {
      // Look for small numbers that could be quantities
      for (const num of numbers) {
        if (num > 0 && num < 100) {
          qty = num;
          break;
        }
      }
      
      // If still no qty, use a reasonable default
      if (qty === 0) {
        qty = 1;
      }
      
      // Use largest number as price
      if (priceToday === 0 && numbers.length > 0) {
        priceToday = Math.max(...numbers.filter(n => n > qty));
      }
    }
    
    // Must have material, quantity, and price
    if (!material || qty <= 0 || priceToday <= 0) {
      return null;
    }
    
    return {
      material: material,
      unit: unit,
      qty: qty,
      brand: brand || 'n/a',
      condition: condition,
      mrp: mrp,
      pricePurchased: pricePurchased,
      priceToday: priceToday,
      inventoryType: inventoryType,
      category: this.categorizeItem(material),
      specs: 'n/a',
      photo: 'n/a',
      specsPhoto: 'n/a',
      dimensions: 'n/a',
      weight: 0
    };
  }

  mapInventoryType(code) {
    const mapping = {
      'B': 'surplus',
      'BA': 'surplus', 
      'D': 'damaged',
      'L': 'liquidation',
      'N': 'new',
      'U': 'used'
    };
    return mapping[code] || 'surplus';
  }

  looksLikeHeader(line) {
    const lowerLine = line.toLowerCase();
    const headerKeywords = ['material', 'item', 'quantity', 'price', 'brand', 'condition'];
    return headerKeywords.some(keyword => lowerLine.includes(keyword));
  }

  looksLikeDataRow(line) {
    // Check if line contains numbers (likely quantities or prices)
    return /\d/.test(line) && line.split(/\s+/).length >= 3;
  }

  parseTableRow(line) {
    // Split by multiple spaces or tabs, but preserve single spaces within values
    return line.split(/\s{2,}|\t/).map(cell => cell.trim()).filter(cell => cell);
  }

  processRow(row, sellerId, projectId, rowIndex) {
    // Extract material name (mandatory)
    const materialName = this.findColumnValue(row, this.columnMappings.material);
    if (!materialName) {
      throw new Error('Material name is required');
    }

    // Extract quantity (skip if zero or missing)
    const qtyValue = this.findColumnValue(row, this.columnMappings.qty);
    const qty = this.parseNumber(qtyValue);
    if (!qty || qty <= 0) {
      return null; // Skip this row instead of throwing error
    }

    // Extract selling price (try to get it, but allow zero/missing)
    const priceValue = this.findColumnValue(row, this.columnMappings.priceToday);
    const priceToday = this.parseNumber(priceValue);
    
    // If no price is available, try to get MRP or purchased price as fallback
    let finalPrice = priceToday;
    if (finalPrice <= 0) {
      const mrpValue = this.findColumnValue(row, this.columnMappings.mrp);
      const mrpPrice = this.parseNumber(mrpValue);
      if (mrpPrice > 0) {
        finalPrice = mrpPrice;
      } else {
        const purchasedValue = this.findColumnValue(row, this.columnMappings.pricePurchased);
        const purchasedPrice = this.parseNumber(purchasedValue);
        if (purchasedPrice > 0) {
          finalPrice = purchasedPrice;
        } else {
          // Set a minimal price to avoid validation error, but mark inventory value as 0
          finalPrice = 1;
        }
      }
    }

    // Create material object with extracted data
    const material = {
      id: uuidv4(),
      sellerId: sellerId,
      projectId: projectId || 'default',
      material: materialName,
      brand: this.safeStringValue(row, this.columnMappings.brand, 'n/a'),
      category: this.findColumnValue(row, this.columnMappings.category) || this.categorizeItem(materialName),
      condition: this.findColumnValue(row, this.columnMappings.condition) || 'good',
      qty: qty,
      unit: this.findColumnValue(row, this.columnMappings.unit) || 'pcs',
      priceToday: finalPrice,
      mrp: this.safeNumericValue(row, this.columnMappings.mrp, 0),
      pricePurchased: this.safeNumericValue(row, this.columnMappings.pricePurchased, 0),
      inventoryValue: (finalPrice && finalPrice > 1) ? finalPrice * qty : 0,
      inventoryType: this.findColumnValue(row, this.columnMappings.inventoryType) || 'surplus',
      listingType: 'resale',
      specs: this.safeStringValue(row, this.columnMappings.specs, ''),
      photo: this.safeStringValue(row, this.columnMappings.photo, ''),
      specsPhoto: this.safeStringValue(row, this.columnMappings.specsPhoto, ''),
      dimensions: this.safeStringValue(row, this.columnMappings.dimensions, 'n/a'),
      weight: this.safeNumericValue(row, this.columnMappings.weight, 0),
      createdAt: new Date().toISOString()
    };

    return material;
  }

  findColumnValue(data, fieldMappings) {
    for (const mapping of fieldMappings) {
      // Try exact match first
      let value = data[mapping];
      if (value !== undefined && value !== null && value !== '') {
        return String(value).trim();
      }

      // Try case-insensitive match
      for (const key in data) {
        if (key.toLowerCase() === mapping.toLowerCase()) {
          value = data[key];
          if (value !== undefined && value !== null && value !== '') {
            return String(value).trim();
          }
        }
      }
    }
    return null;
  }

  // Helper function to safely get string value or return "n/a"
  safeStringValue(data, fieldMappings, defaultValue = 'n/a') {
    const value = this.findColumnValue(data, fieldMappings);
    return value || defaultValue;
  }

  // Helper function to safely get numeric value without affecting calculations
  safeNumericValue(data, fieldMappings, defaultValue = 0) {
    const value = this.findColumnValue(data, fieldMappings);
    const parsed = this.parseNumber(value);
    return parsed > 0 ? parsed : defaultValue;
  }

  parseNumber(value) {
    if (!value || value === null || value === undefined) return 0;
    
    // Convert to string and trim
    let cleanValue = String(value).trim();
    
    // Handle empty strings
    if (cleanValue === '') return 0;
    
    // Remove currency symbols and commas
    cleanValue = cleanValue.replace(/[$,€£¥₹]/g, '');
    
    // Handle fractions or ranges (like "665/735" or "100-200")
    if (cleanValue.includes('/')) {
      const parts = cleanValue.split('/');
      if (parts.length === 2) {
        const num1 = parseFloat(parts[0].trim());
        const num2 = parseFloat(parts[1].trim());
        if (!isNaN(num1) && !isNaN(num2)) {
          // Return the average of the two numbers
          return (num1 + num2) / 2;
        } else if (!isNaN(num1)) {
          return num1; // Use first number if second is invalid
        } else if (!isNaN(num2)) {
          return num2; // Use second number if first is invalid
        }
      }
    }
    
    // Handle ranges with dashes
    if (cleanValue.includes('-') && !cleanValue.startsWith('-')) {
      const parts = cleanValue.split('-');
      if (parts.length === 2) {
        const num1 = parseFloat(parts[0].trim());
        const num2 = parseFloat(parts[1].trim());
        if (!isNaN(num1) && !isNaN(num2)) {
          return (num1 + num2) / 2; // Return average
        } else if (!isNaN(num1)) {
          return num1;
        } else if (!isNaN(num2)) {
          return num2;
        }
      }
    }
    
    // Try to parse as regular number
    const number = parseFloat(cleanValue);
    
    return isNaN(number) ? 0 : number;
  }

  categorizeItem(materialName) {
    if (!materialName) return 'Other';
    
    const name = materialName.toLowerCase();
    
    if (name.includes('door')) return 'Doors';
    if (name.includes('tile') || name.includes('ceramic') || name.includes('marble') || name.includes('granite')) return 'Tiles';
    if (name.includes('handle') || name.includes('knob') || name.includes('lock') || name.includes('hinge')) return 'Handles & Hardware';
    if (name.includes('toilet') || name.includes('sink') || name.includes('basin') || name.includes('faucet') || name.includes('tap')) return 'Toilets & Sanitary';
    if (name.includes('window') || name.includes('glass')) return 'Windows';
    if (name.includes('floor') || name.includes('laminate') || name.includes('vinyl') || name.includes('carpet')) return 'Flooring';
    if (name.includes('light') || name.includes('lamp') || name.includes('bulb') || name.includes('fixture')) return 'Lighting';
    if (name.includes('paint') || name.includes('primer') || name.includes('varnish') || name.includes('coating')) return 'Paint & Finishes';
    if (name.includes('pipe') || name.includes('plumb') || name.includes('valve')) return 'Plumbing';
    if (name.includes('wire') || name.includes('electric') || name.includes('switch') || name.includes('outlet')) return 'Electrical';
    
    return 'Other';
  }

  // Extract ZIP file to temporary directory
  async extractZipFile(zipPath, tempDir) {
    return new Promise((resolve, reject) => {
      const extractedFiles = [];
      
      yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
        if (err) {
          reject(err);
          return;
        }
        
        zipfile.readEntry();
        
        zipfile.on('entry', (entry) => {
          if (/\/$/.test(entry.fileName)) {
            // Directory entry
            const dirPath = path.join(tempDir, entry.fileName);
            if (!fs.existsSync(dirPath)) {
              fs.mkdirSync(dirPath, { recursive: true });
            }
            zipfile.readEntry();
          } else {
            // File entry
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) {
                console.error('❌ Error reading ZIP entry:', err);
                zipfile.readEntry();
                return;
              }
              
              const filePath = path.join(tempDir, entry.fileName);
              const fileDir = path.dirname(filePath);
              
              if (!fs.existsSync(fileDir)) {
                fs.mkdirSync(fileDir, { recursive: true });
              }
              
              const writeStream = fs.createWriteStream(filePath);
              readStream.pipe(writeStream);
              
              writeStream.on('close', () => {
                extractedFiles.push(filePath);
                console.log(`📄 Extracted: ${entry.fileName}`);
                zipfile.readEntry();
              });
              
              writeStream.on('error', (err) => {
                console.error('❌ Error writing file:', err);
                zipfile.readEntry();
              });
            });
          }
        });
        
        zipfile.on('end', () => {
          console.log(`✅ ZIP extraction completed. ${extractedFiles.length} files extracted.`);
          resolve(extractedFiles);
        });
        
        zipfile.on('error', (err) => {
          reject(err);
        });
      });
    });
  }

  // Create image mapping based on photo column values
  createImageMapFromPhotoColumn(data, extractedImages) {
    console.log('🔗 Creating image mapping from photo column...');
    
    const imageMap = {};
    
    // Create a lookup map of original image names to extracted images
    const imageNameMap = {};
    extractedImages.forEach(img => {
      imageNameMap[img.originalName.toLowerCase()] = img;
    });
    
    // Process each row to map photo column values to actual images
    data.forEach((row, index) => {
      const rowIndex = index + 1;
      
      // Find photo column value
      const photoValue = this.findColumnValue(row, this.columnMappings.photo);
      
      if (photoValue && photoValue.trim() !== '') {
        const photoFileName = photoValue.trim().toLowerCase();
        
        // Look for matching image
        if (imageNameMap[photoFileName]) {
          imageMap[rowIndex] = imageNameMap[photoFileName].webPath;
          console.log(`🔗 Mapped "${photoValue}" to row ${rowIndex}`);
        } else {
          console.log(`⚠️ Photo "${photoValue}" not found in images folder for row ${rowIndex}`);
        }
      }
    });
    
    console.log(`📊 Successfully mapped ${Object.keys(imageMap).length} images from photo column`);
    return imageMap;
  }

  // Clean up temporary directory
  cleanupDirectory(dirPath) {
    try {
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
        console.log(`🧹 Cleaned up temporary directory: ${dirPath}`);
      }
    } catch (error) {
      console.error('⚠️ Error cleaning up directory:', error.message);
    }
  }

  // Get supported file types
  getSupportedTypes() {
    return {
      csv: {
        extensions: ['.csv'],
        mimeTypes: ['text/csv', 'application/csv'],
        description: 'Comma Separated Values'
      },
      excel: {
        extensions: ['.xlsx', '.xls'],
        mimeTypes: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel'
        ],
        description: 'Microsoft Excel'
      },
      pdf: {
        extensions: ['.pdf'],
        mimeTypes: ['application/pdf'],
        description: 'Portable Document Format'
      },
      zip: {
        extensions: ['.zip'],
        mimeTypes: ['application/zip', 'application/x-zip-compressed'],
        description: 'ZIP Archive with Excel and Images'
      }
    };
  }

  getFileType(filename, mimetype) {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    
    if (['.csv'].includes(ext) || mimetype?.includes('csv')) {
      return 'csv';
    } else if (['.xlsx', '.xls'].includes(ext) || mimetype?.includes('spreadsheet') || mimetype?.includes('excel')) {
      return 'xlsx';
    } else if (['.pdf'].includes(ext) || mimetype?.includes('pdf')) {
      return 'pdf';
    } else if (['.zip'].includes(ext) || mimetype?.includes('zip')) {
      return 'zip';
    }
    
    return null;
  }
}

module.exports = FileParser;
