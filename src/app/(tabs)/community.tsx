import { Redirect } from 'expo-router';
import { CommunityScreen } from '@/features/community/CommunityScreen';
import { COMMUNITY_ENABLED } from '@/lib/flags';

/**
 * Hiding the TAB is not the same as removing the screen.
 *
 * expo-router's `href: null` in (tabs)/_layout.tsx only suppresses the tab button -
 * the route stays registered, so a deep link (calmcarry://community) still mounted
 * the wall in a build whose App Privacy answer says it has no user-generated content.
 * The flag has to be enforced at the ROUTE, not only where the tab is drawn.
 *
 * See src/lib/flags.ts for why the wall is off in v1 (App Store guideline 1.2: there
 * is no way to block an abusive user).
 */
export default function CommunityRoute() {
  if (!COMMUNITY_ENABLED) return <Redirect href="/" />;
  return <CommunityScreen />;
}
