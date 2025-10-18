/**
 * Balance Recalculation Test Script
 *
 * This script helps you test the balance recalculation endpoint.
 * You can run this from the backend directory or integrate it into your admin panel.
 */

// Example usage with fetch (can be used in browser console or Node.js with node-fetch)
async function recalculateBalances(apiUrl, authToken) {
  try {
    const response = await fetch(
      `${apiUrl}/api/transactions/recalculate-balances`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log("✅ Balance Recalculation Complete!");
    console.log("📊 Results:", result);
    console.log(`   - Accounts Processed: ${result.accountsProcessed}`);
    console.log(`   - Transactions Updated: ${result.transactionsUpdated}`);
    return result;
  } catch (error) {
    console.error("❌ Error recalculating balances:", error);
    throw error;
  }
}

// Example usage:
// const apiUrl = 'http://localhost:3000'; // or your production URL
// const authToken = 'your-jwt-token-here';
// recalculateBalances(apiUrl, authToken);

// For React Native / Mobile app integration:
/*
import { api } from '../lib/api';

export const recalculateBalances = async () => {
  try {
    const { data } = await api.post('/transactions/recalculate-balances');
    return data;
  } catch (error) {
    console.error('Balance recalculation failed:', error);
    throw error;
  }
};

// Then in your component:
const handleRecalculate = async () => {
  try {
    const result = await recalculateBalances();
    Toast.show({
      type: 'success',
      text1: 'Balances Recalculated',
      text2: `Updated ${result.transactionsUpdated} transactions`,
    });
  } catch (error) {
    Toast.show({
      type: 'error',
      text1: 'Recalculation Failed',
      text2: 'Please try again',
    });
  }
};
*/

// For direct curl command:
/*
curl -X POST http://localhost:3000/api/transactions/recalculate-balances \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
*/

module.exports = { recalculateBalances };
