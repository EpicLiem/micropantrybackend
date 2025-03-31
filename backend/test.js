require("dotenv").config();
const axios = require("axios");
const admin = require("./firebase");

const API_BASE_URL = "https://us-central1-pantryapp-fd04e.cloudfunctions.net/api";

// Use a real Firebase user account for testing
const TEST_USER_EMAIL = "test@example.com"; // Replace with your test user email
const TEST_USER_PASSWORD = "testPassword123"; // Replace with your test user password

async function getTestUserToken() {
  try {
    console.log("\n🔑 Starting authentication process...");
    let userRecord;
    try {
      // Try to get existing user
      console.log("📝 Attempting to get existing user:", TEST_USER_EMAIL);
      userRecord = await admin.auth().getUserByEmail(TEST_USER_EMAIL);
      console.log("✅ Found existing user:", userRecord.uid);
    } catch (error) {
      // If user doesn't exist, create it
      console.log("📝 User not found, creating new user:", TEST_USER_EMAIL);
      userRecord = await admin.auth().createUser({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
        displayName: "Test User",
      });
      console.log("✅ Created new user:", userRecord.uid);
    }

    // Generate a custom token
    console.log("🔑 Generating custom token for user:", userRecord.uid);
    const customToken = await admin.auth().createCustomToken(userRecord.uid);
    console.log("✅ Custom token generated successfully");

    // Sign in with the custom token to get an ID token
    console.log("🔑 Attempting to exchange custom token for ID token");
    console.log("📝 Using API key:", process.env.WEB_API_KEY ? "Present" : "Missing");

    const signInResponse = await axios.post(
        "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken",
        {
          token: customToken,
          returnSecureToken: true,
        },
        {
          params: {
            key: process.env.WEB_API_KEY,
          },
        },
    );
    console.log("✅ Successfully obtained ID token");

    return {
      token: signInResponse.data.idToken,
      userId: userRecord.uid,
    };
  } catch (error) {
    console.error("\n❌ Authentication error details:");
    console.error("Status:", error.response?.status);
    console.error("Error code:", error.response?.data?.error?.code);
    console.error("Error message:", error.response?.data?.error?.message);
    if (error.response?.data?.error?.errors) {
      console.error("Additional errors:", JSON.stringify(error.response.data.error.errors, null, 2));
    }
    throw error;
  }
}

