import { Stack } from "expo-router";

export default function ShopLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="products" />
      <Stack.Screen name="products/new" />
      <Stack.Screen name="products/[productId]" />
      <Stack.Screen name="invoices" />
      <Stack.Screen name="invoices/new" />
      <Stack.Screen name="parties" />
    </Stack>
  );
}
