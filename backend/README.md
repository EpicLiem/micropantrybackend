# MicroPantry Backend

Firebase Functions backend for the MicroPantry grocery management application.

## Features

- User management (profiles, preferences)
- Pantry storage for tracking food inventory
- Shopping list creation and management with NLP capabilities
- Meal planning with calendar integration
- Recipe management and search
- AI Chef for recipe recommendations based on pantry contents
- Receipt recognition for automatic pantry updates
- Barcode scanning for product information
- Food item recognition
- Micronutrition analysis

## API Endpoints

### User Management
- `POST /user/profile` - Create or update user profile
- `GET /user/profile/:userId` - Get user profile

### Pantry Management
- `POST /pantry/add` - Add items to pantry
- `GET /pantry/:userId` - Get all pantry items
- `PUT /pantry/item/:userId/:itemId` - Update pantry item
- `DELETE /pantry/item/:userId/:itemId` - Delete pantry item

### Shopping List Management
- `POST /shopping-list/create` - Create a new shopping list
- `GET /shopping-lists/:userId` - Get all user's shopping lists
- `GET /shopping-list/:listId` - Get shopping list items
- `POST /shopping-list/:listId/add` - Add items to shopping list
- `PUT /shopping-list/:listId/item/:itemId` - Update shopping list item

### Meal Planning
- `POST /meal-plan/create` - Create a meal plan
- `GET /meal-plans/:userId` - Get user's meal plans
- `GET /meal-plan/:planId` - Get meal plan details

### Recipe Management
- `POST /recipe/save` - Save a recipe
- `GET /recipes/:userId` - Get user's recipes
- `GET /recipe/:recipeId` - Get recipe details

### AI Chef & NLP Features
- `POST /ai-chef/query` - Process natural language request for AI Chef
- `POST /recipes/search` - Search for recipes based on natural language query

### Food Database API
- `GET /food/search` - Search for food items in Edamam database
- `GET /food/nutrition/:foodId` - Get nutrition information for a food item

### Receipt Recognition
- `POST /receipt/process` - Process receipt image

### Food Item Recognition
- `POST /food/recognize` - Recognize food items in an image

### Barcode Recognition
- `POST /barcode/process` - Process barcode

### Micronutrition Analysis
- `POST /micronutrition/analyze` - Analyze food item micronutrition

## Background Functions
- `exports.checkExpiringItems` - Daily check for expiring pantry items (scheduled)
- `exports.addShoppingListToPantry` - Convert shopping list items to pantry items (callable)

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Set up environment variables:
   - Create a `.env` file in the root directory
   - Add required API keys (Edamam, OpenAI)

3. Local development:
   ```
   npm run serve
   ```

4. Deploy to Firebase:
   ```
   npm run deploy
   ```

## Requirements

- Node.js 18 or later
- Firebase CLI
- Firebase project on Blaze plan (for function deployment)
- Edamam API keys
- OpenAI API key

## Data Structure

The backend uses the following Firestore collections:
- `users` - User profiles and preferences
- `pantries` - User pantry data with `items` subcollection
- `shopping-lists` - Shopping lists with `items` subcollection
- `recipes` - Saved recipes
- `meal-plans` - Meal plans with `meals` subcollection
- `notifications` - User notifications 