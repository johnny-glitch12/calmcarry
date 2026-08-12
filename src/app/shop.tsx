import { Redirect } from 'expo-router';
import { DeviceShop } from '@/features/device/DeviceShop';
import { DEVICE_SHOP_ENABLED } from '@/lib/flags';

/**
 * Same lesson as community.tsx: hiding the entry rows is not the same as removing
 * the screen - the route stays registered, so a deep link (calmcarry://shop) would
 * still open the purchase funnel that guideline 1.4.1 gates (see src/lib/flags.ts).
 * Enforce the flag at the ROUTE, not only where the rows are drawn. Registered
 * devices are managed from /device, which stays fully available.
 */
export default function ShopRoute() {
  if (!DEVICE_SHOP_ENABLED) return <Redirect href="/device" />;
  return <DeviceShop />;
}