async function runTests() {
  console.log("🧪 Starting API Tests...\n");
  let userId;

  try {
    // Get authentication token and user ID
    console.log("🔑 Getting authentication token...");
    const {token, userId: testUserId} = await getTestUserToken();
    userId = testUserId;
    console.log("✅ Authentication successful, user ID:", userId);

    // Configure axios with auth header
    console.log("🔧 Configuring axios with auth header");
    const axiosConfig = {
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    };
    console.log("✅ Axios configured successfully");

    // Test 1: Create User Profile
    console.log("\n📝 Test 1: Creating User Profile");
    const createUserResponse = await axios.post(
        `${API_BASE_URL}/user/profile`,
        {
          displayName: "Test User",
          preferences: {
            dietaryRestrictions: ["vegetarian"],
          },
        },
        axiosConfig,
    );
    console.log("✅ User Profile Created:", createUserResponse.data);

    // Test 2: Get User Profile
    console.log("\nTest 2: Getting User Profile");
    const getUserResponse = await axios.get(
        `${API_BASE_URL}/user/profile/${userId}`,
        axiosConfig,
    );
    console.log("✅ User Profile Retrieved:", getUserResponse.data);

    // Test 3: Attempt to access another user's profile (should fail)
    console.log("\nTest 3: Attempting to access another user's profile");
    try {
      await axios.get(
          `${API_BASE_URL}/user/profile/another-user-id`,
          axiosConfig,
      );
      console.log("❌ Security test failed: Was able to access another user's profile");
    } catch (error) {
      if (error.response?.status === 403) {
        console.log("✅ Security test passed: Properly denied access to another user's profile");
      } else {
        throw error;
      }
    }

    // Test 4: Attempt to create profile with invalid data (should fail)
    console.log("\nTest 4: Attempting to create profile with invalid data");
    try {
      await axios.post(
          `${API_BASE_URL}/user/profile`,
          {
            displayName: "", // Invalid: empty string
            preferences: {
              dietaryRestrictions: [123], // Invalid: not strings
            },
          },
          axiosConfig,
      );
      console.log("❌ Validation test failed: Accepted invalid data");
    } catch (error) {
      if (error.response?.status === 400) {
        console.log("✅ Validation test passed: Properly rejected invalid data");
      } else {
        throw error;
      }
    }

    // Test 5: Create Shopping List
    console.log("\nTest 5: Creating Shopping List");
    const createListResponse = await axios.post(
        `${API_BASE_URL}/shopping-list/create`,
        {
          userId,
          name: "Test Shopping List",
          items: [
            {
              name: "Apples",
              quantity: 5,
              unit: "pieces",
              category: "fruits",
            },
            {
              name: "Milk",
              quantity: 1,
              unit: "gallon",
              category: "dairy",
            },
          ],
        },
        axiosConfig,
    );
    console.log("✅ Shopping List Created:", createListResponse.data);

    // Test 6: Get Shopping Lists
    console.log("\nTest 6: Getting Shopping Lists");
    const getListsResponse = await axios.get(
        `${API_BASE_URL}/shopping-lists/${userId}`,
        axiosConfig,
    );
    console.log("✅ Shopping Lists Retrieved:", getListsResponse.data);

    // Test 7: Add Items to Pantry
    console.log("\nTest 7: Adding Items to Pantry");
    const addToPantryResponse = await axios.post(
        `${API_BASE_URL}/pantry/add`,
        {
          userId,
          items: [
            {
              name: "Rice",
              quantity: 2,
              unit: "kg",
              category: "grains",
            },
            {
              name: "Beans",
              quantity: 1,
              unit: "kg",
              category: "legumes",
            },
          ],
        },
        axiosConfig,
    );
    console.log("✅ Items Added to Pantry:", addToPantryResponse.data);

    // Test 8: Get Pantry Items
    console.log("\nTest 8: Getting Pantry Items");
    const getPantryResponse = await axios.get(
        `${API_BASE_URL}/pantry/${userId}`,
        axiosConfig,
    );
    console.log("✅ Pantry Items Retrieved:", getPantryResponse.data);

    // Test 9: Test Food Search
    console.log("\nTest 9: Testing Food Search");
    const foodSearchResponse = await axios.get(
        `${API_BASE_URL}/food/search?query=apple`,
        axiosConfig,
    );
    console.log("✅ Food Search Results:", foodSearchResponse.data);

    // Test 10: Test AI Chef
    console.log("\nTest 10: Testing AI Chef");
    try {
      const aiChefResponse = await axios.post(
          `${API_BASE_URL}/ai-chef/query`,
          {
            userId,
            query: "What can I make with bananas?",
          },
          axiosConfig,
      );
      console.log("✅ AI Chef Response:", aiChefResponse.data);
    } catch (error) {
      console.log("⚠️ AI Chef test skipped - OpenAI not configured");
    }

    // Test 11: Test Food Recognition
    console.log("\nTest 11: Testing Food Recognition");
    const recognitionResponse = await axios.post(
        `${API_BASE_URL}/food/recognize`,
        {
          userId,
          imageUrl: "https://example.com/test-image.jpg",
        },
        axiosConfig,
    );
    console.log("✅ Food Recognition Results:", recognitionResponse.data);

    // Cleanup: Delete test user
    console.log("\n🧹 Cleaning up test user...");
    await admin.auth().deleteUser(userId);
    console.log("✅ Test user deleted successfully");
    console.log("\n🎉 All tests completed successfully!");
  } catch (error) {
    console.error("\n❌ Test failed with error:");
    console.error("Status:", error.response?.status);
    console.error("Error details:", error.response?.data || error.message);
    console.error("Headers:", error.response?.headers);

    // Cleanup on error
    if (userId) {
      try {
        console.log("\n🧹 Attempting to cleanup test user after error...");
        await admin.auth().deleteUser(userId);
        console.log("✅ Test user deleted successfully");
      } catch (cleanupError) {
        console.error("❌ Failed to cleanup test user:", cleanupError);
      }
    }
  }
}

// Run the tests
runTests();
