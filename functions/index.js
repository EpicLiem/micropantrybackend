const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { OpenAI } = require('openai');

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Firestore
const db = admin.firestore();

// Initialize Express
const app = express();
app.use(cors({ origin: true }));

// Initialize OpenAI (for NLP features)
// Note: In production, use environment variables for API keys
const openai = new OpenAI();

// Edamam API configuration
const EDAMAM_APP_ID = process.env.EDAMAM_APP_ID;
const EDAMAM_APP_KEY = process.env.EDAMAM_APP_KEY;
const EDAMAM_BASE_URL = 'https://api.edamam.com/api/food-database/v2/parser';

// Helper function to query Edamam API
async function searchFoodInEdamam(query) {
  try {
    const response = await axios.get(EDAMAM_BASE_URL, {
      params: {
        app_id: EDAMAM_APP_ID,
        app_key: EDAMAM_APP_KEY,
        ingr: query,
        'nutrition-type': 'logging'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error querying Edamam API:', error);
    throw new Error('Failed to search food information');
  }
}

// ======== USER MANAGEMENT ========

// Create or update user profile
app.post('/user/profile', async (req, res) => {
  try {
    const { userId, displayName, email, preferences } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const userRef = db.collection('users').doc(userId);
    await userRef.set({
      displayName,
      email,
      preferences: preferences || {},
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return res.status(500).json({ error: 'Failed to update user profile' });
  }
});

// Get user profile
app.get('/user/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    return res.status(200).json(userDoc.data());
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// ======== PANTRY MANAGEMENT ========

// Add items to pantry
app.post('/pantry/add', async (req, res) => {
  try {
    const { userId, items } = req.body;
    
    if (!userId || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'User ID and items array are required' });
    }
    
    const pantryRef = db.collection('pantries').doc(userId);
    const batch = db.batch();
    
    // Get current pantry or create it
    const pantryDoc = await pantryRef.get();
    if (!pantryDoc.exists) {
      batch.set(pantryRef, { 
        userId, 
        createdAt: admin.firestore.FieldValue.serverTimestamp() 
      });
    }
    
    // Add each item to pantry items subcollection
    for (const item of items) {
      if (!item.name) continue;
      
      const itemRef = pantryRef.collection('items').doc();
      batch.set(itemRef, {
        name: item.name,
        quantity: item.quantity || 1,
        unit: item.unit || 'item',
        category: item.category || 'uncategorized',
        expiryDate: item.expiryDate || null,
        purchaseDate: item.purchaseDate || admin.firestore.FieldValue.serverTimestamp(),
        customImage: item.customImage || null,
        isCustom: item.isCustom || false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    
    await batch.commit();
    
    return res.status(200).json({ success: true, message: 'Items added to pantry' });
  } catch (error) {
    console.error('Error adding items to pantry:', error);
    return res.status(500).json({ error: 'Failed to add items to pantry' });
  }
});

// Get pantry items
app.get('/pantry/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const pantryRef = db.collection('pantries').doc(userId);
    const pantryDoc = await pantryRef.get();
    
    if (!pantryDoc.exists) {
      return res.status(404).json({ error: 'Pantry not found' });
    }
    
    const itemsSnapshot = await pantryRef.collection('items').get();
    const items = [];
    
    itemsSnapshot.forEach(doc => {
      items.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return res.status(200).json({ items });
  } catch (error) {
    console.error('Error fetching pantry items:', error);
    return res.status(500).json({ error: 'Failed to fetch pantry items' });
  }
});

// Update pantry item
app.put('/pantry/item/:userId/:itemId', async (req, res) => {
  try {
    const { userId, itemId } = req.params;
    const updates = req.body;
    
    if (!userId || !itemId) {
      return res.status(400).json({ error: 'User ID and item ID are required' });
    }
    
    const itemRef = db.collection('pantries').doc(userId).collection('items').doc(itemId);
    const itemDoc = await itemRef.get();
    
    if (!itemDoc.exists) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    
    await itemRef.update(updates);
    
    return res.status(200).json({ success: true, message: 'Item updated' });
  } catch (error) {
    console.error('Error updating pantry item:', error);
    return res.status(500).json({ error: 'Failed to update pantry item' });
  }
});

// Delete pantry item
app.delete('/pantry/item/:userId/:itemId', async (req, res) => {
  try {
    const { userId, itemId } = req.params;
    
    if (!userId || !itemId) {
      return res.status(400).json({ error: 'User ID and item ID are required' });
    }
    
    const itemRef = db.collection('pantries').doc(userId).collection('items').doc(itemId);
    const itemDoc = await itemRef.get();
    
    if (!itemDoc.exists) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    await itemRef.delete();
    
    return res.status(200).json({ success: true, message: 'Item deleted' });
  } catch (error) {
    console.error('Error deleting pantry item:', error);
    return res.status(500).json({ error: 'Failed to delete pantry item' });
  }
});

// ======== SHOPPING LIST MANAGEMENT ========

// Create shopping list
app.post('/shopping-list/create', async (req, res) => {
  try {
    const { userId, name, items } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const listRef = db.collection('shopping-lists').doc();
    await listRef.set({
      userId,
      name: name || 'Shopping List',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    if (items && Array.isArray(items) && items.length > 0) {
      const batch = db.batch();
      
      for (const item of items) {
        if (!item.name) continue;
        
        const itemRef = listRef.collection('items').doc();
        batch.set(itemRef, {
          name: item.name,
          quantity: item.quantity || 1,
          unit: item.unit || 'item',
          category: item.category || 'uncategorized',
          isChecked: item.isChecked || false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      
      await batch.commit();
    }
    
    return res.status(200).json({ 
      success: true, 
      message: 'Shopping list created', 
      listId: listRef.id 
    });
  } catch (error) {
    console.error('Error creating shopping list:', error);
    return res.status(500).json({ error: 'Failed to create shopping list' });
  }
});

// Get user's shopping lists
app.get('/shopping-lists/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const listsSnapshot = await db.collection('shopping-lists')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    
    const lists = [];
    
    listsSnapshot.forEach(doc => {
      lists.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return res.status(200).json({ lists });
  } catch (error) {
    console.error('Error fetching shopping lists:', error);
    return res.status(500).json({ error: 'Failed to fetch shopping lists' });
  }
});

// Get shopping list items
app.get('/shopping-list/:listId', async (req, res) => {
  try {
    const { listId } = req.params;
    
    if (!listId) {
      return res.status(400).json({ error: 'List ID is required' });
    }
    
    const listRef = db.collection('shopping-lists').doc(listId);
    const listDoc = await listRef.get();
    
    if (!listDoc.exists) {
      return res.status(404).json({ error: 'Shopping list not found' });
    }
    
    const itemsSnapshot = await listRef.collection('items').get();
    const items = [];
    
    itemsSnapshot.forEach(doc => {
      items.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return res.status(200).json({ 
      list: listDoc.data(),
      items 
    });
  } catch (error) {
    console.error('Error fetching shopping list items:', error);
    return res.status(500).json({ error: 'Failed to fetch shopping list items' });
  }
});

// Add items to shopping list
app.post('/shopping-list/:listId/add', async (req, res) => {
  try {
    const { listId } = req.params;
    const { items } = req.body;
    
    if (!listId || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'List ID and items array are required' });
    }
    
    const listRef = db.collection('shopping-lists').doc(listId);
    const listDoc = await listRef.get();
    
    if (!listDoc.exists) {
      return res.status(404).json({ error: 'Shopping list not found' });
    }
    
    const batch = db.batch();
    
    for (const item of items) {
      if (!item.name) continue;
      
      const itemRef = listRef.collection('items').doc();
      batch.set(itemRef, {
        name: item.name,
        quantity: item.quantity || 1,
        unit: item.unit || 'item',
        category: item.category || 'uncategorized',
        isChecked: item.isChecked || false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    
    // Update the list's last updated timestamp
    batch.update(listRef, {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    await batch.commit();
    
    return res.status(200).json({ success: true, message: 'Items added to shopping list' });
  } catch (error) {
    console.error('Error adding items to shopping list:', error);
    return res.status(500).json({ error: 'Failed to add items to shopping list' });
  }
});

// Update shopping list item
app.put('/shopping-list/:listId/item/:itemId', async (req, res) => {
  try {
    const { listId, itemId } = req.params;
    const updates = req.body;
    
    if (!listId || !itemId) {
      return res.status(400).json({ error: 'List ID and item ID are required' });
    }
    
    const itemRef = db.collection('shopping-lists').doc(listId).collection('items').doc(itemId);
    const itemDoc = await itemRef.get();
    
    if (!itemDoc.exists) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    
    await itemRef.update(updates);
    
    return res.status(200).json({ success: true, message: 'Item updated' });
  } catch (error) {
    console.error('Error updating shopping list item:', error);
    return res.status(500).json({ error: 'Failed to update shopping list item' });
  }
});

// ======== MEAL PLANNING ========

// Create meal plan
app.post('/meal-plan/create', async (req, res) => {
  try {
    const { userId, name, startDate, endDate, meals } = req.body;
    
    if (!userId || !startDate) {
      return res.status(400).json({ error: 'User ID and start date are required' });
    }
    
    const mealPlanRef = db.collection('meal-plans').doc();
    await mealPlanRef.set({
      userId,
      name: name || 'Meal Plan',
      startDate,
      endDate: endDate || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    if (meals && Array.isArray(meals) && meals.length > 0) {
      const batch = db.batch();
      
      for (const meal of meals) {
        if (!meal.date || !meal.type) continue;
        
        const mealRef = mealPlanRef.collection('meals').doc();
        batch.set(mealRef, {
          date: meal.date,
          type: meal.type, // breakfast, lunch, dinner, snack
          recipeId: meal.recipeId || null,
          recipeName: meal.recipeName || null,
          notes: meal.notes || null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      
      await batch.commit();
    }
    
    return res.status(200).json({ 
      success: true, 
      message: 'Meal plan created', 
      mealPlanId: mealPlanRef.id 
    });
  } catch (error) {
    console.error('Error creating meal plan:', error);
    return res.status(500).json({ error: 'Failed to create meal plan' });
  }
});

// Get user's meal plans
app.get('/meal-plans/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const plansSnapshot = await db.collection('meal-plans')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    
    const plans = [];
    
    plansSnapshot.forEach(doc => {
      plans.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return res.status(200).json({ plans });
  } catch (error) {
    console.error('Error fetching meal plans:', error);
    return res.status(500).json({ error: 'Failed to fetch meal plans' });
  }
});

// Get meal plan details
app.get('/meal-plan/:planId', async (req, res) => {
  try {
    const { planId } = req.params;
    
    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }
    
    const planRef = db.collection('meal-plans').doc(planId);
    const planDoc = await planRef.get();
    
    if (!planDoc.exists) {
      return res.status(404).json({ error: 'Meal plan not found' });
    }
    
    const mealsSnapshot = await planRef.collection('meals').orderBy('date', 'asc').get();
    const meals = [];
    
    mealsSnapshot.forEach(doc => {
      meals.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return res.status(200).json({ 
      plan: planDoc.data(),
      meals 
    });
  } catch (error) {
    console.error('Error fetching meal plan details:', error);
    return res.status(500).json({ error: 'Failed to fetch meal plan details' });
  }
});

// ======== RECIPE MANAGEMENT ========

// Save recipe
app.post('/recipe/save', async (req, res) => {
  try {
    const { userId, recipe } = req.body;
    
    if (!userId || !recipe || !recipe.name) {
      return res.status(400).json({ error: 'User ID and recipe details are required' });
    }
    
    const recipeRef = db.collection('recipes').doc();
    await recipeRef.set({
      userId,
      name: recipe.name,
      description: recipe.description || '',
      ingredients: recipe.ingredients || [],
      instructions: recipe.instructions || [],
      prepTime: recipe.prepTime || null,
      cookTime: recipe.cookTime || null,
      servings: recipe.servings || null,
      nutrition: recipe.nutrition || {},
      image: recipe.image || null,
      source: recipe.source || null,
      tags: recipe.tags || [],
      isFavorite: recipe.isFavorite || false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    return res.status(200).json({ 
      success: true, 
      message: 'Recipe saved', 
      recipeId: recipeRef.id 
    });
  } catch (error) {
    console.error('Error saving recipe:', error);
    return res.status(500).json({ error: 'Failed to save recipe' });
  }
});

// Get user's recipes
app.get('/recipes/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const recipesSnapshot = await db.collection('recipes')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    
    const recipes = [];
    
    recipesSnapshot.forEach(doc => {
      recipes.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return res.status(200).json({ recipes });
  } catch (error) {
    console.error('Error fetching recipes:', error);
    return res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

// Get recipe details
app.get('/recipe/:recipeId', async (req, res) => {
  try {
    const { recipeId } = req.params;
    
    if (!recipeId) {
      return res.status(400).json({ error: 'Recipe ID is required' });
    }
    
    const recipeDoc = await db.collection('recipes').doc(recipeId).get();
    
    if (!recipeDoc.exists) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    
    return res.status(200).json(recipeDoc.data());
  } catch (error) {
    console.error('Error fetching recipe details:', error);
    return res.status(500).json({ error: 'Failed to fetch recipe details' });
  }
});

// ======== AI CHEF & NLP FEATURES ========

// Process natural language request for AI Chef
app.post('/ai-chef/query', async (req, res) => {
  try {
    const { userId, query } = req.body;
    
    if (!userId || !query) {
      return res.status(400).json({ error: 'User ID and query are required' });
    }
    
    // Get user's pantry items to check what ingredients they have
    const pantryRef = db.collection('pantries').doc(userId);
    const itemsSnapshot = await pantryRef.collection('items').get();
    const pantryItems = [];
    
    itemsSnapshot.forEach(doc => {
      pantryItems.push(doc.data().name);
    });
    
    // Using OpenAI to process the natural language query
    const completion = await openai.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: `You are an AI Chef assistant. The user has these ingredients in their pantry: ${pantryItems.join(', ')}. 
                   Recommend recipes based on their query and pantry ingredients. If you need more ingredients, suggest what they need to buy.`
        },
        { role: "user", content: query }
      ],
      model: "gpt-3.5-turbo",
    });
    
    return res.status(200).json({ 
      response: completion.choices[0].message.content,
    });
  } catch (error) {
    console.error('Error processing AI Chef query:', error);
    return res.status(500).json({ error: 'Failed to process query' });
  }
});

// Search for recipes based on natural language query
app.post('/recipes/search', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    // Using OpenAI to understand the natural language query and extract key ingredients
    const completion = await openai.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: "You are a recipe search assistant. Extract key ingredients and dish types from the user's query. Output ONLY a JSON array of keywords, nothing else."
        },
        { role: "user", content: query }
      ],
      model: "gpt-3.5-turbo",
      response_format: { type: "json_object" }
    });
    
    let keywords;
    try {
      keywords = JSON.parse(completion.choices[0].message.content).keywords;
    } catch (e) {
      keywords = [query]; // Fallback to original query if parsing fails
    }
    
    // Search for recipes containing these keywords
    const results = [];
    for (const keyword of keywords) {
      const recipesSnapshot = await db.collection('recipes')
        .where('tags', 'array-contains', keyword.toLowerCase())
        .limit(5)
        .get();
      
      recipesSnapshot.forEach(doc => {
        results.push({
          id: doc.id,
          ...doc.data()
        });
      });
    }
    
    return res.status(200).json({ results });
  } catch (error) {
    console.error('Error searching recipes:', error);
    return res.status(500).json({ error: 'Failed to search recipes' });
  }
});

// ======== FOOD DATABASE API ========

// Search for food items in Edamam database
app.get('/food/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const results = await searchFoodInEdamam(query);
    return res.status(200).json(results);
  } catch (error) {
    console.error('Error searching food database:', error);
    return res.status(500).json({ error: 'Failed to search food database' });
  }
});

// Get nutrition information for a food item
app.get('/food/nutrition/:foodId', async (req, res) => {
  try {
    const { foodId } = req.params;
    
    if (!foodId) {
      return res.status(400).json({ error: 'Food ID is required' });
    }
    
    // Query Edamam API for specific food item nutrition data
    // Implementation would depend on Edamam API specifics
    
    return res.status(200).json({ 
      // Nutrition data would go here
    });
  } catch (error) {
    console.error('Error fetching nutrition information:', error);
    return res.status(500).json({ error: 'Failed to fetch nutrition information' });
  }
});

// ======== RECEIPT RECOGNITION ========

// Process receipt image
app.post('/receipt/process', async (req, res) => {
  try {
    const { userId, imageUrl } = req.body;
    
    if (!userId || !imageUrl) {
      return res.status(400).json({ error: 'User ID and image URL are required' });
    }
    
    // In a real implementation, this would call an OCR service
    // For this example, we'll just return a mock response
    
    return res.status(200).json({ 
      success: true,
      store: "Grocery Store",
      date: new Date().toISOString(),
      items: [
        { name: "Milk", price: 3.99, quantity: 1 },
        { name: "Eggs", price: 2.49, quantity: 1 },
        { name: "Bread", price: 1.99, quantity: 1 }
      ],
      total: 8.47
    });
  } catch (error) {
    console.error('Error processing receipt:', error);
    return res.status(500).json({ error: 'Failed to process receipt' });
  }
});

// ======== BARCODE RECOGNITION ========

// Process barcode
app.post('/barcode/process', async (req, res) => {
  try {
    const { barcode } = req.body;
    
    if (!barcode) {
      return res.status(400).json({ error: 'Barcode is required' });
    }
    
    // In a real implementation, this would call a barcode lookup service
    // For this example, we'll just return a mock response
    
    return res.status(200).json({ 
      success: true,
      product: {
        name: "Sample Product",
        brand: "Sample Brand",
        nutrition: {
          calories: 100,
          protein: 5,
          fat: 2,
          carbs: 15
        },
        alternatives: [
          { name: "Healthier Alternative", price: 4.99 },
          { name: "Cheaper Alternative", price: 2.99 }
        ]
      }
    });
  } catch (error) {
    console.error('Error processing barcode:', error);
    return res.status(500).json({ error: 'Failed to process barcode' });
  }
});

// ======== MICRONUTRITION ANALYSIS ========

// Analyze food item micronutrition
app.post('/micronutrition/analyze', async (req, res) => {
  try {
    const { foodName } = req.body;
    
    if (!foodName) {
      return res.status(400).json({ error: 'Food name is required' });
    }
    
    // Using OpenAI to generate micronutritional analysis
    const completion = await openai.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: `You are a nutrition expert. Provide detailed micronutritional analysis for the food item. 
                   Include nutrients, potential health effects, and any relevant research. Keep it factual and scientific.`
        },
        { role: "user", content: `Analyze micronutrients for: ${foodName}` }
      ],
      model: "gpt-3.5-turbo",
    });
    
    return res.status(200).json({ 
      foodName,
      analysis: completion.choices[0].message.content,
    });
  } catch (error) {
    console.error('Error analyzing micronutrition:', error);
    return res.status(500).json({ error: 'Failed to analyze micronutrition' });
  }
});

// Export the Express API as Firebase Functions
exports.api = functions.https.onRequest(app);

// ======== SCHEDULED & BACKGROUND FUNCTIONS ========

// Daily function to check for expiring pantry items and send notifications
exports.checkExpiringItems = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  try {
    const now = new Date();
    const threeDaysFromNow = new Date(now.setDate(now.getDate() + 3)); // Items expiring in 3 days
    
    const pantrySnapshot = await db.collection('pantries').get();
    
    for (const pantryDoc of pantrySnapshot.docs) {
      const userId = pantryDoc.id;
      const expiringItems = [];
      
      const itemsSnapshot = await pantryDoc.ref.collection('items')
        .where('expiryDate', '<=', threeDaysFromNow)
        .where('expiryDate', '>=', now)
        .get();
      
      itemsSnapshot.forEach(doc => {
        expiringItems.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      if (expiringItems.length > 0) {
        // In a real implementation, send a notification to the user
        console.log(`User ${userId} has ${expiringItems.length} items expiring soon`);
        
        // Store notification in database
        await db.collection('notifications').add({
          userId,
          type: 'expiring-items',
          items: expiringItems,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error checking expiring items:', error);
    return null;
  }
});

// Function to convert shopping list items to pantry items after purchase
exports.addShoppingListToPantry = functions.https.onCall(async (data, context) => {
  try {
    const { userId, listId, purchasedItems } = data;
    
    if (!userId || !listId || !purchasedItems || !Array.isArray(purchasedItems)) {
      throw new functions.https.HttpsError('invalid-args', 'User ID, list ID, and purchased items array are required');
    }
    
    const batch = db.batch();
    const pantryRef = db.collection('pantries').doc(userId);
    
    // Get current pantry or create it
    const pantryDoc = await pantryRef.get();
    if (!pantryDoc.exists) {
      batch.set(pantryRef, { 
        userId, 
        createdAt: admin.firestore.FieldValue.serverTimestamp() 
      });
    }
    
    // Add each purchased item to pantry
    for (const itemId of purchasedItems) {
      const itemRef = db.collection('shopping-lists').doc(listId).collection('items').doc(itemId);
      const itemDoc = await itemRef.get();
      
      if (itemDoc.exists) {
        const item = itemDoc.data();
        
        // Add to pantry
        const pantryItemRef = pantryRef.collection('items').doc();
        batch.set(pantryItemRef, {
          name: item.name,
          quantity: item.quantity || 1,
          unit: item.unit || 'item',
          category: item.category || 'uncategorized',
          purchaseDate: admin.firestore.FieldValue.serverTimestamp(),
          expiryDate: null, // Could be calculated based on food type
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        // Mark item as checked in shopping list
        batch.update(itemRef, { isChecked: true });
      }
    }
    
    await batch.commit();
    
    return { success: true, message: 'Items added to pantry' };
  } catch (error) {
    console.error('Error adding shopping list to pantry:', error);
    throw new functions.https.HttpsError('internal', 'Failed to add items to pantry');
  }
}); 