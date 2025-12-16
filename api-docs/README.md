# API Documentation System

This directory contains all Swagger/OpenAPI documentation generation and management tools for the OOMS API.

## 📁 Directory Structure

```
api-docs/
├── swagger/                    # Modular Swagger generation system
│   ├── index.js               # Main entry point
│   ├── config.js              # Base configuration
│   ├── generator.js           # Core generation logic
│   ├── pathGenerators.js      # Route analysis
│   ├── definitions.js         # Schema definitions
│   ├── tags.js                # API categorization
│   └── utils.js               # Utility functions
├── swagger-generate.js        # CLI tool for generation
├── swagger-watch.js           # File watcher for auto-regeneration
└── README.md                  # This file
```

## 🚀 Usage

### Generate Documentation Once
```bash
npm run swagger
```

### Generate with Verbose Output
```bash
npm run swagger:verbose
```

### Watch Mode (Auto-regenerate on file changes)
```bash
npm run swagger:watch
```

### Development Mode (Server + Swagger Watch)
```bash
npm run dev
```

## 📄 Output

- **Location**: `swagger-output.json` (project root)
- **Web Interface**: `http://localhost:3000/api-docs`
- **Auto-generation**: Enabled in development mode

## 🔧 Features

- **Modular Architecture**: Clean separation of concerns
- **Auto-discovery**: Automatically finds and analyzes route files
- **File Watching**: Real-time regeneration on route changes
- **Error Handling**: Robust error recovery and reporting
- **Validation**: Built-in Swagger document validation
- **Categorization**: Smart API endpoint tagging
- **Security**: Automatic authentication detection

## 🛠️ Configuration

The system automatically:
- Scans `/routes` directory for route files
- Analyzes Express.js route definitions
- Generates appropriate Swagger schemas
- Categorizes endpoints by functionality
- Adds security definitions for protected routes

No manual configuration required for basic usage!
